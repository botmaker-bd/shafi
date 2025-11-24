// server/core/bot-manager.js - FIXED VERSION
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const { executeCommandCode } = require('./command-executor');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.waitingAnswers = new Map();
        this.commandAnswerHandlers = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        this.initialized = false;
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    async initializeAllBots() {
        if (this.initialized) return;
        
        try {
            const { data: bots, error } = await supabase
                .from('bots')
                .select('token, name, is_active')
                .eq('is_active', true);

            if (error) throw error;

            console.log(`📊 Found ${bots?.length || 0} active bots`);

            if (!bots || bots.length === 0) {
                this.initialized = true;
                return;
            }

            let successCount = 0;
            
            for (const bot of bots) {
                try {
                    await this.initializeBot(bot.token);
                    successCount++;
                    await this.wait(1000); // Rate limiting
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

    getBotInstance(token) {
        return this.activeBots.get(token);
    }

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot) await bot.processUpdate(update);
        } catch (error) {
            console.error('❌ Handle bot update error:', error);
        }
    }

    async executeCommand(bot, command, msg, userInput = null) {
        try {
            console.log(`🔧 Executing command: ${command.command_patterns}`);
            
            await this.preloadUserData(command.bot_token, msg.from.id);
            
            const context = this.createExecutionContext(bot, command, msg, userInput);
            const result = await executeCommandCode(bot, command.code, context);
            
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupCommandAnswerHandler(bot, command, msg, context);
            }
            
            return {
                success: true,
                message: "Command executed successfully",
                chatId: msg.chat.id,
                command: command.command_patterns,
                result: result
            };
            
        } catch (error) {
            console.error(`❌ Command execution error for ${command.command_patterns}:`, error);
            
            try {
                const errorMsg = `❌ Command Error: ${error.message}`;
                await bot.sendMessage(msg.chat.id, errorMsg);
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
            
            throw error;
        }
    }

    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        
        if (!botToken) {
            console.error('❌ CRITICAL: command.bot_token is undefined!');
            console.log('🔍 Command object:', command);
        }
        
        const self = this;

        return {
            msg, 
            chatId: msg.chat.id, 
            userId: msg.from.id,
            username: msg.from.username || '', 
            first_name: msg.from.first_name || '',
            last_name: msg.from.last_name || '', 
            language_code: msg.from.language_code || '',
            botToken: botToken || 'unknown', 
            userInput, 
            nextCommandHandlers: this.waitingAnswers,
            waitingAnswers: this.waitingAnswers, 
            commandAnswerHandlers: this.commandAnswerHandlers,
            command: command,
            
            User: {
                saveData: (key, value) => {
                    const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                    return this.saveData('user_data', botToken, msg.from.id, key, value)
                        .catch(err => console.error('❌ Background save error:', err));
                },
                
                getData: (key) => {
                    // This will be handled by the actual getData function in command-executor
                    return null;
                },
                
                deleteData: (key) => 
                    this.deleteData('user_data', botToken, msg.from.id, key)
                        .catch(err => console.error('❌ Background delete error:', err)),
                
                increment: async (key, amount = 1) => {
                    // This will be handled by the actual increment function in command-executor
                    return amount;
                }
            },
            
            Bot: {
                saveData: (key, value) => 
                    this.saveData('bot_data', botToken, null, key, value)
                        .catch(err => console.error('❌ Background bot save error:', err)),
                
                getData: (key) => null,
                
                deleteData: (key) => 
                    this.deleteData('bot_data', botToken, null, key)
                        .catch(err => console.error('❌ Background bot delete error:', err))
            }
        };
    }

    async setupCommandAnswerHandler(bot, command, msg, context) {
        const userKey = `${command.bot_token}_${msg.from.id}`;
        
        try {
            this.commandAnswerHandlers.set(userKey, {
                bot, command, context, timestamp: Date.now(), originalMessage: msg
            });
            
            await bot.sendMessage(msg.chat.id, "💬 I'm listening for your response...");
        } catch (error) {
            console.error('❌ Failed to setup command answer handler:', error);
            await bot.sendMessage(msg.chat.id, "❌ Failed to setup response listener. Please try again.");
        }
    }

    async processCommandAnswer(userKey, answerText, answerMsg) {
        let handlerData;
        
        try {
            handlerData = this.commandAnswerHandlers.get(userKey);
            if (!handlerData) return;

            const { bot, command, context, originalMessage } = handlerData;
            
            await bot.sendMessage(answerMsg.chat.id, "⏳ Processing your response...");
            
            const answerContext = {
                ...context,
                params: answerText,
                userInput: answerText,
                answerMessage: answerMsg,
                originalMessage: originalMessage
            };

            await executeCommandCode(bot, command.answer_handler, answerContext);
        } catch (error) {
            console.error('❌ Command answer handler execution error:', error);
            try {
                const errorMsg = `❌ Answer Handler Error: ${error.message}`;
                await handlerData?.bot.sendMessage(answerMsg.chat.id, errorMsg);
            } catch (sendError) {}
        } finally {
            this.commandAnswerHandlers.delete(userKey);
        }
    }

    async processWaitForAnswer(userKey, answerText, answerMsg) {
        const waitingData = this.waitingAnswers.get(userKey);
        if (!waitingData) return;

        try {
            if (waitingData.resolve) waitingData.resolve(answerText);
        } catch (error) {
            if (waitingData.reject) waitingData.reject(error);
            try {
                await waitingData?.bot.sendMessage(answerMsg.chat.id, `❌ Error processing your answer: ${error.message}`);
            } catch (sendError) {}
        } finally {
            this.waitingAnswers.delete(userKey);
        }
    }

    async initializeBot(token) {
        try {
            const { data: commands, error } = await supabase
                .from('commands')
                .select('*')
                .eq('bot_token', token)
                .eq('is_active', true);

            if (error) throw error;

            let bot;
            const botOptions = {
                request: { timeout: 30000 },
                polling: !this.USE_WEBHOOK ? { 
                    interval: 1000, autoStart: true,
                    params: { timeout: 10, allowed_updates: ['message', 'callback_query'] }
                } : false
            };

            bot = new TelegramBot(token, botOptions);

            if (this.USE_WEBHOOK) {
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                await bot.deleteWebHook();
                await bot.setWebHook(webhookUrl, {
                    max_connections: 100,
                    allowed_updates: ['message', 'callback_query']
                });
            }

            this.setupEventHandlers(bot, token);

            try {
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username}`);
            } catch (botError) {
                throw botError;
            }

            this.activeBots.set(token, bot);
            this.botCommands.set(token, commands || []);

            setInterval(() => this.cleanupStaleHandlers(), 5 * 60 * 1000);

            return true;
        } catch (error) {
            console.error(`❌ Initialize bot error:`, error);
            throw error;
        }
    }

    setupEventHandlers(bot, token) {
        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
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
            const userKey = `${token}_${userId}`;

            // Handle waitForAnswer promises
            if (this.waitingAnswers.has(userKey)) {
                const handlerData = this.waitingAnswers.get(userKey);
                if (handlerData?.resolve) {
                    handlerData.resolve(text);
                    this.waitingAnswers.delete(userKey);
                    return;
                }
            }

            // Handle command answer handlers
            if (this.commandAnswerHandlers.has(userKey)) {
                await this.processCommandAnswer(userKey, text, msg);
                return;
            }

            // Find and execute matching command
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                await this.executeCommand(bot, command, msg, text);
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;

            // Process as command first
            await this.processCallbackAsCommand(bot, token, callbackQuery);
            
            // Then check waiting answers
            const callbackKey = `${token}_${data}`;
            if (this.waitingAnswers.has(callbackKey)) {
                const handler = this.waitingAnswers.get(callbackKey);
                await handler(data, callbackQuery);
                this.waitingAnswers.delete(callbackKey);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Callback query error:', error);
            try {
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Error: ${error.message}`, show_alert: true 
                });
            } catch (answerError) {}
        }
    }

    async processCallbackAsCommand(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            
            const commands = this.botCommands.get(token) || [];
            const matchingCommand = commands.find(cmd => {
                if (!cmd.command_patterns) return false;
                const patterns = cmd.command_patterns.split(',').map(p => p.trim());
                return patterns.includes(data);
            });
            
            if (matchingCommand) {
                const callbackMessage = {
                    chat: message.chat,
                    from: from,
                    message_id: message.message_id,
                    text: data,
                    date: new Date().getTime() / 1000
                };
                
                await this.executeCommand(bot, matchingCommand, callbackMessage, data);
                
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Executed: ${data}`, show_alert: false 
                });
            } else {
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Unknown command: ${data}`, show_alert: true 
                });
            }
        } catch (error) {
            console.error('❌ Callback command processing error:', error);
            try {
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Error: ${error.message}`, show_alert: true 
                });
            } catch (answerError) {}
        }
    }

    cleanupStaleHandlers() {
        const now = Date.now();
        const STALE_TIMEOUT = 10 * 60 * 1000;
        
        for (const [userKey, handlerData] of this.waitingAnswers.entries()) {
            if (now - handlerData.timestamp > STALE_TIMEOUT) {
                if (handlerData.reject) {
                    handlerData.reject(new Error('Wait for answer timeout (system cleanup)'));
                }
                this.waitingAnswers.delete(userKey);
            }
        }
        
        for (const [userKey, handlerData] of this.commandAnswerHandlers.entries()) {
            if (now - handlerData.timestamp > STALE_TIMEOUT) {
                this.commandAnswerHandlers.delete(userKey);
            }
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

    async sendError(bot, chatId, error) {
        try {
            const errorMessage = `❌ *Error Occurred*\n\n*Message:* ${error.message}`;
            await bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
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

            // Cache implementation can be added here if needed
        } catch (error) {
            console.error('❌ Preload user data error:', error);
        }
    }

    async saveData(dataType, botToken, userId, key, value, metadata = {}) {
        try {
            const { error } = await supabase
                .from('universal_data')
                .upsert({
                    data_type: dataType,
                    bot_token: botToken,
                    user_id: userId ? userId.toString() : null,
                    data_key: key,
                    data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    metadata: metadata,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data_type,bot_token,user_id,data_key' });

            if (error) console.error('❌ Save data error:', error);
            return value;
        } catch (error) {
            console.error('❌ Save data error:', error);
            return value;
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

            if (error) console.error('❌ Delete data error:', error);
            return true;
        } catch (error) {
            console.error('❌ Delete data error:', error);
            return false;
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

            this.botCommands.set(token, commands || []);
        } catch (error) {
            console.error('❌ Command cache update failed:', error);
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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