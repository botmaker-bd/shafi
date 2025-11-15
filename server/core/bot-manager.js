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
        this.userStates = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        this.initialized = false;
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    // ✅ ADD MISSING METHODS
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

    // ✅ ADD THIS MISSING METHOD
    getBotInstance(token) {
        return this.activeBots.get(token);
    }

    // ✅ ADD THIS MISSING METHOD
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

    // ✅ ADD THIS MISSING METHOD - Command execution
    // server/core/bot-manager.js - executeCommand মেথড
// server/core/bot-manager.js - executeCommand method
async executeCommand(bot, command, msg, userInput = null) {
    try {
        console.log(`🔧 Executing command: ${command.command_patterns} for chat: ${msg.chat.id}`);
        
        // Create enhanced execution context
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
            nextCommandHandlers: this.nextCommandHandlers,
            
            // Enhanced data operations
            User: {
                saveData: (key, value) => this.saveData('user_data', command.bot_token, msg.from.id, key, value),
                getData: (key) => this.getData('user_data', command.bot_token, msg.from.id, key),
                deleteData: (key) => this.deleteData('user_data', command.bot_token, msg.from.id, key),
                getAllData: async () => {
                    const { data, error } = await supabase
                        .from('universal_data')
                        .select('data_key, data_value')
                        .eq('data_type', 'user_data')
                        .eq('bot_token', command.bot_token)
                        .eq('user_id', msg.from.id.toString());
                    
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
                }
            },
            
            Bot: {
                saveData: (key, value) => this.saveData('bot_data', command.bot_token, null, key, value),
                getData: (key) => this.getData('bot_data', command.bot_token, null, key),
                deleteData: async (key) => {
                    const { error } = await supabase
                        .from('universal_data')
                        .delete()
                        .eq('data_type', 'bot_data')
                        .eq('bot_token', command.bot_token)
                        .eq('data_key', key);
                    return !error;
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

            // Setup ALL Telegram event handlers
            this.setupEventHandlers(bot, token);

            // Test connection
            try {
                const botInfo = await bot.getMe();
                console.log(`✅ Bot connected: @${botInfo.username}`);
            } catch (botError) {
                console.error(`❌ Bot connection failed:`, botError.message);
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
        // Message handlers
        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
        bot.on('edited_message', (msg) => this.handleEditedMessage(bot, token, msg));
        
        // Media handlers
        bot.on('photo', (msg) => this.handleMedia(bot, token, msg, 'photo'));
        bot.on('video', (msg) => this.handleMedia(bot, token, msg, 'video'));
        bot.on('document', (msg) => this.handleMedia(bot, token, msg, 'document'));
        bot.on('audio', (msg) => this.handleMedia(bot, token, msg, 'audio'));
        bot.on('voice', (msg) => this.handleMedia(bot, token, msg, 'voice'));
        bot.on('sticker', (msg) => this.handleMedia(bot, token, msg, 'sticker'));
        
        // Location & Contact
        bot.on('location', (msg) => this.handleLocation(bot, token, msg));
        bot.on('contact', (msg) => this.handleContact(bot, token, msg));
        
        // Poll handlers
        bot.on('poll', (poll) => this.handlePoll(bot, token, poll));
        bot.on('poll_answer', (pollAnswer) => this.handlePollAnswer(bot, token, pollAnswer));
        
        // Callback queries (inline buttons)
        bot.on('callback_query', (callbackQuery) => this.handleCallbackQuery(bot, token, callbackQuery));
        
        // Inline queries
        bot.on('inline_query', (inlineQuery) => this.handleInlineQuery(bot, token, inlineQuery));
        
        // Chat events
        bot.on('new_chat_members', (msg) => this.handleChatMember(bot, token, msg, 'new'));
        bot.on('left_chat_member', (msg) => this.handleChatMember(bot, token, msg, 'left'));
        
        // Error handlers
        bot.on('polling_error', (error) => console.error(`❌ Polling error:`, error));
        bot.on('webhook_error', (error) => console.error(`❌ Webhook error:`, error));
        bot.on('error', (error) => console.error(`❌ Bot error:`, error));
    }

    async handleMessage(bot, token, msg) {
        try {
            // Skip non-text messages without caption
            if (!msg.text && !msg.caption) return;

            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || msg.caption || '';

            console.log(`📨 Message from ${msg.from.first_name}: "${text}"`);

            // Check for next command handler
            const nextCommandKey = `${token}_${userId}`;
            if (this.nextCommandHandlers.has(nextCommandKey)) {
                const handler = this.nextCommandHandlers.get(nextCommandKey);
                this.nextCommandHandlers.delete(nextCommandKey);
                await handler(text, msg);
                return;
            }

            // Handle Python code execution
            if (text.startsWith('/python ')) {
                await this.executePythonCode(bot, chatId, text.replace('/python ', ''));
                return;
            }

            // Handle AI code generation
            if (text.startsWith('/ai ') || text.startsWith('/generate ')) {
                await this.generateAICode(bot, chatId, text);
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

            // Execute callback handler
            const callbackKey = `${token}_${data}`;
            if (this.nextCommandHandlers.has(callbackKey)) {
                const handler = this.nextCommandHandlers.get(callbackKey);
                await handler(data, callbackQuery);
                this.nextCommandHandlers.delete(callbackKey);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Callback query error:', error);
        }
    }

    async handleInlineQuery(bot, token, inlineQuery) {
        try {
            console.log(`🔍 Inline query: ${inlineQuery.query}`);
            
            const results = [{
                type: 'article',
                id: '1',
                title: 'Inline Result',
                input_message_content: {
                    message_text: `You searched: ${inlineQuery.query}`
                },
                description: 'Test inline result'
            }];

            await bot.answerInlineQuery(inlineQuery.id, results);
        } catch (error) {
            console.error('❌ Inline query error:', error);
        }
    }

    // Other event handlers with simple implementations
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

    async generateAICode(bot, chatId, prompt) {
        try {
            const aiPrompt = prompt.replace('/ai ', '').replace('/generate ', '');
            const generatedCode = this.generateCodeFromPrompt(aiPrompt);
            
            await bot.sendMessage(chatId, `🤖 Generated Code:\n\`\`\`javascript\n${generatedCode}\n\`\`\``, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ AI Generation Error: ${error.message}`);
        }
    }

    generateCodeFromPrompt(prompt) {
        return `// AI Generated code for: "${prompt}"
const user = getUser();
bot.sendMessage(\`Hello \${user.first_name}! You said: "${prompt}"\`);

// Alternative: Api.sendMessage(\`Hello \${user.first_name}! You said: "${prompt}"\`);`;
    }

    createExecutionContext(bot, command, msg, userInput = null) {
        const baseContext = {
            msg: msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            botToken: command.bot_token,
            userInput: userInput,
            nextCommandHandlers: this.nextCommandHandlers,
            pythonRunner: pythonRunner,
            
            // Data storage methods
            // Enhanced User Data Operations
User: {
    // Basic CRUD
    saveData: (key, value) => this.saveData('user_data', command.bot_token, msg.from.id, key, value),
    getData: (key) => this.getData('user_data', command.bot_token, msg.from.id, key),
    deleteData: (key) => this.deleteData('user_data', command.bot_token, msg.from.id, key),
    
    // Advanced operations
    getAllData: async () => {
        const { data, error } = await supabase
            .from('universal_data')
            .select('data_key, data_value, created_at, updated_at')
            .eq('data_type', 'user_data')
            .eq('bot_token', command.bot_token)
            .eq('user_id', msg.from.id.toString());
        
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
    },
    
    deleteAllData: async () => {
        const { error } = await supabase
            .from('universal_data')
            .delete()
            .eq('data_type', 'user_data')
            .eq('bot_token', command.bot_token)
            .eq('user_id', msg.from.id.toString());
        
        return !error;
    },
    
    saveMultiple: async (dataObject) => {
        for (const [key, value] of Object.entries(dataObject)) {
            await this.saveData('user_data', command.bot_token, msg.from.id, key, value);
        }
        return true;
    },
    
    findData: async (pattern) => {
        const { data, error } = await supabase
            .from('universal_data')
            .select('data_key, data_value')
            .eq('data_type', 'user_data')
            .eq('bot_token', command.bot_token)
            .eq('user_id', msg.from.id.toString())
            .like('data_key', `%${pattern}%`);
        
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
    },
    
    exportData: async () => {
        const allData = await this.getAllData();
        return JSON.stringify(allData, null, 2);
    },
    
    importData: async (jsonData) => {
        const dataObject = JSON.parse(jsonData);
        return await this.saveMultiple(dataObject);
    }
},

// Enhanced Bot Data Operations
Bot: {
    // Basic CRUD
    saveData: (key, value) => this.saveData('bot_data', command.bot_token, null, key, value),
    getData: (key) => this.getData('bot_data', command.bot_token, null, key),
    deleteData: async (key) => {
        const { error } = await supabase
            .from('universal_data')
            .delete()
            .eq('data_type', 'bot_data')
            .eq('bot_token', command.bot_token)
            .eq('data_key', key);
        
        return !error;
    },
    
    // Advanced operations
    getAllData: async () => {
        const { data, error } = await supabase
            .from('universal_data')
            .select('data_key, data_value, created_at, updated_at')
            .eq('data_type', 'bot_data')
            .eq('bot_token', command.bot_token);
        
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
    },
    
    deleteAllData: async () => {
        const { error } = await supabase
            .from('universal_data')
            .delete()
            .eq('data_type', 'bot_data')
            .eq('bot_token', command.bot_token);
        
        return !error;
    },
    
    saveMultiple: async (dataObject) => {
        for (const [key, value] of Object.entries(dataObject)) {
            await this.saveData('bot_data', command.bot_token, null, key, value);
        }
        return true;
    },
    
    exportData: async () => {
        const allData = await this.getAllData();
        return JSON.stringify(allData, null, 2);
    }
}
        };

        // Create API wrapper instance
        const apiWrapper = new ApiWrapper(bot, baseContext);
        
        return {
            ...baseContext,
            bot: apiWrapper,      // bot.sendMessage() style
            Api: apiWrapper,      // Api.sendMessage() style
            // Direct methods
            sendMessage: (text, options) => apiWrapper.sendMessage(text, options),
            getUser: () => apiWrapper.getUser()
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

    // server/core/bot-manager.js - sendError মেথডে যোগ করুন
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

    // server/core/bot-manager.js - updateCommandCache মেথডে যোগ করুন
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

        // Clear existing cache
        this.botCommands.set(token, []);
        
        // Add new commands
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