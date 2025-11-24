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

        // Bind all available methods with proper parameter handling
        Object.getOwnPropertyNames(Object.getPrototypeOf(this.bot))
            .filter(method => typeof this.bot[method] === 'function' && method !== 'constructor')
            .forEach(method => {
                this[method] = async (...args) => {
                    try {
                        let finalArgs = [...args];
                        
                        // For methods that need chatId, auto-add it if not provided
                        if (chatIdMethods.includes(method)) {
                            // If first arg is not a number (chatId), prepend chatId
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                        }
                        
                        console.log(`🔧 API Call: ${method}`, { 
                            chatId: this.context.chatId,
                            args: finalArgs.length 
                        });
                        
                        const result = await this.bot[method](...finalArgs);
                        return result;
                    } catch (error) {
                        console.error(`❌ Telegram API Error (${method}):`, error.message);
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

        // Enhanced message methods with proper parameter handling
        this.send = (text, options = {}) => {
            const finalOptions = { 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendMessage(this.context.chatId, text, finalOptions);
        };

        this.reply = (text, options = {}) => {
            const finalOptions = { 
                reply_to_message_id: this.context.msg?.message_id, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendMessage(this.context.chatId, text, finalOptions);
        };

        // Media helpers with proper parameter order
        this.sendImage = (photo, caption = '', options = {}) => {
            const finalOptions = { 
                caption, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendPhoto(this.context.chatId, photo, finalOptions);
        };

        this.sendFile = (document, caption = '', options = {}) => {
            const finalOptions = { 
                caption, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendDocument(this.context.chatId, document, finalOptions);
        };

        this.sendVideoFile = (video, caption = '', options = {}) => {
            const finalOptions = { 
                caption, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendVideo(this.context.chatId, video, finalOptions);
        };

        this.sendAudioFile = (audio, caption = '', options = {}) => {
            const finalOptions = { 
                caption, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendAudio(this.context.chatId, audio, finalOptions);
        };

        this.sendVoiceMessage = (voice, caption = '', options = {}) => {
            const finalOptions = { 
                caption, 
                parse_mode: 'HTML', 
                ...options 
            };
            return this.sendVoice(this.context.chatId, voice, finalOptions);
        };

        // Location helpers
        this.sendLocationMsg = (latitude, longitude, options = {}) => {
            return this.sendLocation(this.context.chatId, latitude, longitude, options);
        };

        this.sendVenueMsg = (latitude, longitude, title, address, options = {}) => {
            return this.sendVenue(this.context.chatId, latitude, longitude, title, address, options);
        };

        this.sendContactMsg = (phoneNumber, firstName, options = {}) => {
            return this.sendContact(this.context.chatId, phoneNumber, firstName, options);
        };

        // Keyboard helpers
        this.sendKeyboard = (text, buttons, options = {}) => {
            const finalOptions = {
                reply_markup: { inline_keyboard: buttons },
                parse_mode: 'HTML',
                ...options
            };
            return this.sendMessage(this.context.chatId, text, finalOptions);
        };

        this.sendReplyKeyboard = (text, buttons, options = {}) => {
            const finalOptions = {
                reply_markup: {
                    keyboard: buttons,
                    resize_keyboard: true,
                    one_time_keyboard: options.one_time || false
                },
                parse_mode: 'HTML',
                ...options
            };
            return this.sendMessage(this.context.chatId, text, finalOptions);
        };

        this.removeKeyboard = (text, options = {}) => {
            const finalOptions = {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML',
                ...options
            };
            return this.sendMessage(this.context.chatId, text, finalOptions);
        };

        // Poll helpers
        this.sendPollMsg = (question, options, pollOptions = {}) => {
            const finalOptions = {
                is_anonymous: false,
                allows_multiple_answers: false,
                ...pollOptions
            };
            return this.sendPoll(this.context.chatId, question, options, finalOptions);
        };

        this.sendQuiz = (question, options, correctOptionId, quizOptions = {}) => {
            const finalOptions = {
                type: "quiz",
                correct_option_id: correctOptionId,
                is_anonymous: false,
                ...quizOptions
            };
            return this.sendPoll(this.context.chatId, question, options, finalOptions);
        };

        this.sendDiceMsg = (emoji = '🎲', options = {}) => {
            return this.sendDice(this.context.chatId, { emoji, ...options });
        };

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

        // Metadata inspection methods
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

        // Aliases for metadata methods
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

        // Markdown escaping utility
        this.escapeMarkdown = (text) => {
            if (typeof text !== 'string') return text;
            return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
        };

        // Safe markdown message sender
        this.sendMarkdown = (text, options = {}) => {
            const escapedText = this.escapeMarkdown(text);
            return this.sendMessage(this.context.chatId, escapedText, { 
                parse_mode: 'Markdown',
                ...options 
            });
        };

        // Safe markdown reply
        this.replyMarkdown = (text, options = {}) => {
            const escapedText = this.escapeMarkdown(text);
            return this.sendMessage(this.context.chatId, escapedText, { 
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'Markdown',
                ...options 
            });
        };
    }
}

module.exports = ApiWrapper;