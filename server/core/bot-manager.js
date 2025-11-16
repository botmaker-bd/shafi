// server/core/bot-manager.js
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const { executeCommandCode } = require('./command-executor');
const ApiWrapper = require('./api-wrapper');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.waitingAnswers = new Map(); // NEW: Simple waiting system
        this.dataCache = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
    }

    // 🎯 INITIALIZE BOT
    async initializeBot(token) {
        try {
            console.log(`🔄 Initializing bot: ${token.substring(0, 15)}...`);

            let bot;
            if (this.USE_WEBHOOK) {
                bot = new TelegramBot(token, { polling: false });
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                await bot.setWebHook(webhookUrl);
            } else {
                bot = new TelegramBot(token, { 
                    polling: {
                        interval: 1000,
                        autoStart: true,
                        params: { timeout: 10 }
                    }
                });
            }

            // Load commands
            const commands = await this.loadCommandsFromDB(token);
            this.botCommands.set(token, commands || []);

            // Setup event handlers
            this.setupEventHandlers(bot, token);

            this.activeBots.set(token, bot);
            
            // Test connection
            const botInfo = await bot.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);

            return true;
        } catch (error) {
            console.error(`❌ Initialize bot error:`, error);
            throw error;
        }
    }

    // 🎯 LOAD COMMANDS FROM DATABASE
    async loadCommandsFromDB(token) {
        try {
            const { data: commands, error } = await supabase
                .from('commands')
                .select('*')
                .eq('bot_token', token)
                .eq('is_active', true);

            if (error) throw error;
            return commands || [];
        } catch (error) {
            console.error('❌ Load commands error:', error);
            return [];
        }
    }

    // 🎯 SETUP EVENT HANDLERS
    setupEventHandlers(bot, token) {
        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
        bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
        bot.on('error', (error) => console.error(`❌ Bot error:`, error));
    }

    // 🎯 HANDLE INCOMING MESSAGES
    async handleMessage(bot, token, msg) {
        try {
            // Skip non-text messages without caption
            if (!msg.text && !msg.caption) return;

            const text = msg.text || msg.caption || '';
            const userId = msg.from.id;
            const userKey = `${token}_${userId}`;

            console.log(`📨 Message from ${msg.from.first_name}: "${text}"`);

            // 1. FIRST: Check if user is waiting to answer
            if (this.waitingAnswers.has(userKey)) {
                console.log(`✅ USER IS WAITING FOR ANSWER! Processing response...`);
                await this.processUserAnswer(userKey, text, msg);
                return; // Stop here
            }

            // 2. Otherwise, process as normal command
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                await this.executeCommand(bot, command, msg, text);
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    // 🎯 FIND MATCHING COMMAND
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

    // 🎯 EXECUTE COMMAND
    async executeCommand(bot, command, msg, userInput) {
        try {
            console.log(`🎯 Executing command: ${command.command_patterns}`);

            // Create execution context
            const context = this.createExecutionContext(bot, command, msg, userInput);
            
            // 1. Execute main command code
            await executeCommandCode(bot, command.code, context);
            
            // 2. 🔥 NEW: If wait_for_answer is true, setup answer waiting
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupAnswerHandler(bot, command, msg, context);
            }

            console.log(`✅ Command executed successfully: ${command.command_patterns}`);

        } catch (error) {
            console.error(`❌ Command execution error:`, error);
            throw error;
        }
    }

    // 🎯 SETUP ANSWER WAITING SYSTEM
    async setupAnswerHandler(bot, command, msg, context) {
        const userKey = `${command.bot_token}_${msg.from.id}`;
        
        console.log(`⏳ Setting up answer handler for user: ${msg.from.first_name}`);
        
        // Store the answer handler information
        this.waitingAnswers.set(userKey, {
            bot: bot,
            command: command,
            context: context,
            timestamp: Date.now(),
            originalMessage: msg
        });
        
        console.log(`✅ Now waiting for answer from ${msg.from.first_name}`);
    }

    // 🎯 PROCESS USER'S ANSWER
    async processUserAnswer(userKey, answerText, answerMsg) {
        try {
            const waitingData = this.waitingAnswers.get(userKey);
            if (!waitingData) {
                console.log(`❌ No waiting data found for: ${userKey}`);
                return;
            }

            const { bot, command, context } = waitingData;
            
            console.log(`🎯 Processing answer: "${answerText}" for command: ${command.command_patterns}`);
            
            // Create enhanced context for answer handler
            const answerContext = {
                ...context,
                params: answerText,           // User's answer text
                userInput: answerText,        // Alias for params
                answerMessage: answerMsg,     // The answer message object
                msg: answerMsg                // Set current message to answer message
            };

            // Execute the answer handler code
            await executeCommandCode(bot, command.answer_handler, answerContext);
            
            console.log(`✅ Answer handler executed successfully`);
            
        } catch (error) {
            console.error('❌ Answer handler execution error:', error);
            await this.sendError(bot, answerMsg.chat.id, error);
        } finally {
            // 🔥 IMPORTANT: Remove from waiting list after processing
            this.waitingAnswers.delete(userKey);
            console.log(`🧹 Cleaned up answer handler for ${userKey}`);
        }
    }

    // 🎯 CREATE EXECUTION CONTEXT
    createExecutionContext(bot, command, msg, userInput) {
        return {
            msg: msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username || '',
            first_name: msg.from.first_name || '',
            last_name: msg.from.last_name || '',
            language_code: msg.from.language_code || '',
            userInput: userInput,
            botToken: command.bot_token,
            
            // Data storage interfaces
            User: {
                saveData: (key, value) => this.saveUserData(command.bot_token, msg.from.id, key, value),
                getData: (key) => this.getUserData(command.bot_token, msg.from.id, key),
                deleteData: (key) => this.deleteUserData(command.bot_token, msg.from.id, key),
                increment: (key, amount = 1) => {
                    const current = this.getUserData(command.bot_token, msg.from.id, key) || 0;
                    const newValue = parseInt(current) + amount;
                    this.saveUserData(command.bot_token, msg.from.id, key, newValue);
                    return newValue;
                }
            },
            
            Bot: {
                saveData: (key, value) => this.saveBotData(command.bot_token, key, value),
                getData: (key) => this.getBotData(command.bot_token, key),
                deleteData: (key) => this.deleteBotData(command.bot_token, key)
            }
        };
    }

    // 🎯 DATA STORAGE METHODS
    async saveUserData(botToken, userId, key, value) {
        try {
            // Instant cache
            const cacheKey = `user_${botToken}_${userId}_${key}`;
            this.dataCache.set(cacheKey, value);
            
            // Background save to database
            await supabase
                .from('universal_data')
                .upsert({
                    data_type: 'user_data',
                    bot_token: botToken,
                    user_id: userId.toString(),
                    data_key: key,
                    data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'data_type,bot_token,user_id,data_key'
                });
                
        } catch (error) {
            console.error('❌ Save user data error:', error);
        }
    }

    getUserData(botToken, userId, key) {
        const cacheKey = `user_${botToken}_${userId}_${key}`;
        return this.dataCache.get(cacheKey) || null;
    }

    async deleteUserData(botToken, userId, key) {
        try {
            const cacheKey = `user_${botToken}_${userId}_${key}`;
            this.dataCache.delete(cacheKey);
            
            await supabase
                .from('universal_data')
                .delete()
                .eq('data_type', 'user_data')
                .eq('bot_token', botToken)
                .eq('user_id', userId.toString())
                .eq('data_key', key);
                
        } catch (error) {
            console.error('❌ Delete user data error:', error);
        }
    }

    async saveBotData(botToken, key, value) {
        try {
            const cacheKey = `bot_${botToken}_${key}`;
            this.dataCache.set(cacheKey, value);
            
            await supabase
                .from('universal_data')
                .upsert({
                    data_type: 'bot_data',
                    bot_token: botToken,
                    data_key: key,
                    data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'data_type,bot_token,data_key'
                });
                
        } catch (error) {
            console.error('❌ Save bot data error:', error);
        }
    }

    getBotData(botToken, key) {
        const cacheKey = `bot_${botToken}_${key}`;
        return this.dataCache.get(cacheKey) || null;
    }

    async deleteBotData(botToken, key) {
        try {
            const cacheKey = `bot_${botToken}_${key}`;
            this.dataCache.delete(cacheKey);
            
            await supabase
                .from('universal_data')
                .delete()
                .eq('data_type', 'bot_data')
                .eq('bot_token', botToken)
                .eq('data_key', key);
                
        } catch (error) {
            console.error('❌ Delete bot data error:', error);
        }
    }

    // 🎯 HANDLE CALLBACK QUERIES
    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            console.log(`🔘 Callback: ${data} from ${from.first_name}`);
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Callback query error:', error);
        }
    }

    // 🎯 SEND ERROR MESSAGE
    async sendError(bot, chatId, error) {
        try {
            await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }

    // 🎯 UPDATE COMMAND CACHE
    async updateCommandCache(token) {
        try {
            const commands = await this.loadCommandsFromDB(token);
            this.botCommands.set(token, commands);
            console.log(`✅ Updated command cache for bot: ${commands.length} commands`);
        } catch (error) {
            console.error('❌ Command cache update failed:', error);
        }
    }

    // 🎯 REMOVE BOT
    removeBot(token) {
        const bot = this.activeBots.get(token);
        if (bot) {
            if (!this.USE_WEBHOOK) {
                bot.stopPolling();
            }
            this.activeBots.delete(token);
            this.botCommands.delete(token);
        }
    }

    // 🎯 INITIALIZE ALL BOTS
    async initializeAllBots() {
        try {
            console.log('🔄 Initializing all bots from database...');
            const { data: bots, error } = await supabase
                .from('bots')
                .select('token, name, is_active')
                .eq('is_active', true);

            if (error) throw error;

            console.log(`📊 Found ${bots?.length || 0} active bots`);

            if (!bots || bots.length === 0) {
                console.log('ℹ️ No active bots found');
                return;
            }

            for (const bot of bots) {
                try {
                    await this.initializeBot(bot.token);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (botError) {
                    console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                }
            }

            console.log(`✅ Bot initialization completed`);
        } catch (error) {
            console.error('❌ Initialize all bots error:', error);
        }
    }
}

// Create singleton instance
const botManagerInstance = new BotManager();
module.exports = botManagerInstance;