// server/core/api-wrapper.js - COMPLETELY FIXED AND ENHANCED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupMetadataMethods();
        this.setupUserDataMethods();
        this.setupBotDataMethods(); // ✅ NEW: BotData methods added
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

    // ✅ FIXED: METADATA METHODS SETUP - ORIGINAL RESPONSE ONLY
    setupMetadataMethods() {
        // 🔍 METADATA METHODS - ORIGINAL RESPONSE ONLY
        this.metadata = async (target = 'message') => {
            return await this.getOriginalMetadata(target);
        };

        this.metaData = async (target = 'message') => {
            return await this.getOriginalMetadata(target);
        };

        this.Metadata = async (target = 'message') => {
            return await this.getOriginalMetadata(target);
        };

        this.METADATA = async (target = 'message') => {
            return await this.getOriginalMetadata(target);
        };
    }

    // ✅ FIXED: USER DATA METHODS SETUP
    setupUserDataMethods() {
        // User data methods
        this.User = {
            getData: async (key) => {
                return await this.getUserData(key);
            },
            
            saveData: async (key, value) => {
                return await this.saveUserData(key, value);
            },
            
            deleteData: async (key) => {
                return await this.deleteUserData(key);
            },
            
            increment: async (key, amount = 1) => {
                return await this.incrementUserData(key, amount);
            }
        };
    }

    // ✅ NEW: BOT DATA METHODS SETUP
    setupBotDataMethods() {
        // Bot data methods
        this.BotData = {
            getData: async (key) => {
                return await this.getBotData(key);
            },
            
            saveData: async (key, value) => {
                return await this.saveBotData(key, value);
            },
            
            deleteData: async (key) => {
                return await this.deleteBotData(key);
            }
        };
    }

    // 🎯 GET ORIGINAL METADATA - RAW JSON RESPONSE ONLY
    async getOriginalMetadata(target = 'message') {
        try {
            let originalData;

            switch (target.toLowerCase()) {
                case 'message':
                case 'msg':
                    originalData = this.context.msg || {};
                    break;

                case 'user':
                case 'from':
                    originalData = this.context.msg?.from || {};
                    break;

                case 'chat':
                    originalData = this.context.msg?.chat || {};
                    break;

                case 'update':
                    originalData = {
                        message: this.context.msg,
                        chat: this.context.msg?.chat,
                        from: this.context.msg?.from,
                        context: {
                            chatId: this.context.chatId,
                            userId: this.context.userId,
                            username: this.context.username,
                            botToken: this.context.botToken?.substring(0, 10) + '...'
                        }
                    };
                    break;

                case 'bot':
                    try {
                        originalData = await this.bot.getMe();
                    } catch (error) {
                        originalData = { error: error.message };
                    }
                    break;

                default:
                    // If specific field requested
                    if (this.context.msg && this.context.msg[target]) {
                        originalData = this.context.msg[target];
                    } else {
                        originalData = {
                            message: this.context.msg,
                            chat: this.context.msg?.chat,
                            from: this.context.msg?.from,
                            context: this.context
                        };
                    }
            }

            // Return pure JSON response
            return {
                success: true,
                type: 'metadata',
                target: target,
                data: originalData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Metadata error:', error);
            return {
                success: false,
                error: error.message,
                type: 'metadata',
                target: target,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ✅ FIXED: USER DATA METHODS WITH VALIDATION
    async getUserData(key) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('User data key must be a non-empty string');
            }

            if (!this.context.botToken || !this.context.userId) {
                throw new Error('Bot token or user ID not available');
            }

            const supabase = require('../config/supabase');
            
            const { data, error } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'user_data')
                .eq('bot_token', this.context.botToken)
                .eq('user_id', this.context.userId.toString())
                .eq('data_key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Not found - return null instead of throwing
                }
                console.error('❌ Database error in getUserData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (data && data.data_value) {
                try {
                    return JSON.parse(data.data_value);
                } catch (parseError) {
                    console.warn('⚠️ Failed to parse user data as JSON, returning as string');
                    return data.data_value;
                }
            }

            return null;

        } catch (error) {
            console.error('❌ Get user data error:', error);
            throw new Error(`Failed to get user data: ${error.message}`);
        }
    }

    async saveUserData(key, value) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('User data key must be a non-empty string');
            }
            if (value === undefined || value === null) {
                throw new Error('User data value cannot be null or undefined');
            }

            if (!this.context.botToken || !this.context.userId) {
                throw new Error('Bot token or user ID not available');
            }

            const supabase = require('../config/supabase');
            
            const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            
            const { error } = await supabase
                .from('universal_data')
                .upsert({
                    data_type: 'user_data',
                    bot_token: this.context.botToken,
                    user_id: this.context.userId.toString(),
                    data_key: key,
                    data_value: serializedValue,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'data_type,bot_token,user_id,data_key'
                });

            if (error) {
                console.error('❌ Database error in saveUserData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            return value;

        } catch (error) {
            console.error('❌ Save user data error:', error);
            throw new Error(`Failed to save user data: ${error.message}`);
        }
    }

    async deleteUserData(key) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('User data key must be a non-empty string');
            }

            if (!this.context.botToken || !this.context.userId) {
                throw new Error('Bot token or user ID not available');
            }

            const supabase = require('../config/supabase');
            
            const { error } = await supabase
                .from('universal_data')
                .delete()
                .eq('data_type', 'user_data')
                .eq('bot_token', this.context.botToken)
                .eq('user_id', this.context.userId.toString())
                .eq('data_key', key);

            if (error) {
                console.error('❌ Database error in deleteUserData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            return true;

        } catch (error) {
            console.error('❌ Delete user data error:', error);
            throw new Error(`Failed to delete user data: ${error.message}`);
        }
    }

    async incrementUserData(key, amount = 1) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('User data key must be a non-empty string');
            }
            if (typeof amount !== 'number' || isNaN(amount)) {
                throw new Error('Increment amount must be a valid number');
            }

            const currentValue = await this.getUserData(key);
            const newValue = (parseInt(currentValue) || 0) + amount;
            await this.saveUserData(key, newValue);
            return newValue;
        } catch (error) {
            console.error('❌ Increment user data error:', error);
            throw new Error(`Failed to increment user data: ${error.message}`);
        }
    }

    // ✅ NEW: BOT DATA METHODS
    async getBotData(key) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('Bot data key must be a non-empty string');
            }

            if (!this.context.botToken) {
                throw new Error('Bot token not available');
            }

            const supabase = require('../config/supabase');
            
            const { data, error } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'bot_data')
                .eq('bot_token', this.context.botToken)
                .eq('data_key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Not found
                }
                console.error('❌ Database error in getBotData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (data && data.data_value) {
                try {
                    return JSON.parse(data.data_value);
                } catch (parseError) {
                    console.warn('⚠️ Failed to parse bot data as JSON, returning as string');
                    return data.data_value;
                }
            }

            return null;

        } catch (error) {
            console.error('❌ Get bot data error:', error);
            throw new Error(`Failed to get bot data: ${error.message}`);
        }
    }

    async saveBotData(key, value) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('Bot data key must be a non-empty string');
            }
            if (value === undefined || value === null) {
                throw new Error('Bot data value cannot be null or undefined');
            }

            if (!this.context.botToken) {
                throw new Error('Bot token not available');
            }

            const supabase = require('../config/supabase');
            
            const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            
            const { error } = await supabase
                .from('universal_data')
                .upsert({
                    data_type: 'bot_data',
                    bot_token: this.context.botToken,
                    data_key: key,
                    data_value: serializedValue,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'data_type,bot_token,data_key'
                });

            if (error) {
                console.error('❌ Database error in saveBotData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            return value;

        } catch (error) {
            console.error('❌ Save bot data error:', error);
            throw new Error(`Failed to save bot data: ${error.message}`);
        }
    }

    async deleteBotData(key) {
        try {
            // ✅ INPUT VALIDATION
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('Bot data key must be a non-empty string');
            }

            if (!this.context.botToken) {
                throw new Error('Bot token not available');
            }

            const supabase = require('../config/supabase');
            
            const { error } = await supabase
                .from('universal_data')
                .delete()
                .eq('data_type', 'bot_data')
                .eq('bot_token', this.context.botToken)
                .eq('data_key', key);

            if (error) {
                console.error('❌ Database error in deleteBotData:', error);
                throw new Error(`Database error: ${error.message}`);
            }

            return true;

        } catch (error) {
            console.error('❌ Delete bot data error:', error);
            throw new Error(`Failed to delete bot data: ${error.message}`);
        }
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

        // ✅ IMPROVED: Wait for answer with better error handling
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
                    const oldHandler = botManager.waitingAnswers.get(nextCommandKey);
                    if (oldHandler && oldHandler.timeoutId) {
                        clearTimeout(oldHandler.timeoutId);
                    }
                    botManager.waitingAnswers.delete(nextCommandKey);
                }

                let timeoutId = null;

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
                        
                        timeoutId = setTimeout(() => {
                            if (botManager.waitingAnswers.has(nextCommandKey)) {
                                botManager.waitingAnswers.delete(nextCommandKey);
                            }
                            innerReject(new Error(`Wait for answer timeout (${timeout/1000} seconds)`));
                        }, timeout);

                        botManager.waitingAnswers.set(nextCommandKey, {
                            resolve: innerResolve,
                            reject: innerReject,
                            timeoutId: timeoutId,
                            timestamp: Date.now(),
                            question: question
                        });
                    });

                    // Wait for user's response
                    const userResponse = await waitingPromise;
                    
                    // Clean up timeout
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    
                    console.log(`🎉 Received answer from user: "${userResponse}"`);
                    resolve({
                        text: userResponse,
                        userId: this.context.userId,
                        chatId: this.context.chatId,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    console.error(`❌ waitForAnswer failed:`, error);
                    
                    // Clean up timeout
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    
                    // Cleanup from botManager
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
                    responseType: 'stream',
                    timeout: 30000 // 30 second timeout
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