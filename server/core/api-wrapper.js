// server/core/api-wrapper.js - COMPLETE WORKING VERSION
const axios = require('axios');

class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupDirectMethods();
        this.setupInspectionMethods();
    }

    setupAllMethods() {
        // All Telegram Bot API Methods
        const allMethods = [
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',
            'deleteMessage', 'deleteMessages', 'getChat', 'getChatAdministrators', 
            'getChatMemberCount', 'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
            'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
            'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
            'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember', 'banChatSenderChat', 
            'unbanChatSenderChat', 'setChatStickerSet', 'deleteChatStickerSet',
            'getChatMenuButton', 'setChatMenuButton', 'leaveChat', 'pinChatMessage', 
            'unpinChatMessage', 'unpinAllChatMessages', 'sendSticker', 'getStickerSet', 
            'getCustomEmojiStickers', 'uploadStickerFile', 'createNewStickerSet', 
            'addStickerToSet', 'setStickerPositionInSet', 'deleteStickerFromSet', 
            'setStickerSetThumbnail', 'setStickerSetThumb', 'setStickerEmojiList', 
            'setStickerKeywords', 'setStickerMaskPosition', 'setStickerSetTitle',
            'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
            'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
            'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',
            'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
            'answerPreCheckoutQuery', 'answerShippingQuery', 'sendInvoice', 
            'createInvoiceLink', 'refundStarPayment', 'getMe', 'logOut', 'close', 
            'getMyCommands', 'setMyCommands', 'deleteMyCommands', 'getMyDescription', 
            'setMyDescription', 'getMyShortDescription', 'setMyShortDescription', 
            'getMyName', 'setMyName', 'getMyDefaultAdministratorRights', 
            'setMyDefaultAdministratorRights', 'sendGame', 'setGameScore', 
            'getGameHighScores', 'getFile', 'downloadFile'
        ];

        // Bind all methods
        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        let finalArgs = [...args];
                        
                        if (this.needsChatId(method)) {
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                        }
                        
                        const result = await this.bot[method](...finalArgs);
                        return result;
                    } catch (error) {
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            }
        });
    }

    setupDirectMethods() {
        // Simple send with HTML default
        this.send = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        };

        // Reply to current message
        this.reply = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Keyboard helpers
        this.sendInlineKeyboard = (text, buttons, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_markup: { inline_keyboard: buttons },
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendReplyKeyboard = (text, buttons, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_markup: {
                    keyboard: buttons,
                    resize_keyboard: true,
                    one_time_keyboard: options.one_time || false
                },
                parse_mode: 'HTML',
                ...options
            });
        };

        this.removeKeyboard = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML',
                ...options
            });
        };

        // Media shortcuts
        this.sendImage = (photo, caption = '', options = {}) => {
            return this.sendPhoto(this.context.chatId, photo, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendFile = (document, caption = '', options = {}) => {
            return this.sendDocument(this.context.chatId, document, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendVideoFile = (video, caption = '', options = {}) => {
            return this.sendVideo(this.context.chatId, video, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Bulk messages
        this.sendBulk = async (messages, delay = 1000) => {
            const results = [];
            for (const message of messages) {
                try {
                    const result = await this.sendMessage(this.context.chatId, message);
                    results.push({ success: true, result });
                    await new Promise(r => setTimeout(r, delay));
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            return results;
        };

        // ✅ WORKING: Download file
        this.downloadFile = async (fileId, downloadPath = null) => {
            try {
                const file = await this.getFile(fileId);
                const fileUrl = `https://api.telegram.org/file/bot${this.context.botToken}/${file.file_path}`;
                
                if (downloadPath) {
                    const fs = require('fs');
                    const response = await axios({
                        method: 'GET',
                        url: fileUrl,
                        responseType: 'stream'
                    });
                    
                    const writer = fs.createWriteStream(downloadPath);
                    response.data.pipe(writer);
                    
                    return new Promise((resolve, reject) => {
                        writer.on('finish', () => resolve(downloadPath));
                        writer.on('error', reject);
                    });
                }
                
                return fileUrl;
            } catch (error) {
                throw new Error(`Download failed: ${error.message}`);
            }
        };

        // Wait utility
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        this.sleep = this.wait;
        this.delay = this.wait;
    }

    setupInspectionMethods() {
        // ✅ FIXED: Universal inspect method
        this.inspect = async (target = 'all', options = {}) => {
            try {
                const format = options.format || 'json';
                const includeRaw = options.includeRaw || false;
                
                let result = {};
                
                // Determine what to inspect
                const targets = target.toLowerCase().split(',').map(t => t.trim());
                
                for (const t of targets) {
                    switch (t) {
                        case 'all':
                        case 'everything':
                            result.bot = await this.getMe();
                            result.chat = await this.getChat(this.context.chatId);
                            result.user = this.context.msg?.from || { id: this.context.userId };
                            result.message = this.context.msg;
                            result.context = {
                                chatId: this.context.chatId,
                                userId: this.context.userId,
                                userInput: this.context.userInput,
                                params: this.context.params,
                                botToken: this.context.botToken?.substring(0, 10) + '...'
                            };
                            result.timestamp = new Date().toISOString();
                            break;
                            
                        case 'bot':
                        case 'botinfo':
                            result.bot = await this.getMe();
                            break;
                            
                        case 'chat':
                        case 'channel':
                        case 'group':
                            result.chat = await this.getChat(this.context.chatId);
                            break;
                            
                        case 'user':
                        case 'userinfo':
                            if (this.context.msg?.from) {
                                result.user = this.context.msg.from;
                            } else {
                                try {
                                    result.user = await this.getChatMember(this.context.chatId, this.context.userId);
                                } catch (e) {
                                    result.user = { id: this.context.userId, note: 'Could not fetch user details' };
                                }
                            }
                            break;
                            
                        case 'message':
                        case 'msg':
                            result.message = this.context.msg;
                            break;
                            
                        case 'context':
                        case 'ctx':
                            result.context = {
                                chatId: this.context.chatId,
                                userId: this.context.userId,
                                userInput: this.context.userInput,
                                params: this.context.params,
                                botToken: this.context.botToken?.substring(0, 10) + '...'
                            };
                            break;
                            
                        case 'update':
                            result.update = this.context.msg;
                            break;
                            
                        case 'response':
                        case 'call':
                            // For API call responses
                            result.note = 'Use specific API methods for responses';
                            break;
                            
                        default:
                            // Try to get as chat or user
                            if (t.startsWith('@')) {
                                result.username = t.substring(1);
                                result.note = 'Username resolution requires specific API calls';
                            } else if (!isNaN(t)) {
                                const id = parseInt(t);
                                if (id > 0) {
                                    try {
                                        result.user = await this.getChatMember(this.context.chatId, id);
                                    } catch (e) {
                                        result.user = { id: id, note: 'Could not fetch user' };
                                    }
                                } else {
                                    try {
                                        result.chat = await this.getChat(id);
                                    } catch (e) {
                                        result.chat = { id: id, note: 'Could not fetch chat' };
                                    }
                                }
                            }
                    }
                }
                
                // Include raw response if requested
                if (includeRaw) {
                    result._raw = JSON.parse(JSON.stringify(result));
                }
                
                // Format output
                if (format === 'text') {
                    return this.formatInspectionText(result);
                } else if (format === 'pretty') {
                    return JSON.stringify(result, null, 2);
                }
                
                return result;
                
            } catch (error) {
                console.error('❌ Inspection error:', error);
                return {
                    error: error.message,
                    target: target,
                    timestamp: new Date().toISOString()
                };
            }
        };
        
        // ✅ FIXED: getInfo method (alias for inspect)
        this.getInfo = async (target = 'all') => {
            return await this.inspect(target, { format: 'json' });
        };
        
        // ✅ FIXED: details method
        this.details = async (target = 'all') => {
            return await this.inspect(target, { format: 'pretty' });
        };
        
        // ✅ FIXED: User object with toString
        this.getUser = () => {
            if (this.context.msg?.from) {
                const userObj = this.context.msg.from;
                
                // Add chat_id for convenience
                userObj.chat_id = this.context.chatId;
                
                // Override toString to return name
                userObj.toString = function() {
                    if (this.first_name && this.last_name) {
                        return `${this.first_name} ${this.last_name}`;
                    }
                    return this.first_name || this.username || `User${this.id}`;
                };
                
                userObj.valueOf = function() {
                    return this.toString();
                };
                
                // Add toJSON to control JSON serialization
                userObj.toJSON = function() {
                    return {
                        id: this.id,
                        first_name: this.first_name,
                        last_name: this.last_name,
                        username: this.username,
                        language_code: this.language_code,
                        is_bot: this.is_bot,
                        chat_id: this.chat_id
                    };
                };
                
                return userObj;
            }
            
            const fallbackObj = {
                id: this.context.userId,
                first_name: 'User',
                chat_id: this.context.chatId,
                toString: () => 'User',
                valueOf: () => 'User',
                toJSON: () => ({
                    id: this.context.userId,
                    first_name: 'User',
                    chat_id: this.context.chatId
                })
            };
            
            return fallbackObj;
        };
    }

    formatInspectionText(data) {
        let text = '🔍 *Inspection Results*\n\n';
        
        if (data.bot) {
            text += `🤖 *Bot:* ${data.bot.first_name} (@${data.bot.username})\n`;
        }
        
        if (data.chat) {
            text += `💬 *Chat:* ${data.chat.title || 'Private'}\n`;
            text += `   Type: ${data.chat.type}\n`;
            text += `   ID: ${data.chat.id}\n`;
        }
        
        if (data.user) {
            const user = data.user;
            text += `👤 *User:* ${user.first_name || 'Unknown'}\n`;
            if (user.last_name) text += `   Last: ${user.last_name}\n`;
            if (user.username) text += `   @${user.username}\n`;
            text += `   ID: ${user.id}\n`;
        }
        
        if (data.message) {
            text += `📨 *Message ID:* ${data.message.message_id}\n`;
            if (data.message.text) {
                text += `   Text: ${data.message.text.substring(0, 50)}${data.message.text.length > 50 ? '...' : ''}\n`;
            }
        }
        
        text += `\n⏰ *Time:* ${data.timestamp || new Date().toISOString()}`;
        
        return text;
    }

    needsChatId(method) {
        const chatIdMethods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio',
            'sendVoice', 'sendLocation', 'sendVenue', 'sendContact', 'sendPoll',
            'sendDice', 'sendChatAction', 'sendMediaGroup', 'forwardMessage',
            'copyMessage', 'deleteMessage', 'deleteMessages', 'pinChatMessage',
            'unpinChatMessage', 'leaveChat', 'getChat', 'getChatAdministrators',
            'getChatMemberCount', 'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions', 'banChatMember',
            'unbanChatMember', 'restrictChatMember', 'promoteChatMember', 'setChatStickerSet',
            'deleteChatStickerSet', 'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'sendSticker'
        ];
        return chatIdMethods.includes(method);
    }

    // Enhanced methods
    setupEnhancedMethods() {
        // Ask method (same as waitForAnswer)
        this.ask = async (question, options = {}) => {
            return new Promise((resolve, reject) => {
                const waitKey = `${this.context.botToken}_${this.context.userId}`;
                const nextCommandHandlers = this.context.nextCommandHandlers;
                
                this.sendMessage(this.context.chatId, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (nextCommandHandlers?.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                            reject(new Error('Timeout: User took too long to respond.'));
                        }
                    }, 5 * 60 * 1000);

                    if (nextCommandHandlers) {
                        nextCommandHandlers.set(waitKey, {
                            resolve: (ans) => { clearTimeout(timeout); resolve(ans); },
                            reject: (err) => { clearTimeout(timeout); reject(err); },
                            timestamp: Date.now()
                        });
                    } else {
                        clearTimeout(timeout);
                        reject(new Error('Handler system error'));
                    }
                }).catch(e => reject(e));
            });
        };

        // Alias for ask
        this.waitForAnswer = this.ask;
        
        // Python runner
        this.runPython = async (code) => {
            try {
                const pythonRunner = require('./python-runner');
                return await pythonRunner.runPythonCode(code);
            } catch (error) {
                throw new Error(`Python Error: ${error.message}`);
            }
        };
        
        // Install python package
        this.installPython = async (packageName) => {
            try {
                const pythonRunner = require('./python-runner');
                return await pythonRunner.installPackage(packageName);
            } catch (error) {
                throw new Error(`Install failed: ${error.message}`);
            }
        };
    }
}

// Add enhanced methods to prototype
ApiWrapper.prototype.setupEnhancedMethods();

module.exports = ApiWrapper;