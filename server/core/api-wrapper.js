// server/core/api-wrapper.js - COMPLETELY FIXED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
    }

    setupAllMethods() {
        // COMPLETE Telegram Bot API Methods
        const allMethods = [
            // === MESSAGE METHODS ===
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',

            // === MESSAGE EDITING ===
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',

            // === MESSAGE MANAGEMENT ===
            'deleteMessage', 'deleteMessages',

            // === CHAT METHODS ===
            'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
            'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
            'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
            'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember',
            'banChatSenderChat', 'unbanChatSenderChat', 'setChatStickerSet',
            'deleteChatStickerSet',

            // === CHAT MANAGEMENT ===
            'getChatMenuButton', 'setChatMenuButton',
            'leaveChat', 'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages',

            // === STICKER METHODS ===
            'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
            'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
            'setStickerPositionInSet', 'deleteStickerFromSet', 'setStickerSetThumbnail',
            'setStickerSetThumb', 'setStickerEmojiList', 'setStickerKeywords',
            'setStickerMaskPosition', 'setStickerSetTitle',

            // === FORUM & TOPIC METHODS ===
            'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
            'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
            'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',

            // === INLINE & CALLBACK ===
            'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
            'answerPreCheckoutQuery', 'answerShippingQuery',

            // === PAYMENT METHODS ===
            'sendInvoice', 'createInvoiceLink', 'refundStarPayment',

            // === BOT MANAGEMENT ===
            'getMe', 'logOut', 'close', 'getMyCommands', 'setMyCommands',
            'deleteMyCommands', 'getMyDescription', 'setMyDescription',
            'getMyShortDescription', 'setMyShortDescription', 'getMyName',
            'setMyName', 'getMyDefaultAdministratorRights', 'setMyDefaultAdministratorRights',

            // === GAME METHODS ===
            'sendGame', 'setGameScore', 'getGameHighScores',

            // === FILE METHODS ===
            'getFile', 'downloadFile'
        ];

        // Bind all methods to this instance with FIXED chatId handling
        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // ✅ FIXED: Smart chatId handling
                        let finalArgs = [...args];
                        
                        if (this.needsChatId(method)) {
                            // If first arg is NOT a number (chatId), then auto-add current chatId
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                            // If first arg IS a number (chatId), use it directly
                        }
                        
                        const result = await this.bot[method](...finalArgs);
                        console.log(`✅ API ${method} executed successfully`);
                        return result;
                    } catch (error) {
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            } else {
                console.warn(`⚠️ Method ${method} not available in bot instance`);
            }
        });

        // Enhanced utility methods
        this.setupEnhancedMethods();
    }

    // ✅ FIXED: needsChatId method
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

        // Enhanced send methods
        this.send = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        };

        this.reply = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Keyboard helpers
        this.sendKeyboard = (text, buttons, options = {}) => {
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

        // Media helpers
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

        this.sendVideo = (video, caption = '', options = {}) => {
            return this.sendVideo(this.context.chatId, video, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Bulk operations
        this.sendBulkMessages = async (messages, delay = 1000) => {
            const results = [];
            for (const message of messages) {
                try {
                    const result = await this.sendMessage(this.context.chatId, message);
                    results.push({ success: true, result });
                    await this.wait(delay);
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            return results;
        };

        // Python integration
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCode(code);
        };

        this.installPython = async (library) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.installPythonLibrary(library);
        };

        this.uninstallPython = async (library) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.uninstallPythonLibrary(library);
        };

        // Utility methods
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // ✅ FIXED: Wait for answer with timeout - IMPROVED VERSION
        this.waitForAnswer = (question, options = {}) => {
            return new Promise(async (resolve, reject) => {
                // Validate context
                if (!this.context || !this.context.botToken || !this.context.chatId || !this.context.userId) {
                    console.error('❌ waitForAnswer: Missing context data');
                    reject(new Error('Context data not available for waitForAnswer'));
                    return;
                }

                const timeout = options.timeout || 60000; // 60 seconds
                const nextCommandKey = `${this.context.botToken}_${this.context.userId}`;
                
                console.log(`⏳ Setting up waitForAnswer for user: ${this.context.userId}`);
                
                // Get botManager instance
                let botManager;
                try {
                    botManager = require('./bot-manager');
                } catch (error) {
                    console.error('❌ Bot manager not available:', error);
                    reject(new Error('Bot manager not available'));
                    return;
                }

                // Clear existing handler
                if (botManager.waitingAnswers && botManager.waitingAnswers.has(nextCommandKey)) {
                    botManager.waitingAnswers.delete(nextCommandKey);
                }

                const timeoutId = setTimeout(() => {
                    if (botManager.waitingAnswers && botManager.waitingAnswers.has(nextCommandKey)) {
                        botManager.waitingAnswers.delete(nextCommandKey);
                    }
                    reject(new Error(`Wait for answer timeout (${timeout/1000} seconds)`));
                }, timeout);

                try {
                    // Send question to user
                    console.log(`📤 Sending question to user ${this.context.userId}: "${question}"`);
                    await this.sendMessage(this.context.chatId, question, {
                        parse_mode: 'HTML',
                        ...options
                    });
                    
                    console.log(`✅ Question sent, waiting for answer from user: ${this.context.userId}`);
                    
                    // Set up the waiting state
                    const waitingPromise = new Promise((innerResolve, innerReject) => {
                        // Store the resolve function in botManager
                        if (!botManager.waitingAnswers) {
                            botManager.waitingAnswers = new Map();
                        }
                        
                        botManager.waitingAnswers.set(nextCommandKey, {
                            resolve: innerResolve,
                            reject: innerReject,
                            timeoutId: timeoutId,
                            timestamp: Date.now()
                        });
                    });

                    // Wait for user's response
                    const userResponse = await waitingPromise;
                    
                    console.log(`🎉 Received answer from user: "${userResponse}"`);
                    resolve({
                        text: userResponse,
                        userId: this.context.userId,
                        chatId: this.context.chatId,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    console.error(`❌ waitForAnswer failed:`, error);
                    clearTimeout(timeoutId);
                    
                    // Cleanup
                    if (botManager.waitingAnswers && botManager.waitingAnswers.has(nextCommandKey)) {
                        botManager.waitingAnswers.delete(nextCommandKey);
                    }
                    
                    reject(new Error(`Failed to wait for answer: ${error.message}`));
                }
            });
        };

        // ✅ NEW: Simple ask method without waiting
        this.ask = (question, options = {}) => {
            return this.sendMessage(this.context.chatId, question, {
                parse_mode: 'HTML',
                ...options
            });
        };

        // File download helper
        this.downloadFile = async (fileId, downloadPath = null) => {
            const file = await this.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${this.context.botToken}/${file.file_path}`;
            
            if (downloadPath) {
                const fs = require('fs');
                const axios = require('axios');
                const response = await axios({
                    method: 'GET',
                    url: fileUrl,
                    responseType: 'stream'
                });
                
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