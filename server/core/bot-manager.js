const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const { executeCommandCode } = require('./command-executor');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.nextCommandHandlers = new Map();
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
                console.log('ℹ️ No active bots found');
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
            console.log(`✅ ${successCount}/${bots.length} bots initialized`);
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
            if (bot) {
                await bot.processUpdate(update);
            }
        } catch (error) {
            console.error('❌ Handle bot update error:', error);
        }
    }

    async executeCommand(bot, command, msg, userInput = null) {
        try {
            console.log(`🔧 Executing command: ${command.command_patterns} for chat: ${msg.chat.id}`);
            
            await this.preloadUserData(command.bot_token, msg.from.id);
            
            const context = this.createExecutionContext(bot, command, msg, userInput);

            const result = await executeCommandCode(bot, command.code, context);
            
            console.log(`✅ Command executed successfully: ${command.command_patterns}`);
            return {
                success: true,
                message: "Command executed",
                chatId: msg.chat.id,
                command: command.command_patterns,
                result: result
            };
            
        } catch (error) {
            console.error(`❌ Command execution error for ${command.command_patterns}:`, error);
            throw error;
        }
    }

    // ✅ CORRECT: Context creation without duplicate Bot/User objects
    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        
        // Extract params
        let params = '';
        if (userInput && command.command_patterns) {
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            
            for (const pattern of patterns) {
                if (userInput === pattern) {
                    params = '';
                    break;
                }
                if (userInput.startsWith(pattern + ' ')) {
                    params = userInput.substring(pattern.length).trim();
                    break;
                }
            }
        }
        
        // ✅ ask function for command-executor
        const askFunction = async (question, options = {}) => {
            const userKey = `${botToken}_${msg.from.id}`;
            
            return new Promise((resolveWait, rejectWait) => {
                bot.sendMessage(msg.chat.id, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (this.nextCommandHandlers.has(userKey)) {
                            this.nextCommandHandlers.delete(userKey);
                            rejectWait(new Error('Timeout: User took too long to respond.'));
                        }
                    }, 5 * 60 * 1000);

                    this.nextCommandHandlers.set(userKey, {
                        resolve: (ans) => { 
                            clearTimeout(timeout); 
                            resolveWait(ans); 
                        },
                        reject: (err) => { 
                            clearTimeout(timeout); 
                            rejectWait(err); 
                        },
                        timestamp: Date.now(),
                        bot: bot
                    });
                }).catch(e => rejectWait(e));
            });
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
            params: params,
            nextCommandHandlers: this.nextCommandHandlers,
            
            // ✅ ask and waitForAnswer functions (required by command-executor)
            ask: askFunction,
            waitForAnswer: askFunction,  // alias
            
            // ❌ DON'T add Bot or User objects here - they're created in command-executor
            // command-executor.js will create proper Bot and User objects with saveData/getData/etc
        };
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

    async initializeBot(token) {
        try {
            console.log(`🔄 Initializing bot: ${token.substring(0, 15)}...`);

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
                    request: { timeout: 30000 }
                });
                
                const baseUrl = process.env.BASE_URL;
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                await bot.deleteWebHook();
                await bot.setWebHook(webhookUrl, {
                    max_connections: 100,
                    allowed_updates: [
                        'message', 'edited_message', 'channel_post', 'edited_channel_post',
                        'inline_query', 'chosen_inline_result', 'callback_query',
                        'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
                        'my_chat_member', 'chat_member', 'chat_join_request'
                    ]
                });
                console.log(`✅ Webhook set: ${webhookUrl}`);
            } else {
                bot = new TelegramBot(token, { 
                    polling: {
                        interval: 1000,
                        autoStart: true,
                        params: { 
                            timeout: 10,
                            allowed_updates: [
                                'message', 'edited_message', 'channel_post', 'edited_channel_post',
                                'inline_query', 'chosen_inline_result', 'callback_query',
                                'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
                                'my_chat_member', 'chat_member', 'chat_join_request'
                            ]
                        }
                    },
                    request: { timeout: 30000 }
                });
            }

            this.setupEventHandlers(bot, token);

            try {
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username}`);
            } catch (botError) {
                console.error(`❌ Bot connection failed:`, botError.message);
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
        
        // Optional handlers (remove if not needed)
        bot.on('edited_message', (msg) => console.log(`✏️ Edited message`));
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

            console.log(`📨 Message from ${msg.from.first_name}: "${text}"`);

            // ✅ 1. Check for ask/waitForAnswer handlers
            if (this.nextCommandHandlers.has(userKey)) {
                console.log(`✅ ASK HANDLER FOUND! Processing answer...`);
                const handlerData = this.nextCommandHandlers.get(userKey);
                
                if (handlerData && handlerData.resolve) {
                    handlerData.resolve(text);
                    this.nextCommandHandlers.delete(userKey);
                    console.log(`✅ Answer processed successfully`);
                    return;
                } else {
                    this.nextCommandHandlers.delete(userKey);
                }
            }

            // 2. Check for commands
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                await this.executeCommand(bot, command, msg, text);
                return;
            }

            // 3. Unknown command (private chat only)
            if (msg.chat.type === 'private') {
                const safeText = text.substring(0, 20);
                await bot.sendMessage(
                    chatId, 
                    `❌ <b>Unknown Command:</b> <code>${safeText}</code>`,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            console.log(`🔘 Callback: ${data} from ${from.first_name}`);

            // Process as command
            const commands = this.botCommands.get(token) || [];
            const matchingCommand = commands.find(cmd => {
                if (!cmd.command_patterns) return false;
                const patterns = cmd.command_patterns.split(',').map(p => p.trim());
                return patterns.includes(data);
            });
            
            if (matchingCommand) {
                console.log(`🎯 Found command for callback: ${matchingCommand.command_patterns}`);
                
                const callbackMessage = {
                    chat: message.chat,
                    from: from,
                    message_id: message.message_id,
                    text: data,
                    date: new Date().getTime() / 1000
                };
                
                await this.executeCommand(bot, matchingCommand, callbackMessage, data);
            }

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

    cleanupStaleHandlers() {
        const now = Date.now();
        const STALE_TIMEOUT = 10 * 60 * 1000;
        
        for (const [userKey, handlerData] of this.nextCommandHandlers.entries()) {
            if (now - handlerData.timestamp > STALE_TIMEOUT) {
                console.log(`🧹 Removing stale handler for ${userKey}`);
                if (handlerData.reject) {
                    handlerData.reject(new Error('Wait for answer timeout'));
                }
                this.nextCommandHandlers.delete(userKey);
            }
        }
    }

    async findMatchingCommand(token, text, msg) {
        const commands = this.botCommands.get(token) || [];
        
        for (const command of commands) {
            if (!command.command_patterns) continue;
            
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            
            for (const pattern of patterns) {
                if (text === pattern) {
                    console.log(`✅ Exact match: "${text}" = "${pattern}"`);
                    return command;
                }
                
                if (text.startsWith(pattern + ' ')) {
                    console.log(`✅ Pattern match: "${text}" starts with "${pattern}"`);
                    return command;
                }
                
                if (!pattern.startsWith('/') && text.startsWith('/' + pattern)) {
                    const patternWithSlash = '/' + pattern;
                    if (text === patternWithSlash || text.startsWith(patternWithSlash + ' ')) {
                        console.log(`✅ Alternative match: "${text}" matches "${pattern}"`);
                        return command;
                    }
                }
            }
        }
        
        console.log(`❌ No matching command for: "${text}"`);
        return null;
    }

    async sendError(bot, chatId, error) {
        try {
            await bot.sendMessage(chatId, `❌ Error: ${error.message}`, { parse_mode: 'HTML' });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
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
            console.log(`✅ Updated command cache: ${commands?.length || 0} commands`);
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