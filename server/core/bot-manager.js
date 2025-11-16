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
        this.dataCache = new Map();
        this.waitingAnswers = new Map(); // NEW: Wait for Answer tracking
        this.commandAnswerHandlers = new Map(); // NEW: Command-based answer handlers
        
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
            
            // Pre-load data for this user to enable synchronous access
            await this.preloadUserData(command.bot_token, msg.from.id);
            
            // Create enhanced execution context
            const context = this.createExecutionContext(bot, command, msg, userInput);

            const result = await executeCommandCode(bot, command.code, context);
            
            // 🔥 NEW: Setup Wait For Answer system if enabled
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupCommandAnswerHandler(bot, command, msg, context);
            }
            
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

    // 🔥 NEW: Create execution context
    createExecutionContext(bot, command, msg, userInput) {
        return {
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
            waitingAnswers: this.waitingAnswers, // Add waitingAnswers to context
            
            // Enhanced data operations - SYNCHRONOUS STYLE
            User: {
                // Synchronous methods - no async/await
                saveData: (key, value) => {
                    // Store in cache immediately
                    const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                    this.dataCache.set(cacheKey, value);
                    
                    // Save to database in background (fire and forget)
                    this.saveData('user_data', command.bot_token, msg.from.id, key, value)
                        .catch(err => console.error('❌ Background save error:', err));
                    
                    return value; // Return value for immediate use
                },
                
                getData: (key) => {
                    // Get from cache first
                    const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                    if (this.dataCache.has(cacheKey)) {
                        return this.dataCache.get(cacheKey);
                    }
                    
                    // Return default values for common keys
                    const defaults = {
                        'total_usage': 0,
                        'user_count': 1,
                        'usage_count': 0
                    };
                    
                    return defaults[key] || null;
                },
                
                deleteData: (key) => {
                    // Remove from cache
                    const cacheKey = `${command.bot_token}_${msg.from.id}_${key}`;
                    this.dataCache.delete(cacheKey);
                    
                    // Delete from database in background
                    this.deleteData('user_data', command.bot_token, msg.from.id, key)
                        .catch(err => console.error('❌ Background delete error:', err));
                    
                    return true;
                },
                
                // Simple utility methods
                increment: (key, amount = 1) => {
                    const current = this.User.getData(key) || 0;
                    const newValue = parseInt(current) + amount;
                    this.User.saveData(key, newValue);
                    return newValue;
                },
                
                decrement: (key, amount = 1) => {
                    const current = this.User.getData(key) || 0;
                    const newValue = Math.max(0, parseInt(current) - amount);
                    this.User.saveData(key, newValue);
                    return newValue;
                },
                
                setFlag: (key, value = true) => {
                    this.User.saveData(key, value);
                    return value;
                },
                
                getFlag: (key) => {
                    return this.User.getData(key) || false;
                },
                
                toggleFlag: (key) => {
                    const current = this.User.getData(key) || false;
                    const newValue = !current;
                    this.User.saveData(key, newValue);
                    return newValue;
                }
            },
            
            Bot: {
                // Synchronous methods for bot data
                saveData: (key, value) => {
                    const cacheKey = `${command.bot_token}_bot_${key}`;
                    this.dataCache.set(cacheKey, value);
                    
                    this.saveData('bot_data', command.bot_token, null, key, value)
                        .catch(err => console.error('❌ Background bot save error:', err));
                    
                    return value;
                },
                
                getData: (key) => {
                    const cacheKey = `${command.bot_token}_bot_${key}`;
                    if (this.dataCache.has(cacheKey)) {
                        return this.dataCache.get(cacheKey);
                    }
                    return null;
                },
                
                deleteData: (key) => {
                    const cacheKey = `${command.bot_token}_bot_${key}`;
                    this.dataCache.delete(cacheKey);
                    
                    this.deleteData('bot_data', command.bot_token, null, key)
                        .catch(err => console.error('❌ Background bot delete error:', err));
                    
                    return true;
                }
            }
        };
    }

    // 🔥 NEW: Setup Command-based Answer Handler (wait_for_answer: true)
    async setupCommandAnswerHandler(bot, command, msg, context) {
        const userKey = `${command.bot_token}_${msg.from.id}`;
        
        console.log(`⏳ Setting up Command Answer Handler for user: ${userKey}`);
        
        // Store the command answer handler information
        this.commandAnswerHandlers.set(userKey, {
            bot: bot,
            command: command,
            context: context,
            timestamp: Date.now(),
            originalMessage: msg
        });
        
        console.log(`✅ Now waiting for answer from user ${msg.from.first_name} for command: ${command.command_patterns}`);
    }

    // 🔥 NEW: Process user's answer for command-based handlers
    async processCommandAnswer(userKey, answerText, answerMsg) {
        try {
            const handlerData = this.commandAnswerHandlers.get(userKey);
            if (!handlerData) {
                console.log(`❌ No command handler data found for user: ${userKey}`);
                return;
            }

            const { bot, command, context, originalMessage } = handlerData;
            
            console.log(`🎯 Processing command answer: "${answerText}" for command: ${command.command_patterns}`);
            
            // Create enhanced context for answer handler
            const answerContext = {
                ...context,
                params: answerText,           // User's answer text
                userInput: answerText,        // Alias for params
                answerMessage: answerMsg,     // The answer message object
                originalMessage: originalMessage // Original command message
            };

            // Execute the answer handler code
            await executeCommandCode(bot, command.answer_handler, answerContext);
            
            console.log(`✅ Command answer handler executed successfully for ${answerMsg.from.first_name}`);
            
        } catch (error) {
            console.error('❌ Command answer handler execution error:', error);
            // Send error to user
            try {
                await bot.sendMessage(answerMsg.chat.id, `❌ Error processing your answer: ${error.message}`);
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        } finally {
            // 🔥 IMPORTANT: Remove from command handlers after processing
            this.commandAnswerHandlers.delete(userKey);
            console.log(`🧹 Cleaned up command answer handler for ${userKey}`);
        }
    }

    // 🔥 NEW: Process waitForAnswer() promises
    async processWaitForAnswer(userKey, answerText, answerMsg) {
        try {
            const waitingData = this.waitingAnswers.get(userKey);
            if (!waitingData) {
                console.log(`❌ No waiting data found for user: ${userKey}`);
                return;
            }

            console.log(`🎯 Processing waitForAnswer: "${answerText}" for user: ${userKey}`);
            
            // Resolve the promise with user's answer
            if (waitingData.resolve) {
                waitingData.resolve(answerText);
            }
            
            console.log(`✅ waitForAnswer resolved successfully for ${answerMsg.from.first_name}`);
            
        } catch (error) {
            console.error('❌ waitForAnswer processing error:', error);
            // Reject the promise if there's an error
            const waitingData = this.waitingAnswers.get(userKey);
            if (waitingData && waitingData.reject) {
                waitingData.reject(error);
            }
        } finally {
            // 🔥 IMPORTANT: Remove from waiting answers after processing
            this.waitingAnswers.delete(userKey);
            console.log(`🧹 Cleaned up waitForAnswer for ${userKey}`);
        }
    }

    async preloadUserData(botToken, userId) {
        try {
            // Pre-load user data for this bot/user combination
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

            // Store in cache for synchronous access
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
                throw botError;
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

            console.log(`📨 Message from ${msg.from.first_name} (${userId}): "${text}"`);

            const userKey = `${token}_${userId}`;

            // 1. FIRST: Check for waitForAnswer() promises
            if (this.waitingAnswers.has(userKey)) {
                console.log(`✅ USER HAS waitForAnswer() PENDING! Processing...`);
                await this.processWaitForAnswer(userKey, text, msg);
                return; // Stop here
            }

            // 2. SECOND: Check for command-based answer handlers (wait_for_answer: true)
            if (this.commandAnswerHandlers.has(userKey)) {
                console.log(`✅ USER HAS COMMAND ANSWER HANDLER! Processing...`);
                await this.processCommandAnswer(userKey, text, msg);
                return; // Stop here
            }

            // 3. THIRD: Check for next command handler
            const nextCommandKey = `${token}_${userId}`;
            console.log(`🔍 Checking next command handler for key: ${nextCommandKey}`);
            
            if (this.nextCommandHandlers.has(nextCommandKey)) {
                console.log(`✅ NEXT COMMAND HANDLER FOUND! Executing...`);
                const handler = this.nextCommandHandlers.get(nextCommandKey);
                
                // Remove handler immediately to prevent multiple executions
                this.nextCommandHandlers.delete(nextCommandKey);
                
                try {
                    // Execute the handler with user's response
                    await handler(text, msg);
                    console.log(`✅ Next command handler executed successfully for user ${userId}`);
                    return; // Important: return after handling
                } catch (handlerError) {
                    console.error(`❌ Next command handler error:`, handlerError);
                    await this.sendError(bot, chatId, handlerError);
                    return;
                }
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
                console.log(`🎯 Executing command: ${command.command_patterns}`);
                await this.executeCommand(bot, command, msg, text);
            } else {
                console.log(`❌ No matching command found for: "${text}"`);
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
bot.sendMessage(\`Hello \${user.first_name}! You said: "${prompt}"\`);`;
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

    // Data storage methods - ASYNC (background operations)
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
            return value; // Still return value even if save fails
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