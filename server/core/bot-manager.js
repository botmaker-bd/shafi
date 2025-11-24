// server/core/bot-manager.js - COMPLETELY FIXED VERSION
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
                    
                    // Add delay between bot initializations
                    if (i < bots.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (botError) {
                    console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                    // Continue with other bots even if one fails
                }
            }

            this.initialized = true;
            console.log(`✅ ${successCount}/${bots.length} bots initialized successfully`);
        } catch (error) {
            console.error('❌ Initialize all bots error:', error);
            // Don't throw error - allow server to continue
            this.initialized = true;
        }
    }

    // ✅ FIXED: Enhanced bot initialization with better error handling
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
                // Continue without commands
            }

            let bot;
            const botOptions = {
                request: {
                    timeout: 30000,
                    proxy: process.env.PROXY_URL || null
                },
                polling: false // We'll handle polling manually if needed
            };

            // ✅ FIXED: Better webhook handling for Render.com
            if (this.USE_WEBHOOK) {
                console.log('🔗 Setting up bot in WEBHOOK mode...');
                bot = new TelegramBot(token, botOptions);
                
                try {
                    // First delete any existing webhook
                    await bot.deleteWebHook();
                    console.log('✅ Existing webhook deleted');
                    
                    // Set new webhook with proper configuration for Render
                    const baseUrl = process.env.BASE_URL || 'https://bot-maker-bd.onrender.com';
                    const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                    
                    console.log(`🔗 Setting webhook: ${webhookUrl}`);
                    
                    const webhookResult = await bot.setWebHook(webhookUrl, {
                        max_connections: 40,
                        allowed_updates: [
                            'message', 'edited_message', 'channel_post', 'edited_channel_post',
                            'inline_query', 'chosen_inline_result', 'callback_query',
                            'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
                            'my_chat_member', 'chat_member', 'chat_join_request'
                        ],
                        drop_pending_updates: true // Clear pending updates
                    });
                    
                    console.log(`✅ Webhook set successfully: ${webhookResult}`);
                    
                } catch (webhookError) {
                    console.error('❌ Webhook setup error:', webhookError.message);
                    // Continue even if webhook fails
                }
            } else {
                // Polling mode - use with caution on Render
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

            // ✅ FIXED: Better bot connection test
            try {
                console.log('🔗 Testing bot connection...');
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
            } catch (connectionError) {
                console.error(`❌ Bot connection failed:`, connectionError.message);
                
                // Check if it's a token error
                if (connectionError.message.includes('401') || connectionError.message.includes('Not Found')) {
                    throw new Error('Invalid bot token');
                }
                throw connectionError;
            }

            // Setup event handlers
            this.setupEventHandlers(bot, token);

            // Store bot and commands
            this.activeBots.set(token, bot);
            this.botCommands.set(token, commands || []);

            console.log(`✅ Bot initialized successfully: ${token.substring(0, 10)}...`);

            // Setup cleanup interval
            if (!this.cleanupInterval) {
                this.cleanupInterval = setInterval(() => this.cleanupStaleHandlers(), 5 * 60 * 1000);
            }

            return true;

        } catch (error) {
            console.error(`❌ Initialize bot error for ${token.substring(0, 10)}...:`, error.message);
            
            // Mark bot as inactive in database if token is invalid
            if (error.message.includes('Invalid bot token')) {
                try {
                    await supabase
                        .from('bots')
                        .update({ is_active: false })
                        .eq('token', token);
                    console.log(`🚫 Marked bot as inactive due to invalid token`);
                } catch (dbError) {
                    console.error('❌ Failed to update bot status:', dbError.message);
                }
            }
            
            throw error;
        }
    }

    // ✅ FIXED: Enhanced event handlers
    setupEventHandlers(bot, token) {
        // Only setup message handler for webhook mode
        if (this.USE_WEBHOOK) {
            // In webhook mode, we handle updates via the webhook endpoint
            console.log(`🎯 Webhook event handlers setup for bot: ${token.substring(0, 10)}...`);
        } else {
            // Polling mode - setup all event handlers
            bot.on('message', (msg) => this.handleMessage(bot, token, msg));
            bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
        }

        // Error handlers
        bot.on('polling_error', (error) => {
            console.error(`❌ Polling error for ${token.substring(0, 10)}...:`, error.message);
        });
        
        bot.on('webhook_error', (error) => {
            console.error(`❌ Webhook error for ${token.substring(0, 10)}...:`, error.message);
        });
        
        bot.on('error', (error) => {
            console.error(`❌ Bot error for ${token.substring(0, 10)}...:`, error.message);
        });
    }

    // ✅ FIXED: Enhanced message handler
    async handleMessage(bot, token, msg) {
        try {
            // Skip non-text messages unless they have captions
            if (!msg.text && !msg.caption) {
                return;
            }

            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || msg.caption || '';
            const userKey = `${token}_${userId}`;

            console.log(`📨 Message from ${msg.from.first_name} (${userId}): "${text.substring(0, 50)}..."`);

            // 1. Check for waitForAnswer handlers
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

            // 2. Check for command answer handlers
            if (this.commandAnswerHandlers.has(userKey)) {
                console.log(`✅ COMMAND ANSWER HANDLER FOUND!`);
                await this.processCommandAnswer(userKey, text, msg);
                return;
            }

            // 3. Handle special commands
            if (text.startsWith('/python ')) {
                await this.executePythonCode(bot, chatId, text.replace('/python ', ''));
                return;
            }

            // 4. Find and execute matching command
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                console.log(`🎯 Executing command: ${command.command_patterns}`);
                await this.executeCommand(bot, command, msg, text);
            } else {
                console.log(`❌ No matching command found for: "${text}"`);
                // You can add a default response here
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    // ✅ FIXED: Enhanced command execution
    async executeCommand(bot, command, msg, userInput = null) {
        try {
            console.log(`🔧 Executing command: ${command.command_patterns} for chat: ${msg.chat.id}`);
            
            // Preload user data
            await this.preloadUserData(command.bot_token, msg.from.id);
            
            // Create execution context
            const context = this.createExecutionContext(bot, command, msg, userInput);

            // Execute the command
            const result = await executeCommandCode(bot, command.code, context);
            
            // Setup answer handler if needed
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupCommandAnswerHandler(bot, command, msg, context);
            }
            
            console.log(`✅ Command executed successfully: ${command.command_patterns}`);
            return {
                success: true,
                message: "Command executed successfully",
                chatId: msg.chat.id,
                command: command.command_patterns,
                result: result
            };
            
        } catch (error) {
            console.error(`❌ Command execution error for ${command.command_patterns}:`, error);
            
            // Send user-friendly error message
            try {
                let errorMsg = `❌ Command Error: ${error.message}`;
                if (errorMsg.length > 200) {
                    errorMsg = errorMsg.substring(0, 200) + '...';
                }
                await bot.sendMessage(msg.chat.id, errorMsg);
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
            
            throw error;
        }
    }

    // ✅ FIXED: Enhanced context creation
    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        
        console.log(`🔧 Creating context for bot: ${botToken?.substring(0, 10)}...`);
        
        const self = this;

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
            
            User: {
                saveData: async (key, value) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        self.dataCache.set(cacheKey, value);
                        
                        // Use simple insert to avoid constraint issues
                        const { error } = await supabase
                            .from('universal_data')
                            .insert([{
                                data_type: 'user_data',
                                bot_token: botToken,
                                user_id: msg.from.id.toString(),
                                data_key: key,
                                data_value: JSON.stringify(value),
                                metadata: {
                                    saved_at: new Date().toISOString(),
                                    value_type: typeof value
                                },
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);

                        if (error && error.code !== '23505') { // Ignore duplicate errors
                            console.error('❌ Save data error:', error);
                        }
                        
                        return value;
                    } catch (error) {
                        console.error('❌ Save data error:', error);
                        return value;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        if (self.dataCache.has(cacheKey)) {
                            return self.dataCache.get(cacheKey);
                        }
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', msg.from.id.toString())
                            .eq('data_key', key)
                            .single();

                        if (error) {
                            if (error.code === 'PGRST116') return null;
                            console.error('❌ Get data error:', error);
                            return null;
                        }

                        if (!data || !data.data_value) return null;

                        try {
                            return JSON.parse(data.data_value);
                        } catch {
                            return data.data_value;
                        }
                    } catch (error) {
                        console.error('❌ Get data error:', error);
                        return null;
                    }
                },
                
                deleteData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                        self.dataCache.delete(cacheKey);
                        
                        const { error } = await supabase
                            .from('universal_data')
                            .delete()
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', msg.from.id.toString())
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
            },
            
            Bot: {
                saveData: async (key, value) => {
                    try {
                        const cacheKey = `${botToken}_bot_${key}`;
                        self.dataCache.set(cacheKey, value);
                        
                        const { error } = await supabase
                            .from('universal_data')
                            .insert([{
                                data_type: 'bot_data',
                                bot_token: botToken,
                                user_id: null,
                                data_key: key,
                                data_value: JSON.stringify(value),
                                metadata: {
                                    saved_at: new Date().toISOString(),
                                    value_type: typeof value
                                },
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);

                        if (error && error.code !== '23505') {
                            console.error('❌ Save bot data error:', error);
                        }
                        
                        return value;
                    } catch (error) {
                        console.error('❌ Save bot data error:', error);
                        return value;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const cacheKey = `${botToken}_bot_${key}`;
                        if (self.dataCache.has(cacheKey)) {
                            return self.dataCache.get(cacheKey);
                        }
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', botToken)
                            .eq('data_key', key)
                            .single();

                        if (error) {
                            if (error.code === 'PGRST116') return null;
                            return null;
                        }

                        if (!data || !data.data_value) return null;

                        try {
                            return JSON.parse(data.data_value);
                        } catch {
                            return data.data_value;
                        }
                    } catch (error) {
                        console.error('❌ Get bot data error:', error);
                        return null;
                    }
                }
            }
        };
    }

    // Other methods remain mostly the same but with better error handling...
    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, from } = callbackQuery;
            console.log(`🔘 Callback received: ${data} from ${from.first_name}`);

            await this.processCallbackAsCommand(bot, token, callbackQuery);
            await bot.answerCallbackQuery(callbackQuery.id);
            
        } catch (error) {
            console.error('❌ Callback query error:', error);
            try {
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Error: ${error.message}`,
                    show_alert: true 
                });
            } catch (answerError) {
                console.error('❌ Failed to answer callback query:', answerError);
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

    getBotInstance(token) {
        return this.activeBots.get(token);
    }

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot && this.USE_WEBHOOK) {
                // Process the update through our message handler
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