// server/core/api-wrapper.js - COMPLETELY FIXED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupEnhancedMethods();
    }

    setupAllMethods() {
        // Core Telegram methods that need chatId
        const chatIdMethods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio',
            'sendVoice', 'sendLocation', 'sendVenue', 'sendContact', 'sendPoll',
            'sendDice', 'sendChatAction', 'sendMediaGroup', 'forwardMessage',
            'copyMessage', 'deleteMessage', 'getChat', 'getChatAdministrators',
            'getChatMemberCount', 'getChatMember', 'setChatTitle', 'banChatMember',
            'unbanChatMember', 'restrictChatMember', 'promoteChatMember', 'sendSticker'
        ];

        // Bind all available methods with smart chatId handling
        Object.getOwnPropertyNames(Object.getPrototypeOf(this.bot))
            .filter(method => typeof this.bot[method] === 'function' && method !== 'constructor')
            .forEach(method => {
                this[method] = async (...args) => {
                    try {
                        // Auto-add chatId for methods that need it
                        let finalArgs = [...args];
                        if (chatIdMethods.includes(method) && 
                            (finalArgs.length === 0 || typeof finalArgs[0] !== 'number')) {
                            finalArgs.unshift(this.context.chatId);
                        }
                        
                        const result = await this.bot[method](...finalArgs);
                        return result;
                    } catch (error) {
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            });
    }

    setupEnhancedMethods() {
        // User information
        this.getUser = () => ({
            id: this.context.userId,
            username: this.context.username,
            first_name: this.context.first_name,
            last_name: this.context.last_name,
            language_code: this.context.language_code,
            chat_id: this.context.chatId,
            is_bot: false
        });

        // Enhanced message methods
        this.send = (text, options = {}) => 
            this.sendMessage(this.context.chatId, text, { parse_mode: 'HTML', ...options });

        this.reply = (text, options = {}) => 
            this.sendMessage(this.context.chatId, text, { 
                reply_to_message_id: this.context.msg?.message_id, 
                parse_mode: 'HTML', 
                ...options 
            });

        // Keyboard helpers
        this.sendKeyboard = (text, buttons, options = {}) => 
            this.sendMessage(this.context.chatId, text, {
                reply_markup: { inline_keyboard: buttons },
                parse_mode: 'HTML',
                ...options
            });

        this.sendReplyKeyboard = (text, buttons, options = {}) => 
            this.sendMessage(this.context.chatId, text, {
                reply_markup: {
                    keyboard: buttons,
                    resize_keyboard: true,
                    one_time_keyboard: options.one_time || false
                },
                parse_mode: 'HTML',
                ...options
            });

        this.removeKeyboard = (text, options = {}) => 
            this.sendMessage(this.context.chatId, text, {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML',
                ...options
            });

        // Media helpers
        this.sendImage = (photo, caption = '', options = {}) => 
            this.sendPhoto(this.context.chatId, photo, { caption, parse_mode: 'HTML', ...options });

        this.sendFile = (document, caption = '', options = {}) => 
            this.sendDocument(this.context.chatId, document, { caption, parse_mode: 'HTML', ...options });

        // Utility methods
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Wait for answer with proper error handling
        this.waitForAnswer = async (question, options = {}) => {
            const timeout = options.timeout || 60000;
            
            return new Promise(async (resolve, reject) => {
                if (!this.context.botToken || !this.context.chatId || !this.context.userId) {
                    reject(new Error('Context data not available for waitForAnswer'));
                    return;
                }

                const waitKey = `${this.context.botToken}_${this.context.userId}`;
                const botManager = require('./bot-manager');

                const timeoutId = setTimeout(() => {
                    if (botManager.waitingAnswers?.has(waitKey)) {
                        botManager.waitingAnswers.delete(waitKey);
                    }
                    reject(new Error(`Wait for answer timeout (${timeout/1000} seconds)`));
                }, timeout);

                try {
                    await this.sendMessage(this.context.chatId, question, {
                        parse_mode: 'HTML',
                        ...options
                    });
                    
                    const waitingPromise = new Promise((innerResolve, innerReject) => {
                        if (!botManager.waitingAnswers) {
                            botManager.waitingAnswers = new Map();
                        }
                        
                        botManager.waitingAnswers.set(waitKey, {
                            resolve: innerResolve,
                            reject: innerReject,
                            timeoutId: timeoutId,
                            timestamp: Date.now()
                        });
                    });

                    const userResponse = await waitingPromise;
                    
                    resolve({
                        text: userResponse,
                        userId: this.context.userId,
                        chatId: this.context.chatId,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (botManager.waitingAnswers?.has(waitKey)) {
                        botManager.waitingAnswers.delete(waitKey);
                    }
                    reject(new Error(`Failed to wait for answer: ${error.message}`));
                }
            });
        };

        // Simple ask method
        this.ask = (question, options = {}) => 
            this.sendMessage(this.context.chatId, question, { parse_mode: 'HTML', ...options });

        // Python integration
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCode(code);
        };

        // ✅ FIXED: METADATA INSPECTION METHODS
        this.getOriginalResponse = async (target = 'all') => {
            try {
                let response;

                switch (target.toLowerCase()) {
                    case 'chat': case 'channel': case 'group':
                        response = await this.bot.getChat(this.context.chatId);
                        break;

                    case 'user': case 'userinfo':
                        if (this.context.msg?.from) {
                            response = this.context.msg.from;
                        } else {
                            response = await this.bot.getChatMember(this.context.chatId, this.context.userId);
                        }
                        break;

                    case 'bot': case 'botinfo':
                        response = await this.bot.getMe();
                        break;

                    case 'update': case 'context':
                        response = this.context.msg || this.context;
                        break;

                    case 'all': case 'everything':
                        const [chat, user, bot, update] = await Promise.all([
                            this.bot.getChat(this.context.chatId).catch(() => null),
                            this.bot.getChatMember(this.context.chatId, this.context.userId).catch(() => this.context.msg?.from),
                            this.bot.getMe().catch(() => null),
                            this.context.msg || this.context
                        ]);
                        response = { chat, user, bot, update };
                        break;

                    default:
                        if (typeof target === 'number' || target.startsWith('@')) {
                            if (typeof target === 'number') {
                                if (target > 0) {
                                    response = await this.bot.getChatMember(this.context.chatId, target);
                                } else {
                                    response = await this.bot.getChat(target);
                                }
                            } else {
                                response = { username: target.substring(1), note: 'Username resolution not implemented' };
                            }
                        } else {
                            response = await this.bot.getChat(this.context.chatId);
                        }
                }

                return {
                    success: true,
                    type: 'original_response',
                    target: target,
                    data: response,
                    timestamp: new Date().toISOString()
                };

            } catch (error) {
                return {
                    success: false,
                    type: 'original_response',
                    target: target,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        };

        // ✅ FIXED: ALIASES FOR METADATA METHODS
        this.metaData = this.getOriginalResponse;
        this.metadata = this.getOriginalResponse;
        this.getMeta = this.getOriginalResponse;
        this.inspect = this.getOriginalResponse;

        // Context analysis
        this.analyzeContext = () => ({
            user: this.getUser(),
            chat: this.context.msg?.chat || { id: this.context.chatId, type: 'private' },
            message: this.context.msg,
            bot: {
                token: this.context.botToken?.substring(0, 10) + '...',
                chatId: this.context.chatId,
                userId: this.context.userId
            },
            input: this.context.userInput,
            params: this.context.userInput ? this.context.userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
            timestamp: new Date().toISOString()
        });

        this.getContext = this.analyzeContext;
    }
}

module.exports = ApiWrapper;