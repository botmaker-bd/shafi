// server/core/bot-manager.js
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');
const ApiWrapper = require('./api-wrapper');
const { executeCommandCode } = require('./command-executor');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.userStates = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        this.initialized = false;
        this.dataCache = new Map();
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    async initializeAllBots() {
        if (this.initialized) return;
        
        try {
            console.log('🔄 Initializing all bots from database...');
            const { data: bots, error } = await supabase
                .from('bots')
                .select('token, name, is_active')
                .eq('is_active', true);

            if (error) throw error;

            console.log(`📊 Found ${bots?.length || 0} active bots`);

            if (!bots || bots.length === 0) {
                console.log('ℹ️ No active bots found in database');
                this.initialized = true;
                return;
            }

            let successCount = 0;
            
            for (let i = 0; i < bots.length; i++) {
                const bot = bots[i];
                try {
                    await this.initializeBot(bot.token);
                    successCount++;
                    
                    if (i < bots.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (botError) {
                    console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                }
            }

            this.initialized = true;
            console.log(`✅ ${successCount}/${bots.length} bots initialized successfully`);
        } catch (error) {
            console.error('❌ Initialize all bots error:', error);
            throw error;
        }
    }

    async initializeBot(token) {
        try {
            console.log(`🔄 Initializing bot: ${token.substring(0, 15)}...`);

            // Get commands from database
            const { data: commands, error } = await supabase
                .from('commands')
                .select('*')
                .eq('bot_token', token)
                .eq('is_active', true);

            if (error) throw error;

            let bot;
            
            if (this.USE_WEBHOOK) {
                bot = new TelegramBot(token, { 
                    polling: false,
                    request: { 
                        concurrency: 10,
                        timeout: 30000
                    }
                });
                
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                await bot.deleteWebHook();
                await bot.setWebHook(webhookUrl);
                console.log(`✅ Webhook set: ${webhookUrl}`);
            } else {
                bot = new TelegramBot(token, { 
                    polling: {
                        interval: 1000,
                        autoStart: true,
                        params: { 
                            timeout: 10
                        }
                    },
                    request: {
                        timeout: 30000
                    }
                });
            }

            // Setup event handlers
            this.setupEventHandlers(bot, token);

            // Test connection
            try {
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username}`);
            } catch (botError) {
                console.error(`❌ Bot connection failed:`, botError.message);
                throw botError;
            }

            // Store bot and commands
            this.activeBots.set(token, bot);
            this.botCommands.set(token, commands || []);

            return true;
        } catch (error) {
            console.error(`❌ Initialize bot error:`, error);
            throw error;
        }
    }

    setupEventHandlers(bot, token) {
        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
        bot.on('edited_message', (msg) => this.handleEditedMessage(bot, token, msg));
        bot.on('photo', (msg) => this.handleMedia(bot, token, msg, 'photo'));
        bot.on('video', (msg) => this.handleMedia(bot, token, msg, 'video'));
        bot.on('document', (msg) => this.handleMedia(bot, token, msg, 'document'));
        bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
        
        bot.on('polling_error', (error) => console.error(`❌ Polling error:`, error));
        bot.on('webhook_error', (error) => console.error(`❌ Webhook error:`, error));
        bot.on('error', (error) => console.error(`❌ Bot error:`, error));
    }

    async handleMessage(bot, token, msg) {
        try {
            if (!msg.text && !msg.caption) return;

            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || msg.caption || '';

            console.log(`\n📨 ========== NEW MESSAGE ==========`);
            console.log(`👤 From: ${msg.from.first_name} (${userId})`);
            console.log(`💬 Text: "${text}"`);

            // Check for waitForAnswer response first
            const isWaitResponse = await this.handleWaitForAnswerResponse(token, userId, text, msg);
            if (isWaitResponse) {
                console.log('✅ Message handled as waitForAnswer response');
                return;
            }

            // Handle Python code execution
            if (text.startsWith('/python ')) {
                await this.executePythonCode(bot, chatId, text.replace('/python ', ''));
                return;
            }

            // Find and execute matching command
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                console.log(`🎯 Executing command: ${command.command_patterns}`);
                await this.executeCommand(bot, command, msg, text);
            }

            console.log(`✅ ========== MESSAGE PROCESSING COMPLETE ==========\n`);

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    async handleWaitForAnswerResponse(botToken, userId, userText, msg) {
        try {
            // Get all wait states for this user
            const { data: waitStates } = await supabase
                .from('universal_data')
                .select('data_key, data_value')
                .eq('data_type', 'user_data')
                .eq('bot_token', botToken)
                .eq('user_id', userId.toString())
                .like('data_key', 'wait_%');

            if (!waitStates || waitStates.length === 0) {
                return false;
            }

            console.log(`🔍 Found ${waitStates.length} wait states`);

            // Use the most recent wait state
            const mostRecentState = waitStates[waitStates.length - 1];
            const stateData = JSON.parse(mostRecentState.data_value);
            
            if (stateData.type !== 'wait_for_answer') {
                return false;
            }

            console.log(`🔄 Processing wait state: ${mostRecentState.data_key}`);

            // Find active commands with answer handlers
            const commands = this.botCommands.get(botToken) || [];
            const commandWithAnswerHandler = commands.find(cmd => 
                cmd.wait_for_answer === true
            );

            if (commandWithAnswerHandler && commandWithAnswerHandler.answer_handler) {
                console.log(`📝 Executing answer handler for command: ${commandWithAnswerHandler.command_patterns}`);
                await this.executeAnswerHandler(botToken, userId, userText, msg, commandWithAnswerHandler);
            } else {
                console.log('⚠️ No answer handler found, using default response');
                await this.sendDefaultResponse(botToken, msg.chat.id, userText);
            }

            // Cleanup THIS specific wait state
            await this.deleteData('user_data', botToken, userId, mostRecentState.data_key);
            
            return true;

        } catch (error) {
            console.error('❌ handleWaitForAnswerResponse error:', error);
            return false;
        }
    }

    async executeAnswerHandler(botToken, userId, userText, msg, command) {
        try {
            const bot = this.activeBots.get(botToken);
            if (!bot) return;

            // Create execution context for answer handler
            const context = {
                msg: msg,
                chatId: msg.chat.id,
                userId: userId,
                username: msg.from.username,
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                language_code: msg.from.language_code,
                botToken: botToken,
                userInput: userText,
                params: userText,
                text: userText,
                User: {
                    saveData: (key, value) => this.saveData('user_data', botToken, userId, key, value),
                    getData: (key) => this.getData('user_data', botToken, userId, key),
                    deleteData: (key) => this.deleteData('user_data', botToken, userId, key)
                },
                Bot: {
                    saveData: (key, value) => this.saveData('bot_data', botToken, null, key, value),
                    getData: (key) => this.getData('bot_data', botToken, null, key),
                    deleteData: (key) => this.deleteData('bot_data', botToken, null, key)
                }
            };

            console.log(`🚀 Executing answer handler code`);

            // Execute answer handler code
            const executionCode = `
                const { User, Bot, params, text, userInput, msg, chatId, userId } = this.context;
                try {
                    ${command.answer_handler}
                } catch (error) {
                    console.error('Answer handler error:', error);
                }
            `;

            const executionWrapper = { context: context };
            const answerHandlerFunction = new Function(executionCode);
            await answerHandlerFunction.bind(executionWrapper)();

            console.log(`✅ Answer handler executed successfully`);

        } catch (error) {
            console.error('❌ executeAnswerHandler error:', error);
        }
    }

    async executeCommand(bot, command, msg, userInput = null) {
        try {
            console.log(`🔧 Executing command: ${command.command_patterns} for chat: ${msg.chat.id}`);
            
            // Pre-load user data
            await this.preloadUserData(command.bot_token, msg.from.id);
            
            // Create execution context
            const context = {
                msg: msg,
                chatId: msg.chat.id,
                userId: msg.from.id,
                username: msg.from.username,
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                language_code: msg.from.language_code,
                botToken: command.bot_token,
                userInput: userInput,
                User: {
                    saveData: (key, value) => {
                        const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                        this.dataCache.set(cacheKey, value);
                        this.saveData('user_data', command.bot_token, msg.from.id, key, value)
                            .catch(err => console.error('❌ Background save error:', err));
                        return value;
                    },
                    getData: (key) => {
                        const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                        if (this.dataCache.has(cacheKey)) {
                            return this.dataCache.get(cacheKey);
                        }
                        return null;
                    },
                    deleteData: (key) => {
                        const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                        this.dataCache.delete(cacheKey);
                        this.deleteData('user_data', command.bot_token, msg.from.id, key)
                            .catch(err => console.error('❌ Background delete error:', err));
                        return true;
                    }
                },
                Bot: {
                    saveData: (key, value) => {
                        const cacheKey = `${command.bot_token}_bot_${key}`;
                        this.dataCache.set(cacheKey, value);
                        this.saveData('bot_data', command.bot_token, null, key, value)
                            .catch(err => console.error('❌ Background bot save error:', err));
                        return value;
                    },
                    getData: (key) => {
                        const cacheKey = `${command.bot_token}_bot_${key}`;
                        if (this.dataCache.has(cacheKey)) {
                            return this.dataCache.get(cacheKey);
                        }
                        return null;
                    },
                    deleteData: (key) => {
                        const cacheKey = `${command.bot_token}_bot_${key}`;
                        this.dataCache.delete(cacheKey);
                        this.deleteData('bot_data', command.bot_token, null, key)
                            .catch(err => console.error('❌ Background bot delete error:', err));
                        return true;
                    }
                }
            };

            const result = await executeCommandCode(bot, command.code, context);
            
            console.log(`✅ Command executed successfully: ${command.command_patterns}`);
            return {
                success: true,
                message: "Command executed and message delivered",
                chatId: msg.chat.id,
                command: command.command_patterns,
                result: result
            };
            
        } catch (error) {
            console.error(`❌ Command execution error for ${command.command_patterns}:`, error);
            
            // Send error message to user
            try {
                await bot.sendMessage(msg.chat.id, `❌ Command Error: ${error.message}`);
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
            
            throw error;
        }
    }

    async preloadUserData(botToken, userId) {
        try {
            const { data, error } = await supabase
                .from('universal_data')
                .select('data_key, data_value')
                .eq('data_type', 'user_data')
                .eq('bot_token', botToken)
                .eq('user_id', userId.toString());

            if (error) {
                console.error('❌ Preload data error:', error);
                return;
            }

            // Store in cache
            if (data) {
                data.forEach(item => {
                    const cacheKey = `${botToken}_${userId}_${item.data_key}`;
                    try {
                        const value = JSON.parse(item.data_value);
                        this.dataCache.set(cacheKey, value);
                    } catch {
                        this.dataCache.set(cacheKey, item.data_value);
                    }
                });
            }
        } catch (error) {
            console.error('❌ Preload user data error:', error);
        }
    }

    async findMatchingCommand(token, text, msg) {
        const commands = this.botCommands.get(token) || [];
        
        for (const command of commands) {
            if (!command.command_patterns) continue;
            
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            
            for (const pattern of patterns) {
                if (text === pattern || text.startsWith(pattern + ' ')) {
                    return command;
                }
            }
        }
        
        return null;
    }

    async sendDefaultResponse(botToken, chatId, userText) {
        try {
            const bot = this.activeBots.get(botToken);
            if (bot) {
                await bot.sendMessage(chatId, `✅ Received: "${userText}"`);
            }
        } catch (error) {
            console.error('❌ sendDefaultResponse error:', error);
        }
    }

    async executePythonCode(bot, chatId, pythonCode) {
        try {
            await bot.sendMessage(chatId, '🐍 Executing Python code...');
            
            const result = await pythonRunner.runPythonCode(pythonCode);
            
            await bot.sendMessage(chatId, `✅ Python Result:\n\`\`\`\n${result}\n\`\`\``, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Python Error:\n\`\`\`\n${error.message}\n\`\`\``, {
                parse_mode: 'Markdown'
            });
        }
    }

    // Data storage methods
    async saveData(dataType, botToken, userId, key, value, metadata = {}) {
        try {
            const { data, error } = await supabase
                .from('universal_data')
                .upsert({
                    data_type: dataType,
                    bot_token: botToken,
                    user_id: userId ? userId.toString() : null,
                    data_key: key,
                    data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    metadata: metadata,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'data_type,bot_token,user_id,data_key'
                });

            if (error) {
                console.error('❌ Save data error:', error);
            }
            return value;
        } catch (error) {
            console.error('❌ Save data error:', error);
            return value;
        }
    }

    async getData(dataType, botToken, userId, key) {
        try {
            const { data, error } = await supabase
                .from('universal_data')
                .select('data_value, metadata')
                .eq('data_type', dataType)
                .eq('bot_token', botToken)
                .eq('user_id', userId ? userId.toString() : null)
                .eq('data_key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                console.error('❌ Get data error:', error);
                return null;
            }
            
            if (data && data.data_value) {
                try {
                    return JSON.parse(data.data_value);
                } catch {
                    return data.data_value;
                }
            }
            return null;
        } catch (error) {
            console.error('❌ Get data error:', error);
            return null;
        }
    }

    async deleteData(dataType, botToken, userId, key) {
        try {
            const { error } = await supabase
                .from('universal_data')
                .delete()
                .eq('data_type', dataType)
                .eq('bot_token', botToken)
                .eq('user_id', userId ? userId.toString() : null)
                .eq('data_key', key);

            if (error) {
                console.error('❌ Delete data error:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('❌ Delete data error:', error);
            return false;
        }
    }

    async sendError(bot, chatId, error) {
        try {
            const errorMessage = `
❌ *Error Occurred*

*Message:* ${error.message}
*Type:* ${error.name}

We've logged this error and will fix it soon.
            `.trim();
        
            await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }

    // Other event handlers
    async handleEditedMessage(bot, token, msg) {
        console.log(`✏️ Edited message from ${msg.from.first_name}`);
    }

    async handleMedia(bot, token, msg, mediaType) {
        try {
            const caption = msg.caption || '';
            const command = await this.findMatchingCommand(token, caption, msg);
            if (command) {
                await this.executeCommand(bot, command, msg, caption);
            }
        } catch (error) {
            console.error(`❌ Handle ${mediaType} error:`, error);
        }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            console.log(`🔘 Callback: ${data} from ${from.first_name}`);
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Callback query error:', error);
        }
    }

    removeBot(token) {
        const bot = this.activeBots.get(token);
        if (bot) {
            if (!this.USE_WEBHOOK) {
                bot.stopPolling();
            } else {
                bot.deleteWebHook().catch(console.error);
            }
            this.activeBots.delete(token);
            this.botCommands.delete(token);
        }
    }

    async updateCommandCache(token) {
        try {
            const { data: commands, error } = await supabase
                .from('commands')
                .select('*')
                .eq('bot_token', token)
                .eq('is_active', true);

            if (error) {
                console.error('❌ Update command cache error:', error);
                return;
            }

            this.botCommands.set(token, []);
            
            if (commands && Array.isArray(commands)) {
                this.botCommands.set(token, commands);
                console.log(`✅ Updated command cache for bot ${token.substring(0,10)}...: ${commands.length} commands`);
            }
        } catch (error) {
            console.error('❌ Command cache update failed:', error);
        }
    }

    getBotStatus() {
        return {
            totalBots: this.activeBots.size,
            mode: this.USE_WEBHOOK ? 'webhook' : 'polling',
            bots: Array.from(this.activeBots.keys()).map(token => ({
                token: token.substring(0, 15) + '...',
                commands: this.botCommands.get(token)?.length || 0
            }))
        };
    }
}

const botManagerInstance = new BotManager();
module.exports = botManagerInstance;