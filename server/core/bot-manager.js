// server/core/bot-manager.js - COMPLETELY FIXED AND OPTIMIZED
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');
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
                message: "Command executed successfully",
                chatId: msg.chat.id,
                command: command.command_patterns,
                result: result
            };
            
        } catch (error) {
            console.error(`❌ Command execution error for ${command.command_patterns}:`, error);
            throw error;
        }
    }

    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        
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
            params: params,
            nextCommandHandlers: this.nextCommandHandlers,
            
            User: {
                saveData: (key, value) => {
                    const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                    self.dataCache.set(cacheKey, value);
                    
                    self.saveData('user_data', botToken, msg.from.id, key, value)
                        .catch(err => console.error('❌ Background save error:', err));
                    
                    return value;
                },
                
                getData: (key) => {
                    const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                    if (self.dataCache.has(cacheKey)) {
                        return self.dataCache.get(cacheKey);
                    }
                    
                    return null;
                },
                
                deleteData: (key) => {
                    const cacheKey = `${botToken}_${msg.from.id}_${key}`;
                    self.dataCache.delete(cacheKey);
                    
                    self.deleteData('user_data', botToken, msg.from.id, key)
                        .catch(err => console.error('❌ Background delete error:', err));
                    
                    return true;
                }
            },
            
            Bot: {
                saveData: (key, value) => {
                    const cacheKey = `${botToken}_bot_${key}`;
                    self.dataCache.set(cacheKey, value);
                    
                    self.saveData('bot_data', botToken, null, key, value)
                        .catch(err => console.error('❌ Background bot save error:', err));
                    
                    return value;
                },
                
                getData: (key) => {
                    const cacheKey = `${botToken}_bot_${key}`;
                    if (self.dataCache.has(cacheKey)) {
                        return self.dataCache.get(cacheKey);
                    }
                    return null;
                },
                
                deleteData: (key) => {
                    const cacheKey = `${botToken}_bot_${key}`;
                    self.dataCache.delete(cacheKey);
                    
                    self.deleteData('bot_data', botToken, null, key)
                        .catch(err => console.error('❌ Background bot delete error:', err));
                    
                    return true;
                }
            }
        };
    }

    async processWaitForAnswer(userKey, answerText, answerMsg) {
        try {
            const waitingData = this.nextCommandHandlers.get(userKey);
            if (!waitingData) {
                console.log(`❌ No waiting data found for user: ${userKey}`);
                return;
            }

            console.log(`🎯 Processing waitForAnswer: "${answerText}"`);
            
            if (waitingData.resolve) {
                waitingData.resolve(answerText);
            }
            
            console.log(`✅ waitForAnswer resolved successfully`);
            
        } catch (error) {
            console.error('❌ waitForAnswer processing error:', error);
            
            const waitingData = this.nextCommandHandlers.get(userKey);
            if (waitingData && waitingData.reject) {
                waitingData.reject(error);
            }
        } finally {
            this.nextCommandHandlers.delete(userKey);
            console.log(`🧹 Cleaned waitForAnswer for ${userKey}`);
        }
    }

    async processCallbackAsCommand(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            const callbackData = data;
            
            console.log(`🔘 Processing callback as command: ${callbackData} from ${from.first_name}`);
            
            const commands = this.botCommands.get(token) || [];
            const matchingCommand = commands.find(cmd => {
                if (!cmd.command_patterns) return false;
                const patterns = cmd.command_patterns.split(',').map(p => p.trim());
                return patterns.includes(callbackData);
            });
            
            if (matchingCommand) {
                console.log(`🎯 Found command for callback: ${matchingCommand.command_patterns}`);
                
                const callbackMessage = {
                    chat: message.chat,
                    from: from,
                    message_id: message.message_id,
                    text: callbackData,
                    date: new Date().getTime() / 1000
                };
                
                await this.executeCommand(bot, matchingCommand, callbackMessage, callbackData);
            } else {
                console.log(`❌ No command found for callback: ${callbackData}`);
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: `Unknown command: ${callbackData}`,
                    show_alert: true 
                });
            }
            
        } catch (error) {
            console.error('❌ Callback command processing error:', error);
            
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
                    request: { 
                        concurrency: 10,
                        timeout: 30000
                    }
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
                    request: {
                        timeout: 30000
                    }
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
        bot.on('edited_message', (msg) => this.handleEditedMessage(bot, token, msg));
        bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
        
        // Optional handlers (commented out if not needed)
        // bot.on('photo', (msg) => this.handleMedia(bot, token, msg, 'photo'));
        // bot.on('video', (msg) => this.handleMedia(bot, token, msg, 'video'));
        // bot.on('document', (msg) => this.handleMedia(bot, token, msg, 'document'));
        // bot.on('audio', (msg) => this.handleMedia(bot, token, msg, 'audio'));
        // bot.on('voice', (msg) => this.handleMedia(bot, token, msg, 'voice'));
        // bot.on('sticker', (msg) => this.handleMedia(bot, token, msg, 'sticker'));
        // bot.on('location', (msg) => this.handleLocation(bot, token, msg));
        // bot.on('contact', (msg) => this.handleContact(bot, token, msg));
        // bot.on('poll', (poll) => this.handlePoll(bot, token, poll));
        // bot.on('poll_answer', (pollAnswer) => this.handlePollAnswer(bot, token, pollAnswer));
        // bot.on('inline_query', (inlineQuery) => this.handleInlineQuery(bot, token, inlineQuery));
        // bot.on('new_chat_members', (msg) => this.handleChatMember(bot, token, msg, 'new'));
        // bot.on('left_chat_member', (msg) => this.handleChatMember(bot, token, msg, 'left'));
        
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

            console.log(`📨 Message from ${msg.from.first_name} (${userId}): "${text}"`);

            // ১. FIRST - Check for waitForAnswer/ask promises
            if (this.nextCommandHandlers.has(userKey)) {
                console.log(`✅ WAIT FOR ANSWER HANDLER FOUND! Processing...`);
                const handlerData = this.nextCommandHandlers.get(userKey);
                
                if (handlerData && handlerData.resolve) {
                    console.log(`🎯 Resolving with: "${text}"`);
                    handlerData.resolve(text);
                    this.nextCommandHandlers.delete(userKey);
                    console.log(`✅ Resolved successfully`);
                    return;
                } else {
                    console.log(`❌ Handler data exists but resolve function missing`);
                    this.nextCommandHandlers.delete(userKey);
                }
            }

            // ২. Check for commands
            const command = await this.findMatchingCommand(token, text, msg);
            if (command) {
                await this.executeCommand(bot, command, msg, text);
                return;
            }

            // ৩. Unknown command response (Private Chat Only)
            if (msg.chat.type === 'private' && text) {
                const displayText = text.length > 20 ? text.substring(0, 20) + '...' : text;
                const safeText = displayText
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");

                await bot.sendMessage(
                    msg.chat.id, 
                    `❌ <b>Unknown Command:</b> <code>${safeText}</code>\n\nদুঃখিত, এই কমান্ডটি খুঁজে পাওয়া যায়নি।`, 
                    { parse_mode: 'HTML' }
                );
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    cleanupStaleHandlers() {
        const now = Date.now();
        const STALE_TIMEOUT = 10 * 60 * 1000;
        
        for (const [userKey, handlerData] of this.nextCommandHandlers.entries()) {
            if (now - handlerData.timestamp > STALE_TIMEOUT) {
                console.log(`🧹 Removing stale handler for ${userKey}`);
                if (handlerData.reject) {
                    handlerData.reject(new Error('Timeout: User took too long to respond.'));
                }
                this.nextCommandHandlers.delete(userKey);
            }
        }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            console.log(`🔘 Callback received: ${data} from ${from.first_name}`);

            // 1. Try to process as a command
            await this.processCallbackAsCommand(bot, token, callbackQuery);

            // Always answer the callback query
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

    async handleInlineQuery(bot, token, inlineQuery) {
        try {
            console.log(`🔍 Inline query: ${inlineQuery.query}`);
            // Basic inline query response
            await bot.answerInlineQuery(inlineQuery.id, []);
        } catch (error) {
            console.error('❌ Inline query error:', error);
        }
    }

    async handleEditedMessage(bot, token, msg) {
        console.log(`✏️ Edited message from ${msg.from.first_name}`);
    }

    async handleLocation(bot, token, msg) {
        console.log(`📍 Location from ${msg.from.first_name}`);
    }

    async handleContact(bot, token, msg) {
        console.log(`📞 Contact from ${msg.from.first_name}`);
    }

    async handlePoll(bot, token, poll) {
        console.log(`📊 Poll: ${poll.question}`);
    }

    async handlePollAnswer(bot, token, pollAnswer) {
        console.log(`🗳️ Poll answer received`);
    }

    async handleChatMember(bot, token, msg, type) {
        console.log(`👥 ${type === 'new' ? 'New' : 'Left'} chat member`);
    }

    async findMatchingCommand(token, text, msg) {
        const commands = this.botCommands.get(token) || [];
        
        for (const command of commands) {
            if (!command.command_patterns) continue;
            
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            
            for (const pattern of patterns) {
                // Exact match
                if (text === pattern) {
                    console.log(`✅ Exact match found: "${text}" = "${pattern}"`);
                    return command;
                }
                
                // Pattern দিয়ে শুরু হলে
                if (text.startsWith(pattern + ' ')) {
                    console.log(`✅ Pattern match found: "${text}" starts with "${pattern}"`);
                    return command;
                }
                
                // Alternative: slash ছাড়া pattern
                if (!pattern.startsWith('/') && text.startsWith('/' + pattern)) {
                    const patternWithSlash = '/' + pattern;
                    if (text === patternWithSlash || text.startsWith(patternWithSlash + ' ')) {
                        console.log(`✅ Alternative match found: "${text}" matches "${pattern}"`);
                        return command;
                    }
                }
            }
        }
        
        console.log(`❌ No matching command found for: "${text}"`);
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