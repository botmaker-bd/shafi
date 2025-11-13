const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');
const templateLoader = require('./template-loader');
const ApiWrapper = require('./api-wrapper');

class BotManager {
    constructor() {
        this.activeBots = new Map();
        this.botCommands = new Map();
        this.nextCommandHandlers = new Map();
        this.userStates = new Map();
        this.USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
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
            const botInfo = await bot.getMe();
            console.log(`✅ Bot connected: @${botInfo.username}`);

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
        bot.on('animation', (msg) => this.handleMedia(bot, token, msg, 'animation'));
        
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
        bot.on('chosen_inline_result', (result) => this.handleChosenInlineResult(bot, token, result));
        
        // Chat events
        bot.on('new_chat_members', (msg) => this.handleChatMember(bot, token, msg, 'new'));
        bot.on('left_chat_member', (msg) => this.handleChatMember(bot, token, msg, 'left'));
        bot.on('new_chat_title', (msg) => this.handleChatTitle(bot, token, msg));
        bot.on('new_chat_photo', (msg) => this.handleChatPhoto(bot, token, msg));
        bot.on('delete_chat_photo', (msg) => this.handleDeleteChatPhoto(bot, token, msg));
        bot.on('group_chat_created', (msg) => this.handleGroupCreated(bot, token, msg));
        bot.on('supergroup_chat_created', (msg) => this.handleSupergroupCreated(bot, token, msg));
        bot.on('channel_chat_created', (msg) => this.handleChannelCreated(bot, token, msg));
        bot.on('migrate_to_chat_id', (msg) => this.handleMigrateTo(bot, token, msg));
        bot.on('migrate_from_chat_id', (msg) => this.handleMigrateFrom(bot, token, msg));
        bot.on('pinned_message', (msg) => this.handlePinnedMessage(bot, token, msg));
        
        // Chat member updates
        bot.on('my_chat_member', (update) => this.handleMyChatMember(bot, token, update));
        bot.on('chat_member', (update) => this.handleChatMemberUpdate(bot, token, update));
        bot.on('chat_join_request', (request) => this.handleChatJoinRequest(bot, token, request));
        
        // Payment handlers
        bot.on('shipping_query', (query) => this.handleShippingQuery(bot, token, query));
        bot.on('pre_checkout_query', (query) => this.handlePreCheckoutQuery(bot, token, query));
        
        // Error handlers
        bot.on('polling_error', (error) => console.error(`❌ Polling error:`, error));
        bot.on('webhook_error', (error) => console.error(`❌ Webhook error:`, error));
        bot.on('error', (error) => console.error(`❌ Bot error:`, error));
    }

