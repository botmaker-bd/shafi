const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.nextCommandHandlers = new Map();
        this.initialized = false;
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        
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
            
            // Add delay between bot initializations to avoid rate limiting
            for (let i = 0; i < bots.length; i++) {
                const bot = bots[i];
                try {
                    await this.initializeBotWithRetry(bot.token);
                    successCount++;
                    
                    // Add delay between bot initializations (2 seconds)
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

    async initializeBotWithRetry(token, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            return await this.initializeBot(token);
        } catch (error) {
            if (error.response?.body?.error_code === 429 && retryCount < maxRetries) {
                const retryAfter = error.response.body.parameters?.retry_after || 5;
                console.log(`⏳ Rate limited. Retrying after ${retryAfter} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);
                
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return await this.initializeBotWithRetry(token, retryCount + 1);
            }
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

            if (error) {
                console.error('❌ Database error fetching commands:', error);
                throw error;
            }

            console.log(`📝 Found ${commands?.length || 0} commands for bot`);

            let bot;
            
            if (this.USE_WEBHOOK) {
                // Webhook mode
                bot = new TelegramBot(token, { 
                    polling: false,
                    // Add request concurrency limits
                    request: {
                        concurrency: 1,
                        maxRetries: 3,
                        retryDelay: 1000
                    }
                });
                
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                console.log(`🌐 Setting webhook: ${webhookUrl}`);
                
                try {
                    // Delete existing webhook first
                    await bot.deleteWebHook();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Then set new webhook
                    await bot.setWebHook(webhookUrl);
                    console.log(`✅ Webhook set successfully`);
                } catch (webhookError) {
                    console.error('❌ Webhook setup error:', webhookError.message);
                    // Continue even if webhook fails - bot might work in polling mode
                }
            } else {
                // Polling mode with limits
                bot = new TelegramBot(token, { 
                    polling: {
                        interval: 1000, // 1 second interval
                        autoStart: true,
                        params: {
                            timeout: 10
                        }
                    },
                    request: {
                        concurrency: 1,
                        maxRetries: 3,
                        retryDelay: 1000
                    }
                });
                
                console.log(`🔄 Polling started for bot: ${token.substring(0, 15)}...`);
            }

            // Set up event handlers
            bot.on('message', (msg) => {
                console.log(`📨 Message received for bot ${token.substring(0, 10)}...`);
                this.handleMessage(bot, token, msg);
            });
            
            bot.on('callback_query', (callbackQuery) => {
                console.log(`🔘 Callback received for bot ${token.substring(0, 10)}...`);
                this.handleCallbackQuery(bot, token, callbackQuery);
            });
            
            bot.on('polling_error', (error) => {
                console.error(`❌ Polling error for ${token.substring(0, 15)}...:`, error.message);
            });
            
            bot.on('webhook_error', (error) => {
                console.error(`❌ Webhook error for ${token.substring(0, 15)}...:`, error.message);
            });

            // Test bot connection
            try {
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`);
            } catch (botError) {
                console.error(`❌ Bot connection failed:`, botError.message);
                // Don't throw error - continue with initialization
            }

            // Store bot and commands
            this.activeBots.set(token, bot);
            this.botCommands.set(token, commands || []);

            console.log(`✅ Bot initialized: ${token.substring(0, 15)}... (${commands?.length || 0} commands)`);
            return true;
        } catch (error) {
            console.error(`❌ Initialize bot error for ${token.substring(0, 15)}...:`, error.message);
            throw error;
        }
    }

    // ... rest of the methods remain the same as previous version
    async handleMessage(bot, token, msg) {
        try {
            if (!msg.text && !msg.caption) return;

            const chatId = msg.chat.id;
            const text = msg.text || msg.caption || '';
            const userId = msg.from.id;
            const userName = msg.from.first_name || 'Unknown';

            console.log(`📩 Message from ${userName} (${userId}): "${text}"`);

            // Check for next command handler
            const nextCommandKey = `${token}_${userId}`;
            if (this.nextCommandHandlers.has(nextCommandKey)) {
                console.log(`🔄 Found next command handler for user ${userId}`);
                const handler = this.nextCommandHandlers.get(nextCommandKey);
                this.nextCommandHandlers.delete(nextCommandKey);
                
                try {
                    await handler(text, msg);
                } catch (handlerError) {
                    console.error('❌ Next command handler error:', handlerError);
                    await bot.sendMessage(chatId, '❌ Error processing your response. Please try again.');
                }
                return;
            }

            // Find matching command
            const commands = this.botCommands.get(token) || [];
            let matchedCommand = null;
            let commandParams = null;

            for (const command of commands) {
                if (!command.command_patterns) continue;
                
                const patterns = command.command_patterns.split(',').map(p => p.trim());
                
                for (const pattern of patterns) {
                    if (text === pattern) {
                        matchedCommand = command;
                        commandParams = null;
                        break;
                    } else if (text.startsWith(pattern + ' ')) {
                        matchedCommand = command;
                        commandParams = text.substring(pattern.length + 1).trim();
                        break;
                    }
                }
                if (matchedCommand) break;
            }

            if (matchedCommand) {
                console.log(`🎯 Executing command: ${matchedCommand.command_patterns}`);
                await this.executeCommand(bot, matchedCommand, msg, commandParams);
            }
        } catch (error) {
            console.error('❌ Handle message error:', error);
            try {
                await bot.sendMessage(msg.chat.id, '❌ An error occurred while processing your message.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    async executeCommand(bot, command, msg, params = null) {
        try {
            const context = {
                msg: msg,
                chatId: msg.chat.id,
                userId: msg.from.id,
                username: msg.from.username,
                first_name: msg.from.first_name,
                botToken: command.bot_token,
                userInput: params,
                
                User: {
                    saveData: (key, value) => 
                        this.saveData('user_data', command.bot_token, msg.from.id, key, value),
                    getData: (key) => 
                        this.getData('user_data', command.bot_token, msg.from.id, key),
                    deleteData: (key) => 
                        this.deleteData('user_data', command.bot_token, msg.from.id, key)
                },
                
                Bot: {
                    saveData: (key, value) => 
                        this.saveData('bot_data', command.bot_token, null, key, value),
                    getData: (key) => 
                        this.getData('bot_data', command.bot_token, null, key)
                }
            };

            await this.executeCommandCode(bot, command.code, context);
        } catch (error) {
            console.error(`❌ Command execution error:`, error);
            try {
                await bot.sendMessage(msg.chat.id, '❌ Command execution failed. Please try again.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    async executeCommandCode(bot, code, context) {
        return new Promise(async (resolve, reject) => {
            try {
                const { msg, chatId, userId, username, first_name, botToken, userInput, User, Bot } = context;
                
                const botFunctions = {
                    sendMessage: (text, options = {}) => {
                        return bot.sendMessage(chatId, text, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    send: (text, options = {}) => {
                        return bot.sendMessage(chatId, text, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    reply: (text, options = {}) => {
                        return bot.sendMessage(chatId, text, {
                            reply_to_message_id: msg.message_id,
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    sendPhoto: (photo, options = {}) => {
                        return bot.sendPhoto(chatId, photo, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    sendDocument: (document, options = {}) => {
                        return bot.sendDocument(chatId, document, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    getUser: () => ({
                        id: userId,
                        username: username,
                        first_name: first_name,
                        chat_id: chatId
                    }),
                    
                    params: userInput,
                    userInput: userInput,
                    message: msg,
                    User: User,
                    Bot: Bot,
                    
                    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                    
                    waitForAnswer: (question, options = {}) => {
                        return new Promise((resolve) => {
                            const nextCommandKey = `${botToken}_${userId}`;
                            
                            bot.sendMessage(chatId, question, options).then(() => {
                                this.nextCommandHandlers.set(nextCommandKey, (answer) => {
                                    resolve(answer);
                                });
                            }).catch(reject);
                        });
                    }
                };

                const commandFunction = new Function(
                    ...Object.keys(botFunctions),
                    `
                    "use strict";
                    try {
                        ${code}
                    } catch (error) {
                        console.error('Command execution error:', error);
                        throw error;
                    }
                    `
                );

                const result = commandFunction(...Object.values(botFunctions));
                
                if (result && typeof result.then === 'function') {
                    const finalResult = await result;
                    resolve(finalResult);
                } else {
                    resolve(result);
                }
            } catch (error) {
                console.error('❌ Command execution error:', error);
                reject(error);
            }
        });
    }

    // ... rest of the data storage methods remain the same
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

            if (error) throw error;
            return value;
        } catch (error) {
            console.error('❌ Save data error:', error);
            throw error;
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
                throw error;
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

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Delete data error:', error);
            return false;
        }
    }

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot) {
                await bot.processUpdate(update);
            }
        } catch (error) {
            console.error('❌ Handle bot update error:', error);
        }
    }

    getBotInstance(token) {
        return this.activeBots.get(token);
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

            if (error) throw error;
            this.botCommands.set(token, commands || []);
        } catch (error) {
            console.error('❌ Update command cache error:', error);
            throw error;
        }
    }

    getBotStatus() {
        return {
            totalBots: this.activeBots.size,
            initialized: this.initialized,
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