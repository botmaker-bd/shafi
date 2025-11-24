// server/core/bot-manager.js - FINAL FIXED VERSION
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');
const ApiWrapper = require('./api-wrapper');
const { executeCommandCode } = require('./command-executor');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.nextCommandHandlers = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        this.initialized = false;
        this.dataCache = new Map();
        this.waitingAnswers = new Map();
        this.commandAnswerHandlers = new Map();
        this.callbackHandlers = new Map();
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    async initializeAllBots() {
        if (this.initialized) {
            console.log('🔄 Bots already initialized, skipping...');
            return;
        }
        
        try {
            console.log('🔄 Initializing all bots from database...');
            const { data: bots, error } = await supabase
                .from('bots')
                .select('token, name, is_active')
                .eq('is_active', true);

            if (error) {
                console.error('❌ Database error fetching bots:', error);
                throw error;
            }

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
                } catch (botError) {
                    console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                }
            }

            this.initialized = true;
            console.log(`✅ ${successCount}/${bots.length} bots initialized successfully`);
        } catch (error) {
            console.error('❌ Initialize all bots error:', error);
            this.initialized = true;
        }
    }

    async initializeBot(token) {
        try {
            console.log(`🔄 Initializing bot: ${token.substring(0, 15)}...`);

            const { data: commands, error } = await supabase
                .from('commands')
                .select('*')
                .eq('bot_token', token)
                .eq('is_active', true);

            if (error) {
                console.error('❌ Database error fetching commands:', error);
            }

            let bot;
            const botOptions = {
                request: {
                    timeout: 30000,
                    agentOptions: {
                        keepAlive: true,
                        maxSockets: 50
                    }
                },
                polling: false
            };

            if (this.USE_WEBHOOK) {
                console.log('🔗 Setting up bot in WEBHOOK mode...');
                bot = new TelegramBot(token, botOptions);
                
                try {
                    // ✅ FIXED: Better webhook handling with retry
                    const baseUrl = process.env.BASE_URL || 'https://bot-maker-bd.onrender.com';
                    const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                    
                    console.log(`🔗 Setting webhook: ${webhookUrl}`);
                    
                    // Simple webhook setup without complex options
                    const webhookResult = await bot.setWebHook(webhookUrl);
                    
                    console.log(`✅ Webhook set successfully`);
                    
                } catch (webhookError) {
                    console.log('⚠️ Webhook setup warning (bot will still work):', webhookError.message);
                    // Continue - bot will work even if webhook has minor issues
                }
            } else {
                console.log('🔄 Setting up bot in POLLING mode...');
                botOptions.polling = {
                    interval: 1000,
                    autoStart: true,
                    params: {
                        timeout: 10,
                        allowed_updates: ['message', 'callback_query']
                    }
                };
                bot = new TelegramBot(token, botOptions);
            }

            // ✅ Test bot connection
            try {
                console.log('🔗 Testing bot connection...');
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
            } catch (connectionError) {
                console.error(`❌ Bot connection failed:`, connectionError.message);
                throw new Error('Invalid bot token: ' + connectionError.message);
            }

            // Setup minimal event handlers for webhook mode
            if (this.USE_WEBHOOK) {
                console.log(`🎯 Webhook mode - handlers will process via webhook endpoint`);
            } else {
                bot.on('message', (msg) => this.handleMessage(bot, token, msg));
                bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
            }

            // Error handlers
            bot.on('error', (error) => {
                console.error(`❌ Bot error:`, error.message);
            });

            // Store bot and commands
            this.activeBots.set(token, bot);
            this.botCommands.set(token, commands || []);

            console.log(`✅ Bot initialized successfully: ${token.substring(0, 10)}...`);

            return true;

        } catch (error) {
            console.error(`❌ Initialize bot error:`, error.message);
            throw error;
        }
    }

    async handleMessage(bot, token, msg) {
        try {
            if (!msg.text && !msg.caption) return;

            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || msg.caption || '';
            const userKey = `${token}_${userId}`;

            console.log(`📨 Message from ${msg.from.first_name}: "${text.substring(0, 50)}..."`);

            // Handle waitForAnswer first
            if (this.nextCommandHandlers.has(userKey)) {
                console.log(`✅ WAIT FOR ANSWER HANDLER FOUND!`);
                const handlerData = this.nextCommandHandlers.get(userKey);
                if (handlerData && handlerData.resolve) {
                    handlerData.resolve(text);
                    this.nextCommandHandlers.delete(userKey);
                    return;
                }
                this.nextCommandHandlers.delete(userKey);
            }

            // Handle command answer handlers
            if (this.commandAnswerHandlers.has(userKey)) {
                console.log(`✅ COMMAND ANSWER HANDLER FOUND!`);
                await this.processCommandAnswer(userKey, text, msg);
                return;
            }

            // Find and execute command
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                console.log(`🎯 Executing command: ${command.command_patterns}`);
                await this.executeCommand(bot, command, msg, text);
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
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
            
            console.log(`✅ Command executed successfully`);
            return result;
            
        } catch (error) {
            console.error(`❌ Command execution error:`, error);
            
            try {
                let errorMsg = `❌ Error: ${error.message}`;
                if (errorMsg.length > 200) errorMsg = errorMsg.substring(0, 200) + '...';
                await bot.sendMessage(msg.chat.id, errorMsg);
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
            
            throw error;
        }
    }

    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        const self = this;

        // ✅ SIMPLIFIED: Basic helper functions
        const createUserObject = () => ({
            id: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            language_code: msg.from.language_code,
            chat_id: msg.chat.id
        });

        const createChatObject = () => ({
            id: msg.chat.id,
            type: msg.chat.type,
            title: msg.chat.title,
            username: msg.chat.username
        });

        const waitFunction = async (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        };

        return {
            msg: msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            language_code: msg.from.language_code,
            botToken: botToken,
            userInput: userInput,
            nextCommandHandlers: this.nextCommandHandlers,
            
            // Helper functions
            getUser: createUserObject,
            getChat: createChatObject,
            getCurrentUser: createUserObject,
            getCurrentChat: createChatObject,
            wait: waitFunction,
            delay: waitFunction,
            sleep: waitFunction,
            
            User: {
                saveData: async (key, value) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        self.dataCache.set(cacheKey, value);
                        
                        // ✅ SIMPLIFIED: Use basic insert
                        const { error } = await supabase
                            .from('universal_data')
                            .insert([{
                                data_type: 'user_data',
                                bot_token: botToken,
                                user_id: msg.from.id.toString(),
                                data_key: key,
                                data_value: JSON.stringify(value),
                                created_at: new Date().toISOString()
                            }]);

                        if (error && !error.message.includes('duplicate')) {
                            console.log('⚠️ Save data warning:', error.message);
                        }
                        
                        return value;
                    } catch (error) {
                        console.log('⚠️ Save data warning:', error.message);
                        return value;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        if (self.dataCache.has(cacheKey)) {
                            return self.dataCache.get(cacheKey);
                        }
                        
                        const { data } = await supabase
                            .from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', msg.from.id.toString())
                            .eq('data_key', key)
                            .single();

                        if (!data || !data.data_value) return null;

                        try {
                            return JSON.parse(data.data_value);
                        } catch {
                            return data.data_value;
                        }
                    } catch (error) {
                        return null;
                    }
                },
                
                deleteData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        self.dataCache.delete(cacheKey);
                        
                        await supabase
                            .from('universal_data')
                            .delete()
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', msg.from.id.toString())
                            .eq('data_key', key);
                            
                        return true;
                    } catch (error) {
                        console.log('⚠️ Delete data warning:', error.message);
                        return true;
                    }
                }
            },
            
            Bot: {
                saveData: async (key, value) => {
                    try {
                        const cacheKey = `${botToken}_bot_${key}`;
                        self.dataCache.set(cacheKey, value);
                        
                        await supabase
                            .from('universal_data')
                            .insert([{
                                data_type: 'bot_data',
                                bot_token: botToken,
                                data_key: key,
                                data_value: JSON.stringify(value),
                                created_at: new Date().toISOString()
                            }]);
                            
                        return value;
                    } catch (error) {
                        console.log('⚠️ Save bot data warning:', error.message);
                        return value;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_bot_${key}`;
                        if (self.dataCache.has(cacheKey)) {
                            return self.dataCache.get(cacheKey);
                        }
                        
                        const { data } = await supabase
                            .from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', botToken)
                            .eq('data_key', key)
                            .single();

                        if (!data || !data.data_value) return null;

                        try {
                            return JSON.parse(data.data_value);
                        } catch {
                            return data.data_value;
                        }
                    } catch (error) {
                        return null;
                    }
                }
            },
            
            // Direct data objects
            userData: createUserObject(),
            chatData: createChatObject()
        };
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

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot && this.USE_WEBHOOK) {
                if (update.message) {
                    await this.handleMessage(bot, token, update.message);
                } else if (update.callback_query) {
                    await this.handleCallbackQuery(bot, token, update.callback_query);
                }
            }
        } catch (error) {
            console.error('❌ Handle bot update error:', error);
        }
    }

    getBotInstance(token) {
        return this.activeBots.get(token);
    }

    // ... other essential methods (simplified)
    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, from } = callbackQuery;
            console.log(`🔘 Callback: ${data} from ${from.first_name}`);
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Callback error:', error);
        }
    }

    async sendError(bot, chatId, error) {
        try {
            await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        } catch (sendError) {
            console.error('❌ Failed to send error:', sendError);
        }
    }

    async preloadUserData(botToken, userId) {
        // Simple cache preloading
        try {
            const { data } = await supabase
                .from('universal_data')
                .select('data_key, data_value')
                .eq('data_type', 'user_data')
                .eq('bot_token', botToken)
                .eq('user_id', userId.toString());

            if (data) {
                data.forEach(item => {
                    const cacheKey = `${botToken}_${userId}_${item.data_key}`;
                    try {
                        this.dataCache.set(cacheKey, JSON.parse(item.data_value));
                    } catch {
                        this.dataCache.set(cacheKey, item.data_value);
                    }
                });
            }
        } catch (error) {
            // Silent fail - cache will be populated on demand
        }
    }

    async setupCommandAnswerHandler(bot, command, msg, context) {
        const userKey = `${command.bot_token}_${msg.from.id}`;
        this.commandAnswerHandlers.set(userKey, {
            bot: bot,
            command: command,
            context: context,
            timestamp: Date.now()
        });
        console.log(`⏳ Waiting for answer from ${msg.from.first_name}`);
    }

    async processCommandAnswer(userKey, answerText, answerMsg) {
        try {
            const handlerData = this.commandAnswerHandlers.get(userKey);
            if (!handlerData) return;

            const { bot, command, context } = handlerData;
            const answerContext = {
                ...context,
                params: answerText,
                userInput: answerText
            };

            await executeCommandCode(bot, command.answer_handler, answerContext);
            console.log(`✅ Answer handler executed`);
            
        } catch (error) {
            console.error('❌ Answer handler error:', error);
        } finally {
            this.commandAnswerHandlers.delete(userKey);
        }
    }
}

const botManagerInstance = new BotManager();
module.exports = botManagerInstance;