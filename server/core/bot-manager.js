const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const { executeCommandCode } = require('./command-executor');
const { runPythonCode, installPythonLibrary } = require('./python-runner');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.nextCommandHandlers = new Map();
        this.initialized = false;
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    // Universal data storage methods
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
                throw error;
            }
            
            console.log(`💾 Data saved: ${dataType}.${key} for user ${userId}`);
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
                if (error.code === 'PGRST116') { // No data found
                    return null;
                }
                throw error;
            }
            
            if (data && data.data_value) {
                try {
                    return JSON.parse(data.data_value);
                } catch (parseError) {
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
            
            console.log(`🗑️ Data deleted: ${dataType}.${key} for user ${userId}`);
            return true;
        } catch (error) {
            console.error('❌ Delete data error:', error);
            return false;
        }
    }

    async getAllUserData(botToken, userId) {
        try {
            const { data, error } = await supabase
                .from('universal_data')
                .select('*')
                .eq('bot_token', botToken)
                .eq('user_id', userId ? userId.toString() : null);

            if (error) throw error;
            
            const result = {};
            data.forEach(item => {
                try {
                    result[item.data_key] = JSON.parse(item.data_value);
                } catch {
                    result[item.data_key] = item.data_value;
                }
            });
            
            return result;
        } catch (error) {
            console.error('❌ Get all user data error:', error);
            return {};
        }
    }

    // Bot management methods
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

            if (!bots || bots.length === 0) {
                console.log('ℹ️ No active bots found in database');
                this.initialized = true;
                return;
            }

            let successCount = 0;
            for (const bot of bots) {
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

            let bot;
            
            if (this.USE_WEBHOOK) {
                // Webhook mode
                bot = new TelegramBot(token, { 
                    polling: false,
                    request: {
                        timeout: 30000,
                        agentOptions: {
                            keepAlive: true,
                            maxSockets: 100
                        }
                    }
                });
                
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                try {
                    await bot.setWebHook(webhookUrl, {
                        max_connections: 100,
                        allowed_updates: ['message', 'callback_query', 'inline_query']
                    });
                    console.log(`🌐 Webhook set: ${webhookUrl}`);
                } catch (webhookError) {
                    console.error('❌ Webhook setup error:', webhookError);
                    throw webhookError;
                }
            } else {
                // Polling mode
                bot = new TelegramBot(token, { 
                    polling: {
                        interval: 300,
                        autoStart: true,
                        params: {
                            timeout: 10,
                            limit: 100
                        }
                    },
                    request: {
                        timeout: 30000
                    }
                });
                
                console.log(`🔄 Polling started for bot: ${token.substring(0, 15)}...`);
            }

            // Set up event handlers
            bot.on('message', (msg) => this.handleMessage(bot, token, msg));
            bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
            bot.on('polling_error', (error) => {
                console.error(`❌ Polling error for ${token.substring(0, 15)}...:`, error.message);
            });
            bot.on('webhook_error', (error) => {
                console.error(`❌ Webhook error for ${token.substring(0, 15)}...:`, error.message);
            });

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

    async handleMessage(bot, token, msg) {
    try {
        if (!msg.text && !msg.caption) return;

        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || '';
        const userId = msg.from.id;
        const userName = msg.from.first_name || 'Unknown';

        console.log(`📩 Message from ${userName} (${userId}): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

        // Check for next command handler
        const nextCommandKey = `${token}_${userId}`;
        if (this.nextCommandHandlers.has(nextCommandKey)) {
            const handler = this.nextCommandHandlers.get(nextCommandKey);
            this.nextCommandHandlers.delete(nextCommandKey);
            
            console.log(`🔄 Executing next command handler for user ${userId}`);
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
            if (!command.mainCommand) continue;
            
            // Check mainCommand
            if (text === command.mainCommand) {
                matchedCommand = command;
                commandParams = null;
                break;
            } else if (text.startsWith(command.mainCommand + ' ')) {
                matchedCommand = command;
                commandParams = text.substring(command.mainCommand.length + 1).trim();
                break;
            }
            
            // Check multipleCommand
            if (command.multipleCommand) {
                const patterns = command.multipleCommand.split(',').map(p => p.trim());
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
        }

        if (matchedCommand) {
            console.log(`🎯 Executing command: ${matchedCommand.mainCommand} with params: ${commandParams || 'none'}`);
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

    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const data = callbackQuery.data;
            const userId = callbackQuery.from.id;
            const userName = callbackQuery.from.first_name || 'Unknown';

            console.log(`🔘 Callback from ${userName} (${userId}): "${data}"`);

            // Handle callback with next command handler
            const nextCommandKey = `${token}_${userId}`;
            if (this.nextCommandHandlers.has(nextCommandKey)) {
                const handler = this.nextCommandHandlers.get(nextCommandKey);
                this.nextCommandHandlers.delete(nextCommandKey);
                
                console.log(`🔄 Executing next command handler for callback from user ${userId}`);
                try {
                    await handler(data, callbackQuery);
                } catch (handlerError) {
                    console.error('❌ Callback handler error:', handlerError);
                }
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Handle callback error:', error);
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
                
                // Universal data methods
                Data: {
                    save: (dataType, key, value, metadata = {}) => 
                        this.saveData(dataType, command.bot_token, msg.from.id, key, value, metadata),
                    get: (dataType, key) => 
                        this.getData(dataType, command.bot_token, msg.from.id, key),
                    delete: (dataType, key) => 
                        this.deleteData(dataType, command.bot_token, msg.from.id, key),
                    getAll: () =>
                        this.getAllUserData(command.bot_token, msg.from.id)
                },
                
                // Python execution
                Python: {
                    run: (code, inputData = null) => runPythonCode(code, inputData),
                    install: (libraryName) => installPythonLibrary(libraryName)
                }
            };

            await executeCommandCode(bot, command.code, context);
        } catch (error) {
            console.error(`❌ Command execution error for "${command.pattern}":`, error);
            try {
                await bot.sendMessage(msg.chat.id, '❌ Command execution failed. Please try again.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        }
    }

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot) {
                await bot.processUpdate(update);
            } else {
                console.error(`❌ No active bot found for token: ${token.substring(0, 15)}...`);
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
                bot.deleteWebHook().catch(error => {
                    console.error('❌ Error deleting webhook:', error);
                });
            }
            this.activeBots.delete(token);
            this.botCommands.delete(token);
            console.log(`🛑 Bot removed: ${token.substring(0, 15)}...`);
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
            console.log(`🔄 Command cache updated for bot: ${token.substring(0, 15)}... (${commands?.length || 0} commands)`);
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

// Create singleton instance
const botManagerInstance = new BotManager();

// Export the instance
module.exports = botManagerInstance;