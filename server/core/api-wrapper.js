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
            'restrictChatMember', 'promoteChatMember', 'setChatAdministratorCustomTitle',
            'banChatSenderChat', 'unbanChatSenderChat', 'setChatStickerSet',
            'deleteChatStickerSet',

            // === CHAT MANAGEMENT ===
            'getChatMenuButton', 'setChatMenuButton', 'getChatMember',
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

        // Bind all methods to this instance
        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // Auto-fill chatId for methods that need it
                        if (this.needsChatId(method) && (args.length === 0 || typeof args[0] !== 'object')) {
                            args.unshift(this.context.chatId);
                        }
                        
                        const result = await this.bot[method](...args);
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
            'reopenForumTopic', 'deleteForumTopic'
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
                reply_to_message_id: this.context.msg.message_id,
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

        // Wait for answer with timeout - FIXED VERSION
// server/core/api-wrapper.js - waitForAnswer মেথড
this.waitForAnswer = (question, options = {}) => {
    return new Promise(async (resolve, reject) => {
        console.log(`🎯 waitForAnswer initiated for user ${this.context.userId}`);
        console.log(`📝 Question: "${question}"`);
        console.log(`🔑 Bot Token: ${this.context.botToken}`);
        console.log(`💬 Chat ID: ${this.context.chatId}`);
        
        // Validate context
        if (!this.context || !this.context.botToken || !this.context.chatId) {
            console.error('❌ waitForAnswer: Missing context data');
            console.error('Context:', this.context);
            reject(new Error('Context data not available'));
            return;
        }

        const timeout = options.timeout || 60000;
        const nextCommandKey = `${this.context.botToken}_${this.context.userId}`;
        
        console.log(`⏳ Setting up waitForAnswer for key: ${nextCommandKey}`);
        console.log(`⏰ Timeout: ${timeout}ms`);
        
        // Clear existing handler
        if (this.context.nextCommandHandlers && this.context.nextCommandHandlers.has(nextCommandKey)) {
            console.log('🔄 Clearing existing handler for this user');
            this.context.nextCommandHandlers.delete(nextCommandKey);
        }

        const timeoutId = setTimeout(() => {
            console.log(`⏰ Timeout reached for key: ${nextCommandKey}`);
            if (this.context.nextCommandHandlers && this.context.nextCommandHandlers.has(nextCommandKey)) {
                this.context.nextCommandHandlers.delete(nextCommandKey);
                console.log('🗑️ Handler removed due to timeout');
            }
            reject(new Error(`Wait for answer timeout (${timeout/1000} seconds)`));
        }, timeout);

        try {
            // ✅ FIXED: Proper sendMessage call with chatId
            console.log(`📤 Sending question to chat: ${this.context.chatId}`);
            await this.sendMessage(this.context.chatId, question, {
                parse_mode: 'HTML',
                ...options
            });
            
            console.log(`✅ Question sent successfully, setting handler for: ${nextCommandKey}`);
            console.log(`📊 Total active handlers: ${this.context.nextCommandHandlers?.size || 0}`);
            
            // Set up handler
            if (!this.context.nextCommandHandlers) {
                console.error('❌ nextCommandHandlers not available in context');
                throw new Error('nextCommandHandlers not available');
            }
            
            this.context.nextCommandHandlers.set(nextCommandKey, (answer, answerMsg) => {
                console.log(`🎉 User response received for key: ${nextCommandKey}`);
                console.log(`📨 Response: "${answer}"`);
                console.log(`👤 From user: ${answerMsg.from.first_name} (${answerMsg.from.id})`);
                
                clearTimeout(timeoutId);
                resolve({
                    text: answer,
                    message: answerMsg,
                    userId: this.context.userId,
                    chatId: this.context.chatId,
                    timestamp: new Date().toISOString()
                });
            });
            
            console.log(`✅ Handler set successfully for key: ${nextCommandKey}`);
            
        } catch (error) {
            console.error(`❌ waitForAnswer setup failed:`, error);
            clearTimeout(timeoutId);
            if (this.context.nextCommandHandlers) {
                this.context.nextCommandHandlers.delete(nextCommandKey);
                console.log(`🗑️ Handler cleaned up due to error: ${nextCommandKey}`);
            }
            reject(new Error(`Failed to set up wait for answer: ${error.message}`));
        }
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