const fs = require('fs');
const axios = require('axios');

class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupMetadataMethods();
        this.setupEnhancedMethods();
    }

    setupAllMethods() {
        const allMethods = [
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',
            'deleteMessage', 'deleteMessages', 'pinChatMessage', 'unpinChatMessage',
            'leaveChat', 'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription', 'setChatPhoto',
            'deleteChatPhoto', 'setChatPermissions', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember', 'approveChatJoinRequest', 
            'declineChatJoinRequest', 'setChatStickerSet', 'deleteChatStickerSet',
            'sendSticker', 'uploadStickerFile', 'createForumTopic', 'editForumTopic',
            'closeForumTopic', 'reopenForumTopic', 'deleteForumTopic',
            'answerCallbackQuery', 'answerInlineQuery', 'getFile', 'downloadFile',
            'getMe', 'logOut', 'close'
        ];

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
                        const noChatIdMethods = [
                            'getMe', 'getWebhookInfo', 'deleteWebhook', 'setWebhook',
                            'answerCallbackQuery', 'answerInlineQuery', 'stopPoll', 
                            'downloadFile', 'logOut', 'close'
                        ];

                        if (!noChatIdMethods.includes(method)) {
                            let shouldInject = false;
                            
                            if (method === 'sendLocation') {
                                if (args.length === 2 || (args.length === 3 && typeof args[2] === 'object')) shouldInject = true;
                            }
                            else if (method === 'sendMediaGroup') {
                                if (Array.isArray(args[0])) shouldInject = true;
                            }
                            else {
                                if (args.length === 0 || !isChatId(args[0])) {
                                    if (method.startsWith('send') || method.startsWith('forward') || method.startsWith('copy')) shouldInject = true;
                                }
                            }

                            if (shouldInject) args.unshift(this.context.chatId);
                        }

                        return await this.bot[method](...args);
                    } catch (error) {
                        throw new Error(`API Error (${method}): ${error.message}`);
                    }
                };
            }
        });
    }

    setupMetadataMethods() {
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
        this.getUser = () => ({
            id: this.context.userId,
            username: this.context.username,
            first_name: this.context.first_name,
            chat_id: this.context.chatId
        });

        this.send = (text, opt) => this.sendMessage(this.context.chatId, text, { parse_mode: 'HTML', ...opt });
        this.reply = (text, opt) => this.sendMessage(this.context.chatId, text, { 
            reply_to_message_id: this.context.msg?.message_id, parse_mode: 'HTML', ...opt 
        });

        this.wait = (sec) => new Promise(r => setTimeout(r, sec * 1000));
        this.sleep = this.wait;

        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCodeAsync(code);
        };

        // 🔴 FIX: Removed require('./bot-manager'). Using context.nextCommandHandlers directly.
        this.waitForAnswer = (question, options = {}) => {
            return new Promise(async (resolve, reject) => {
                const { nextCommandHandlers, botToken, userId, chatId } = this.context;
                
                if (!nextCommandHandlers) {
                    return reject(new Error('Handler system not available'));
                }

                const waitKey = `${botToken}_${userId}`;
                const timeoutMs = options.timeout || 60000;

                if (nextCommandHandlers.has(waitKey)) nextCommandHandlers.delete(waitKey);

                const timeoutId = setTimeout(() => {
                    if (nextCommandHandlers.has(waitKey)) {
                        nextCommandHandlers.delete(waitKey);
                        reject(new Error(`Timeout (${timeoutMs/1000}s)`));
                    }
                }, timeoutMs);

                try {
                    await this.sendMessage(chatId, question, { parse_mode: 'HTML', ...options });
                    
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

        this.ask = this.waitForAnswer;

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