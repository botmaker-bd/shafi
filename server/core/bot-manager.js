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
        
        // 🧹 Memory Cleanup: প্রতি ১০ মিনিটে ক্যাশ ক্লিয়ার করবে
        setInterval(() => this.cleanupDataCache(), 10 * 60 * 1000);
        
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    cleanupDataCache() {
        if (this.dataCache.size > 5000) {
            console.log('🧹 Clearing data cache to free up memory...');
            this.dataCache.clear();
        }
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

            if (error) throw error;

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
                    // Rate limiting protection
                    if (i < bots.length - 1) await new Promise(r => setTimeout(r, 2000));
                } catch (botError) {
                    console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                }
            }

            this.initialized = true;
            console.log(`✅ ${successCount}/${bots.length} bots initialized`);
        } catch (error) {
            console.error('❌ Initialize all bots error:', error);
        }
    }

    getBotInstance(token) {
        return this.activeBots.get(token);
    }

    async handleBotUpdate(token, update) {
        try {
            const bot = this.activeBots.get(token);
            if (bot) await bot.processUpdate(update);
        } catch (error) {
            console.error('❌ Handle bot update error:', error);
        }
    }

    // ✅ FIXED: Execute Command with SINGLE Error Message logic
    async executeCommand(bot, command, msg, userInput = null) {
        try {
            console.log(`🔧 Executing: ${command.command_patterns}`);
            
            // Channel Safety Check
            const userId = msg.from ? msg.from.id : msg.chat.id;
            
            await this.preloadUserData(command.bot_token, userId);
            
            const context = this.createExecutionContext(bot, command, msg, userInput);

            // 🚀 Run the code
            const result = await executeCommandCode(bot, command.code, context);
            
            // Setup Answer Handler if needed (DB Configured)
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupCommandAnswerHandler(bot, command, msg, context);
            }
            
            console.log(`✅ Executed: ${command.command_patterns}`);
            return { success: true, result };
            
        } catch (error) {
            console.error(`❌ Execution Error (${command.command_patterns}):`, error.message);
            
            // 🔴 SINGLE ERROR MESSAGE TO USER
            try {
                const errorMsg = `❌ <b>Command Error:</b>\n${error.message}`;
                await bot.sendMessage(msg.chat.id, errorMsg, { parse_mode: 'HTML' });
            } catch (sendError) {
                console.error('❌ Failed to send error message to user:', sendError.message);
            }
            
            return { success: false, error };
        }
    }

    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        const self = this;
        
        // 🛡️ Channel Safety: Fallback to chat info if user info is missing
        const userId = msg.from ? msg.from.id : msg.chat.id;
        const username = msg.from ? msg.from.username : msg.chat.title;
        const firstName = msg.from ? msg.from.first_name : msg.chat.title;
        
        return {
            msg, chatId: msg.chat.id, userId, username, first_name: firstName,
            last_name: msg.from?.last_name || '', language_code: msg.from?.language_code || '',
            botToken, userInput,
            nextCommandHandlers: this.nextCommandHandlers,
            waitingAnswers: this.waitingAnswers,
            commandAnswerHandlers: this.commandAnswerHandlers,
            callbackHandlers: this.callbackHandlers,
            
            User: {
                saveData: (k, v) => {
                    const ck = `${botToken}_${userId}_${k}`; self.dataCache.set(ck, v);
                    self.saveData('user_data', botToken, userId, k, v).catch(e => console.error('Save Err:', e));
                    return v;
                },
                getData: (k) => {
                    const ck = `${botToken}_${userId}_${k}`;
                    return self.dataCache.has(ck) ? self.dataCache.get(ck) : null;
                },
                deleteData: (k) => {
                    const ck = `${botToken}_${userId}_${k}`; self.dataCache.delete(ck);
                    self.deleteData('user_data', botToken, userId, k).catch(e => console.error('Del Err:', e));
                    return true;
                }
            },
            
            Bot: {
                saveData: (k, v) => {
                    const ck = `${botToken}_bot_${k}`; self.dataCache.set(ck, v);
                    self.saveData('bot_data', botToken, null, k, v).catch(e => console.error('Bot Save Err:', e));
                    return v;
                },
                getData: (k) => {
                    const ck = `${botToken}_bot_${k}`;
                    return self.dataCache.has(ck) ? self.dataCache.get(ck) : null;
                },
                deleteData: (k) => {
                    const ck = `${botToken}_bot_${k}`; self.dataCache.delete(ck);
                    self.deleteData('bot_data', botToken, null, k).catch(e => console.error('Bot Del Err:', e));
                    return true;
                }
            }
        };
    }

    async setupCommandAnswerHandler(bot, command, msg, context) {
        const userId = msg.from ? msg.from.id : msg.chat.id;
        const userKey = `${command.bot_token}_${userId}`;
        
        this.commandAnswerHandlers.set(userKey, {
            bot, command, context, timestamp: Date.now(), originalMessage: msg
        });
        
        await bot.sendMessage(msg.chat.id, "💬 I'm listening for your response...");
    }

    async processCommandAnswer(userKey, answerText, answerMsg) {
        const handlerData = this.commandAnswerHandlers.get(userKey);
        if (!handlerData) return;

        const { bot, command, context, originalMessage } = handlerData;
        this.commandAnswerHandlers.delete(userKey); // One-time use

        try {
            await bot.sendMessage(answerMsg.chat.id, "⏳ Processing...");
            const answerContext = { ...context, params: answerText, userInput: answerText, answerMessage: answerMsg, originalMessage };
            await executeCommandCode(bot, command.answer_handler, answerContext);
        } catch (error) {
            await bot.sendMessage(answerMsg.chat.id, `❌ Answer Error: ${error.message}`);
        }
    }

    async processCallbackAsCommand(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            console.log(`🔘 Callback: ${data}`);
            
            const commands = this.botCommands.get(token) || [];
            const matchingCommand = commands.find(cmd => {
                if (!cmd.command_patterns) return false;
                return cmd.command_patterns.split(',').map(p => p.trim()).includes(data);
            });
            
            if (matchingCommand) {
                const callbackMessage = {
                    chat: message.chat, from, message_id: message.message_id,
                    text: data, date: Date.now() / 1000
                };
                await this.executeCommand(bot, matchingCommand, callbackMessage, data);
                await bot.answerCallbackQuery(callbackQuery.id, { text: `Executed: ${data}` });
            } else {
                await bot.answerCallbackQuery(callbackQuery.id);
            }
        } catch (error) {
            console.error('Callback Error:', error);
            try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred' }); } catch(e){}
        }
    }

    async preloadUserData(botToken, userId) {
        try {
            const { data } = await supabase.from('universal_data')
                .select('data_key, data_value')
                .eq('data_type', 'user_data').eq('bot_token', botToken).eq('user_id', userId.toString());

            if (data) {
                data.forEach(item => {
                    const cacheKey = `${botToken}_${userId}_${item.data_key}`;
                    try { this.dataCache.set(cacheKey, JSON.parse(item.data_value)); } 
                    catch { this.dataCache.set(cacheKey, item.data_value); }
                });
            }
        } catch (e) { console.error('Preload Error:', e); }
    }

    async initializeBot(token) {
        const { data: commands } = await supabase.from('commands').select('*').eq('bot_token', token).eq('is_active', true);
        
        let bot;
        if (this.USE_WEBHOOK) {
            bot = new TelegramBot(token, { polling: false });
            // Ensure you have BASE_URL in .env
            await bot.setWebHook(`${process.env.BASE_URL}/api/webhook/${token}`);
        } else {
            bot = new TelegramBot(token, { polling: true });
        }

        this.setupEventHandlers(bot, token);
        this.activeBots.set(token, bot);
        this.botCommands.set(token, commands || []);
        
        return true;
    }

    setupEventHandlers(bot, token) {
        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
        bot.on('callback_query', (cb) => this.handleCallbackQuery(bot, token, cb));
        bot.on('polling_error', (e) => console.error(`Polling Error:`, e.message));
    }

    // ✅ FIXED: Message Handler with "Unknown Command" logic
    async handleMessage(bot, token, msg) {
        try {
            if (!msg.text && !msg.caption) return;
            const text = msg.text || msg.caption || '';
            const userId = msg.from ? msg.from.id : msg.chat.id; // Channel Safe
            const userKey = `${token}_${userId}`;

            // 1. Check Script Wait Handlers (Highest Priority)
            if (this.nextCommandHandlers.has(userKey)) {
                const handler = this.nextCommandHandlers.get(userKey);
                if (handler && handler.resolve) {
                    handler.resolve(text);
                    this.nextCommandHandlers.delete(userKey);
                    return;
                }
            }

            // 2. Check DB Wait Handlers
            if (this.commandAnswerHandlers.has(userKey)) {
                await this.processCommandAnswer(userKey, text, msg);
                return;
            }

            // 3. Special System Commands
            if (text.startsWith('/python ')) {
                await this.executePythonCode(bot, msg.chat.id, text.replace('/python ', ''));
                return;
            }

            // 4. Find & Execute Matching Command
            const command = await this.findMatchingCommand(token, text, msg);
            
            if (command) {
                // Command Found -> Execute
                await this.executeCommand(bot, command, msg, text);
            } else {
                // ❌ Command Not Found
                // Only reply in PRIVATE chats to avoid spamming groups
                if (msg.chat.type === 'private') {
                    await bot.sendMessage(msg.chat.id, "❌ <b>Unknown Command</b>\nদুঃখিত, এই কমান্ডটি খুঁজে পাওয়া যায়নি।", { parse_mode: 'HTML' });
                }
            }

        } catch (error) {
            console.error('Handle Message System Error:', error);
            // Internal system errors are logged only, not sent to user to avoid loops
        }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        const { data } = callbackQuery;
        // First try as command
        await this.processCallbackAsCommand(bot, token, callbackQuery);
        
        // Then try as script handler
        const callbackKey = `${token}_${data}`;
        if (this.nextCommandHandlers.has(callbackKey)) {
            const handler = this.nextCommandHandlers.get(callbackKey);
            await handler(data, callbackQuery);
            this.nextCommandHandlers.delete(callbackKey);
        }
    }

    async executePythonCode(bot, chatId, pythonCode) {
        try {
            await bot.sendMessage(chatId, '🐍 Running Python...');
            // Using Sync for now, change to Async if implemented
            const result = await pythonRunner.runPythonCodeSync(pythonCode);
            await bot.sendMessage(chatId, `✅ Result:\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Python Error:\n${error.message}`);
        }
    }

    async findMatchingCommand(token, text, msg) {
        const commands = this.botCommands.get(token) || [];
        for (const command of commands) {
            if (!command.command_patterns) continue;
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            for (const pattern of patterns) {
                // Exact match or starts with command+space
                if (text === pattern || text.startsWith(pattern + ' ')) return command;
            }
        }
        return null;
    }
    
    // --- Data Persistance Methods ---
    async saveData(dataType, botToken, userId, key, value) {
        await supabase.from('universal_data').upsert({
            data_type: dataType, bot_token: botToken, user_id: userId ? userId.toString() : null,
            data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString()
        }, { onConflict: 'data_type,bot_token,user_id,data_key' });
        return value;
    }
    
    async deleteData(dataType, botToken, userId, key) {
        await supabase.from('universal_data').delete()
            .match({ data_type: dataType, bot_token: botToken, data_key: key })
            .eq('user_id', userId ? userId.toString() : null);
        return true;
    }
}

const botManagerInstance = new BotManager();
module.exports = botManagerInstance;