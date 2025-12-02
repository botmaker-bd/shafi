const fs = require('fs');
const axios = require('axios'); // Ensure axios is installed: npm install axios

class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupMetadataMethods();
        this.setupEnhancedMethods();
    }

    // ✅ FIXED: Robust Chat ID Injection (Same logic as command-executor)
    setupAllMethods() {
        const allMethods = [
            // Messages
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',
            // Editing
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',
            // Chat & Members
            'deleteMessage', 'deleteMessages', 'pinChatMessage', 'unpinChatMessage',
            'leaveChat', 'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription', 'setChatPhoto',
            'deleteChatPhoto', 'setChatPermissions', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember', 'approveChatJoinRequest', 
            'declineChatJoinRequest', 'setChatStickerSet', 'deleteChatStickerSet',
            // Stickers & Forum
            'sendSticker', 'uploadStickerFile', 'createForumTopic', 'editForumTopic',
            'closeForumTopic', 'reopenForumTopic', 'deleteForumTopic',
            // Others
            'answerCallbackQuery', 'answerInlineQuery', 'getFile', 'downloadFile',
            'getMe', 'logOut', 'close'
        ];

        // Helper to validate Chat ID
        const isChatId = (val) => {
            if (!val) return false;
            if (typeof val === 'number') return Number.isInteger(val) && Math.abs(val) > 200;
            if (typeof val === 'string') return val.startsWith('@') || /^-?\d+$/.test(val);
            return false;
        };

        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // 🛡️ SMART ARGUMENT INJECTION
                        const noChatIdMethods = [
                            'getMe', 'getWebhookInfo', 'deleteWebhook', 'setWebhook',
                            'answerCallbackQuery', 'answerInlineQuery', 'stopPoll', 
                            'downloadFile', 'logOut', 'close'
                        ];

                        if (!noChatIdMethods.includes(method)) {
                            let shouldInject = false;
                            
                            // Case 1: sendLocation (lat, long) -> Inject
                            if (method === 'sendLocation') {
                                if (args.length === 2 || (args.length === 3 && typeof args[2] === 'object')) {
                                    shouldInject = true;
                                }
                            }
                            // Case 2: sendMediaGroup (Array) -> Inject
                            else if (method === 'sendMediaGroup') {
                                if (Array.isArray(args[0])) shouldInject = true;
                            }
                            // Case 3: General Methods
                            else {
                                if (args.length === 0 || !isChatId(args[0])) {
                                    if (method.startsWith('send') || method.startsWith('forward') || method.startsWith('copy')) {
                                        shouldInject = true;
                                    }
                                }
                            }

                            if (shouldInject) {
                                args.unshift(this.context.chatId);
                            }
                        }

                        const result = await this.bot[method](...args);
                        return result;
                    } catch (error) {
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw new Error(`API Error (${method}): ${error.message}`);
                    }
                };
            }
        });
    }

    setupMetadataMethods() {
        // Aliases for metadata inspection
        this.metaData = this.metadata = this.getMeta = this.inspect = async (target = 'all') => {
            return await this.getOriginalResponse(target);
        };
    }

    async getOriginalResponse(target = 'all') {
        try {
            let data;
            const t = target.toLowerCase();
            
            if (t === 'chat' || t === 'group') data = await this.bot.getChat(this.context.chatId);
            else if (t === 'user') data = await this.bot.getChatMember(this.context.chatId, this.context.userId);
            else if (t === 'bot') data = await this.bot.getMe();
            else if (t === 'msg' || t === 'message') data = this.context.msg;
            else if (t === 'all') {
                data = {
                    msg: this.context.msg,
                    chat: await this.bot.getChat(this.context.chatId).catch(()=>null),
                    user: await this.bot.getChatMember(this.context.chatId, this.context.userId).catch(()=>null)
                };
            } else {
                data = this.context.msg;
            }
            return data;
        } catch (e) { return { error: e.message }; }
    }

    setupEnhancedMethods() {
        // User Info Helper
        this.getUser = () => ({
            id: this.context.userId,
            username: this.context.username,
            first_name: this.context.first_name,
            chat_id: this.context.chatId
        });

        // Shortcuts
        this.send = (text, opt) => this.sendMessage(this.context.chatId, text, { parse_mode: 'HTML', ...opt });
        this.reply = (text, opt) => this.sendMessage(this.context.chatId, text, { 
            reply_to_message_id: this.context.msg?.message_id, parse_mode: 'HTML', ...opt 
        });

        // Media Helpers
        this.sendImage = (url, caption, opt) => this.sendPhoto(this.context.chatId, url, { caption, parse_mode: 'HTML', ...opt });
        this.sendFile = (url, caption, opt) => this.sendDocument(this.context.chatId, url, { caption, parse_mode: 'HTML', ...opt });

        // Utility
        this.wait = (sec) => new Promise(r => setTimeout(r, sec * 1000));
        this.sleep = this.wait;

        // Python Integration
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCodeAsync(code);
        };

        // ✅ FIXED: waitForAnswer using CONTEXT (No Circular Dependency)
        this.waitForAnswer = (question, options = {}) => {
            return new Promise(async (resolve, reject) => {
                const { nextCommandHandlers, botToken, userId, chatId } = this.context;
                
                if (!nextCommandHandlers) {
                    return reject(new Error('Handler system not available in context'));
                }

                const waitKey = `${botToken}_${userId}`;
                const timeoutMs = options.timeout || 60000; // 60s default

                // Clear previous handler if exists
                if (nextCommandHandlers.has(waitKey)) nextCommandHandlers.delete(waitKey);

                // Timeout Logic
                const timeoutId = setTimeout(() => {
                    if (nextCommandHandlers.has(waitKey)) {
                        nextCommandHandlers.delete(waitKey);
                        reject(new Error(`Timeout: No answer after ${timeoutMs/1000}s`));
                    }
                }, timeoutMs);

                // Ask the question
                try {
                    await this.sendMessage(chatId, question, { parse_mode: 'HTML', ...options });
                    
                    // Register Handler
                    nextCommandHandlers.set(waitKey, {
                        resolve: (answer) => {
                            clearTimeout(timeoutId);
                            resolve(answer);
                        },
                        reject: (err) => {
                            clearTimeout(timeoutId);
                            reject(err);
                        },
                        timestamp: Date.now()
                    });
                    
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(new Error(`Failed to send question: ${error.message}`));
                }
            });
        };

        // Alias for waitForAnswer
        this.ask = this.waitForAnswer;

        // ✅ File Download Helper
        this.downloadFile = async (fileId, downloadPath = null) => {
            const file = await this.bot.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${this.context.botToken}/${file.file_path}`;
            
            if (downloadPath) {
                const response = await axios({ method: 'GET', url: fileUrl, responseType: 'stream' });
                response.data.pipe(fs.createWriteStream(downloadPath));
                return new Promise((resolve, reject) => {
                    response.data.on('end', () => resolve(downloadPath));
                    response.data.on('error', reject);
                });
            }
            return fileUrl;
        };
    }
}

module.exports = ApiWrapper;