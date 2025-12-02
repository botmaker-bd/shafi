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
        
        setInterval(() => this.cleanupDataCache(), 10 * 60 * 1000);
        console.log(`🤖 Bot Manager initialized in ${this.USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);
    }

    cleanupDataCache() {
        if (this.dataCache.size > 5000) this.dataCache.clear();
    }

    async initializeAllBots() {
        if (this.initialized) return;
        try {
            const { data: bots, error } = await supabase.from('bots').select('token, name, is_active').eq('is_active', true);
            if (error) throw error;
            if (!bots || bots.length === 0) return;

            for (let i = 0; i < bots.length; i++) {
                try {
                    await this.initializeBot(bots[i].token);
                    if (i < bots.length - 1) await new Promise(r => setTimeout(r, 2000));
                } catch (e) { console.error(`Failed to init bot ${bots[i].name}:`, e.message); }
            }
            this.initialized = true;
        } catch (error) { console.error('Init Error:', error); }
    }

    getBotInstance(token) { return this.activeBots.get(token); }

    // 🔴 FIX: Added missing updateCommandCache method
    async updateCommandCache(token) {
        try {
            const { data: commands, error } = await supabase.from('commands').select('*').eq('bot_token', token).eq('is_active', true);
            if (error) throw error;
            this.botCommands.set(token, commands || []);
            console.log(`✅ Cache updated for ${token.substring(0,10)}...: ${commands?.length} commands`);
        } catch (error) {
            console.error('Cache Update Error:', error);
        }
    }

    async executeCommand(bot, command, msg, userInput = null) {
        try {
            const userId = msg.from ? msg.from.id : msg.chat.id;
            await this.preloadUserData(command.bot_token, userId);
            
            const context = this.createExecutionContext(bot, command, msg, userInput);
            const result = await executeCommandCode(bot, command.code, context);
            
            if (command.wait_for_answer && command.answer_handler) {
                await this.setupCommandAnswerHandler(bot, command, msg, context);
            }
            return { success: true, result };
        } catch (error) {
            console.error(`Exec Error (${command.command_patterns}):`, error.message);
            try { await bot.sendMessage(msg.chat.id, `❌ <b>Command Error:</b>\n${error.message}`, { parse_mode: 'HTML' }); } catch(e){}
            return { success: false, error };
        }
    }

    createExecutionContext(bot, command, msg, userInput) {
        const botToken = command.bot_token;
        const self = this;
        const userId = msg.from ? msg.from.id : msg.chat.id;
        
        return {
            msg, chatId: msg.chat.id, userId, 
            username: msg.from?.username, first_name: msg.from?.first_name,
            botToken, userInput,
            nextCommandHandlers: this.nextCommandHandlers,
            waitingAnswers: this.waitingAnswers,
            commandAnswerHandlers: this.commandAnswerHandlers,
            
            User: {
                saveData: (k, v) => {
                    const ck = `${botToken}_${userId}_${k}`; self.dataCache.set(ck, v);
                    self.saveData('user_data', botToken, userId, k, v).catch(e => console.error(e));
                    return v;
                },
                getData: (k) => {
                    const ck = `${botToken}_${userId}_${k}`;
                    return self.dataCache.has(ck) ? self.dataCache.get(ck) : null;
                },
                deleteData: (k) => {
                    const ck = `${botToken}_${userId}_${k}`; self.dataCache.delete(ck);
                    self.deleteData('user_data', botToken, userId, k).catch(e => console.error(e));
                    return true;
                }
            },
            Bot: {
                saveData: (k, v) => {
                    const ck = `${botToken}_bot_${k}`; self.dataCache.set(ck, v);
                    self.saveData('bot_data', botToken, null, k, v).catch(e => console.error(e));
                    return v;
                },
                getData: (k) => {
                    const ck = `${botToken}_bot_${k}`;
                    return self.dataCache.has(ck) ? self.dataCache.get(ck) : null;
                },
                deleteData: (k) => {
                    const ck = `${botToken}_bot_${k}`; self.dataCache.delete(ck);
                    self.deleteData('bot_data', botToken, null, k).catch(e => console.error(e));
                    return true;
                }
            }
        };
    }

    async setupCommandAnswerHandler(bot, command, msg, context) {
        const userId = msg.from ? msg.from.id : msg.chat.id;
        const userKey = `${command.bot_token}_${userId}`;
        this.commandAnswerHandlers.set(userKey, { bot, command, context, timestamp: Date.now(), originalMessage: msg });
        await bot.sendMessage(msg.chat.id, "💬 I'm listening...");
    }

    async processCommandAnswer(userKey, answerText, answerMsg) {
        const handlerData = this.commandAnswerHandlers.get(userKey);
        if (!handlerData) return;
        const { bot, command, context, originalMessage } = handlerData;
        this.commandAnswerHandlers.delete(userKey);

        try {
            const answerContext = { ...context, params: answerText, userInput: answerText, answerMessage: answerMsg, originalMessage };
            await executeCommandCode(bot, command.answer_handler, answerContext);
        } catch (error) {
            await bot.sendMessage(answerMsg.chat.id, `❌ Answer Error: ${error.message}`);
        }
    }

    async processCallbackAsCommand(bot, token, callbackQuery) {
        try {
            const { data, message, from } = callbackQuery;
            const commands = this.botCommands.get(token) || [];
            const matchingCommand = commands.find(cmd => {
                if (!cmd.command_patterns) return false;
                return cmd.command_patterns.split(',').map(p => p.trim()).includes(data);
            });
            
            if (matchingCommand) {
                const callbackMessage = { chat: message.chat, from, message_id: message.message_id, text: data };
                await this.executeCommand(bot, matchingCommand, callbackMessage, data);
                await bot.answerCallbackQuery(callbackQuery.id, { text: `Executed` });
            } else {
                await bot.answerCallbackQuery(callbackQuery.id);
            }
        } catch (error) {
            try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error' }); } catch(e){}
        }
    }

    async preloadUserData(botToken, userId) {
        try {
            const { data } = await supabase.from('universal_data')
                .select('data_key, data_value')
                .eq('data_type', 'user_data').eq('bot_token', botToken).eq('user_id', userId.toString());
            if (data) data.forEach(item => {
                const cacheKey = `${botToken}_${userId}_${item.data_key}`;
                try { this.dataCache.set(cacheKey, JSON.parse(item.data_value)); } catch { this.dataCache.set(cacheKey, item.data_value); }
            });
        } catch (e) {}
    }

    async initializeBot(token) {
        const { data: commands } = await supabase.from('commands').select('*').eq('bot_token', token).eq('is_active', true);
        
        let bot;
        if (this.USE_WEBHOOK) {
            bot = new TelegramBot(token, { polling: false });
            await bot.setWebHook(`${process.env.BASE_URL}/api/webhook/${token}`);
        } else {
            bot = new TelegramBot(token, { polling: true });
        }

        bot.on('message', (msg) => this.handleMessage(bot, token, msg));
        bot.on('callback_query', (cb) => this.handleCallbackQuery(bot, token, cb));
        bot.on('polling_error', (e) => console.error(`Polling Error:`, e.message));

        this.activeBots.set(token, bot);
        this.botCommands.set(token, commands || []);
        return true;
    }

    async handleMessage(bot, token, msg) {
        try {
            if (!msg.text && !msg.caption) return;
            const text = msg.text || msg.caption || '';
            const userId = msg.from ? msg.from.id : msg.chat.id;
            const userKey = `${token}_${userId}`;

            if (this.nextCommandHandlers.has(userKey)) {
                const handler = this.nextCommandHandlers.get(userKey);
                if (handler && handler.resolve) {
                    handler.resolve(text);
                    this.nextCommandHandlers.delete(userKey);
                    return;
                }
            }

            if (this.commandAnswerHandlers.has(userKey)) {
                await this.processCommandAnswer(userKey, text, msg);
                return;
            }

            if (text.startsWith('/python ')) {
                await this.executePythonCode(bot, msg.chat.id, text.replace('/python ', ''));
                return;
            }

            const command = await this.findMatchingCommand(token, text);
            if (command) {
                await this.executeCommand(bot, command, msg, text);
            } else {
                if (msg.chat.type === 'private') {
                    await bot.sendMessage(msg.chat.id, "❌ <b>Unknown Command</b>", { parse_mode: 'HTML' });
                }
            }
        } catch (error) { console.error('Message Error:', error); }
    }

    async handleCallbackQuery(bot, token, callbackQuery) {
        await this.processCallbackAsCommand(bot, token, callbackQuery);
        const callbackKey = `${token}_${callbackQuery.data}`;
        if (this.nextCommandHandlers.has(callbackKey)) {
            const handler = this.nextCommandHandlers.get(callbackKey);
            await handler(callbackQuery.data, callbackQuery);
            this.nextCommandHandlers.delete(callbackKey);
        }
    }

    async executePythonCode(bot, chatId, pythonCode) {
        try {
            await bot.sendMessage(chatId, '🐍 Running...');
            // 🔴 FIX: Using Async Python Runner
            const result = await pythonRunner.runPythonCodeAsync(pythonCode);
            await bot.sendMessage(chatId, `✅ Result:\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Python Error:\n${error.message}`);
        }
    }

    async findMatchingCommand(token, text) {
        const commands = this.botCommands.get(token) || [];
        for (const command of commands) {
            if (!command.command_patterns) continue;
            const patterns = command.command_patterns.split(',').map(p => p.trim());
            for (const pattern of patterns) {
                if (text === pattern || text.startsWith(pattern + ' ')) return command;
            }
        }
        return null;
    }
    
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