    async handleMessage(bot, token, msg) {
        try {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || msg.caption || '';
            const messageType = this.getMessageType(msg);

            console.log(`📨 ${messageType} from ${msg.from.first_name}: "${text}"`);

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
                await this.executeCommand(bot, command, msg);
            }

        } catch (error) {
            console.error('❌ Handle message error:', error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    async handleEditedMessage(bot, token, msg) {
        console.log(`✏️ Edited message from ${msg.from.first_name}`);
        // Handle edited messages if needed
    }

    async handleMedia(bot, token, msg, mediaType) {
        try {
            const caption = msg.caption || '';
            const command = await this.findMatchingCommand(token, caption, msg);
            if (command) {
                await this.executeCommand(bot, command, msg);
            }
        } catch (error) {
            console.error(`❌ Handle ${mediaType} error:`, error);
        }
    }

    async handleLocation(bot, token, msg) {
        try {
            const location = msg.location;
            console.log(`📍 Location from ${msg.from.first_name}: ${location.latitude}, ${location.longitude}`);
            
            // You can handle location-based commands here
            const command = await this.findMatchingCommand(token, '/location', msg);
            if (command) {
                await this.executeCommand(bot, command, msg);
            }
        } catch (error) {
            console.error('❌ Handle location error:', error);
        }
    }

    async handleContact(bot, token, msg) {
        try {
            const contact = msg.contact;
            console.log(`📞 Contact from ${msg.from.first_name}: ${contact.phone_number}`);
            
            // Handle contact sharing
            const command = await this.findMatchingCommand(token, '/contact', msg);
            if (command) {
                await this.executeCommand(bot, command, msg);
            }
        } catch (error) {
            console.error('❌ Handle contact error:', error);
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

    async handlePoll(bot, token, poll) {
        console.log(`📊 Poll: ${poll.question}`);
    }

    async handlePollAnswer(bot, token, pollAnswer) {
        console.log(`🗳️ Poll answer: ${pollAnswer.option_ids}`);
    }

    async handleChatMember(bot, token, msg, type) {
        console.log(`👥 ${type === 'new' ? 'New' : 'Left'} chat member`);
    }

    async handleShippingQuery(bot, token, query) {
        console.log(`🚚 Shipping query`);
        await bot.answerShippingQuery(query.id, true);
    }

    async handlePreCheckoutQuery(bot, token, query) {
        console.log(`💳 Pre-checkout query`);
        await bot.answerPreCheckoutQuery(query.id, true);
    }

    // Other event handlers...
    async handleChatTitle(bot, token, msg) {
        console.log(`🏷️ New chat title: ${msg.new_chat_title}`);
    }

    async handleChatPhoto(bot, token, msg) {
        console.log(`🖼️ New chat photo`);
    }

    async handleDeleteChatPhoto(bot, token, msg) {
        console.log(`❌ Chat photo deleted`);
    }

    async handleGroupCreated(bot, token, msg) {
        console.log(`👥 Group created`);
    }

    async handleSupergroupCreated(bot, token, msg) {
        console.log(`👥 Supergroup created`);
    }

    async handleChannelCreated(bot, token, msg) {
        console.log(`📢 Channel created`);
    }

    async handlePinnedMessage(bot, token, msg) {
        console.log(`📌 Message pinned`);
    }

    async handleMyChatMember(bot, token, update) {
        console.log(`👤 My chat member update`);
    }

    async handleChatMemberUpdate(bot, token, update) {
        console.log(`👥 Chat member update`);
    }

    async handleChatJoinRequest(bot, token, request) {
        console.log(`🤝 Chat join request`);
        await bot.approveChatJoinRequest(request.chat.id, request.from.id);
    }

    getMessageType(msg) {
        if (msg.text) return 'Text';
        if (msg.photo) return 'Photo';
        if (msg.video) return 'Video';
        if (msg.document) return 'Document';
        if (msg.audio) return 'Audio';
        if (msg.voice) return 'Voice';
        if (msg.sticker) return 'Sticker';
        if (msg.location) return 'Location';
        if (msg.contact) return 'Contact';
        if (msg.poll) return 'Poll';
        return 'Message';
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
        const lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.includes('welcome')) {
            return `// Welcome message - bot style
bot.sendMessage(\`Hello \${user.first_name}! 👋 Welcome to our bot!\`);

// Alternative: Api style  
Api.sendMessage(\`Hello \${user.first_name}! 👋 Welcome to our bot!\`);`;
        }
        
        if (lowerPrompt.includes('button')) {
            return `// Inline keyboard - bot style
bot.sendMessage("Choose option:", {
    reply_markup: {
        inline_keyboard: [
            [{ text: "Option 1", callback_data: "opt1" }]
        ]
    }
});

// Alternative: Api style
Api.sendKeyboard("Choose option:", [
    [{ text: "Option 1", callback_data: "opt1" }]
]);`;
        }

        return `// Generated code for: ${prompt}
// bot style
bot.sendMessage(\`Hello! You said: ${prompt}\`);

// Api style
Api.sendMessage(\`Hello! You said: ${prompt}\`);`;
    }

    async executeCommand(bot, command, msg, params = null) {
        try {
            const context = this.createExecutionContext(bot, command, msg, params);
            await this.executeCommandCode(bot, command.code, context);
        } catch (error) {
            console.error(`❌ Command execution error:`, error);
            await this.sendError(bot, msg.chat.id, error);
        }
    }

    createExecutionContext(bot, command, msg, params = null) {
        const baseContext = {
            msg: msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            botToken: command.bot_token,
            userInput: params,
            nextCommandHandlers: this.nextCommandHandlers,
            pythonRunner: pythonRunner,
            
            // Data storage methods
            User: {
                saveData: (key, value) => this.saveData('user_data', command.bot_token, msg.from.id, key, value),
                getData: (key) => this.getData('user_data', command.bot_token, msg.from.id, key),
                deleteData: (key) => this.deleteData('user_data', command.bot_token, msg.from.id, key)
            },
            
            Bot: {
                saveData: (key, value) => this.saveData('bot_data', command.bot_token, null, key, value),
                getData: (key) => this.getData('bot_data', command.bot_token, null, key)
            }
        };

        // Create API wrapper instances
        const apiWrapper = new ApiWrapper(bot, baseContext);
        
        return {
            ...baseContext,
            bot: apiWrapper,      // bot.sendMessage() style
            Api: apiWrapper,      // Api.sendMessage() style
            // Also expose direct methods for flexibility
            sendMessage: (text, options) => apiWrapper.sendMessage(text, options),
            getUser: () => apiWrapper.getUser()
        };
    }

    async executeCommandCode(bot, code, context) {
        return new Promise(async (resolve, reject) => {
            try {
                const commandFunction = new Function(
                    'bot', 'Api', 'sendMessage', 'getUser', 'User', 'Bot', 'runPython', 'wait', 'waitForAnswer',
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

                const result = commandFunction(
                    context.bot,           // bot.sendMessage() style
                    context.Api,           // Api.sendMessage() style  
                    context.sendMessage,   // Direct function
                    context.getUser,       // User info
                    context.User,          // User data storage
                    context.Bot,           // Bot data storage
                    context.pythonRunner.runPythonCode.bind(context.pythonRunner), // Python
                    (ms) => new Promise(resolve => setTimeout(resolve, ms)), // wait
                    context.bot.waitForAnswer.bind(context.bot) // waitForAnswer
                );
                
                if (result && typeof result.then === 'function') {
                    await result;
                }
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
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
            await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
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