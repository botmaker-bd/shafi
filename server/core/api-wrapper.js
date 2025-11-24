// server/core/api-wrapper.js - COMPLETELY UPDATED WITH AUTO-AWAIT SUPPORT
const { createClient } = require('@supabase/supabase-js');

class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.pendingPromises = new Set();
        this.setupAllMethods();
        this.setupEnhancedMethods();
        console.log('✅ ApiWrapper initialized with auto-await support');
    }

    setupAllMethods() {
        // COMPLETE Telegram Bot API Methods with AUTO-AWAIT SUPPORT
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

        // Bind all methods to this instance with AUTO-AWAIT SUPPORT
        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // ✅ AUTO-AWAIT: Smart chatId handling
                        let finalArgs = [...args];
                        
                        if (this.needsChatId(method)) {
                            // If first arg is NOT a number (chatId), then auto-add current chatId
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                        }
                        
                        console.log(`🔧 ApiWrapper executing: ${method}`);
                        const result = await this.bot[method](...finalArgs);
                        console.log(`✅ ApiWrapper ${method} executed successfully`);
                        return result;
                    } catch (error) {
                        console.error(`❌ ApiWrapper ${method} failed:`, error.message);
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            } else {
                // Create a dummy method that throws informative error
                this[method] = (...args) => {
                    throw new Error(`Method ${method} is not available in the current bot configuration`);
                };
            }
        });
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
        // User information - SYNCHRONOUS
        this.getUser = () => ({
            id: this.context.userId,
            username: this.context.username,
            first_name: this.context.first_name,
            last_name: this.context.last_name,
            language_code: this.context.language_code,
            chat_id: this.context.chatId,
            is_bot: false,
            is_premium: false,
            added_to_attachment_menu: false
        });

        // Enhanced send methods - AUTO-AWAIT BUILT-IN
        this.send = async (text, options = {}) => {
            return await this.sendMessage(this.context.chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        };

        this.reply = async (text, options = {}) => {
            return await this.sendMessage(this.context.chatId, text, {
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Keyboard helpers - AUTO-AWAIT BUILT-IN
        this.sendKeyboard = async (text, buttons, options = {}) => {
            return await this.sendMessage(this.context.chatId, text, {
                reply_markup: { 
                    inline_keyboard: Array.isArray(buttons[0]) ? buttons : [buttons] 
                },
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendReplyKeyboard = async (text, buttons, options = {}) => {
            return await this.sendMessage(this.context.chatId, text, {
                reply_markup: {
                    keyboard: Array.isArray(buttons[0]) ? buttons : [buttons],
                    resize_keyboard: true,
                    one_time_keyboard: options.one_time || false
                },
                parse_mode: 'HTML',
                ...options
            });
        };

        this.removeKeyboard = async (text, options = {}) => {
            return await this.sendMessage(this.context.chatId, text, {
                reply_markup: { remove_keyboard: true },
                parse_mode: 'HTML',
                ...options
            });
        };

        // Media helpers - AUTO-AWAIT BUILT-IN
        this.sendImage = async (photo, caption = '', options = {}) => {
            return await this.sendPhoto(this.context.chatId, photo, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendFile = async (document, caption = '', options = {}) => {
            return await this.sendDocument(this.context.chatId, document, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendVideoFile = async (video, caption = '', options = {}) => {
            return await this.sendVideo(this.context.chatId, video, {
                caption: caption,
                parse_mode: 'HTML',
                ...options
            });
        };

        // Bulk operations - AUTO-AWAIT BUILT-IN
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

        // Python integration - AUTO-AWAIT BUILT-IN
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCode(code);
        };

        this.installPython = async (library) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.installPythonLibrary(library);
        };

        // Utility methods - AUTO-AWAIT BUILT-IN
        this.wait = async (ms) => {
            console.log(`⏰ Waiting for ${ms}ms...`);
            return new Promise(resolve => setTimeout(() => {
                console.log(`✅ Wait completed: ${ms}ms`);
                resolve(`Waited ${ms}ms`);
            }, ms));
        };

        // ✅ ENHANCED: Wait for answer with better error handling
        this.waitForAnswer = async (question, options = {}) => {
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
                if (botManager.nextCommandHandlers && botManager.nextCommandHandlers.has(nextCommandKey)) {
                    botManager.nextCommandHandlers.delete(nextCommandKey);
                }

                const timeoutId = setTimeout(() => {
                    if (botManager.nextCommandHandlers && botManager.nextCommandHandlers.has(nextCommandKey)) {
                        botManager.nextCommandHandlers.delete(nextCommandKey);
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
                        if (!botManager.nextCommandHandlers) {
                            botManager.nextCommandHandlers = new Map();
                        }
                        
                        botManager.nextCommandHandlers.set(nextCommandKey, {
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
                    if (botManager.nextCommandHandlers && botManager.nextCommandHandlers.has(nextCommandKey)) {
                        botManager.nextCommandHandlers.delete(nextCommandKey);
                    }
                    
                    reject(new Error(`Failed to wait for answer: ${error.message}`));
                }
            });
        };

        // ✅ SIMPLE: Ask method without waiting
        this.ask = async (question, options = {}) => {
            return await this.sendMessage(this.context.chatId, question, {
                parse_mode: 'HTML',
                ...options
            });
        };

        // File download helper - AUTO-AWAIT BUILT-IN
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

        // Data storage methods - AUTO-AWAIT BUILT-IN
        this.saveUserData = async (key, value) => {
            const supabase = require('../config/supabase');
            try {
                const { data, error } = await supabase
                    .from('universal_data')
                    .upsert({
                        data_type: 'user_data',
                        bot_token: this.context.botToken,
                        user_id: this.context.userId.toString(),
                        data_key: key,
                        data_value: JSON.stringify(value),
                        metadata: {
                            saved_at: new Date().toISOString(),
                            value_type: typeof value
                        },
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'data_type,bot_token,user_id,data_key'
                    });

                if (error) throw error;
                console.log(`✅ User data saved: ${key}`);
                return value;
            } catch (error) {
                console.error('❌ Save user data error:', error);
                throw error;
            }
        };

        this.getUserData = async (key) => {
            const supabase = require('../config/supabase');
            try {
                const { data, error } = await supabase
                    .from('universal_data')
                    .select('data_value, metadata, updated_at')
                    .eq('data_type', 'user_data')
                    .eq('bot_token', this.context.botToken)
                    .eq('user_id', this.context.userId.toString())
                    .eq('data_key', key)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') return null;
                    console.error('❌ Get user data error:', error);
                    return null;
                }

                if (!data || !data.data_value) return null;

                try {
                    return JSON.parse(data.data_value);
                } catch {
                    return data.data_value;
                }
            } catch (error) {
                console.error('❌ Get user data error:', error);
                return null;
            }
        };

        this.deleteUserData = async (key) => {
            const supabase = require('../config/supabase');
            try {
                const { error } = await supabase
                    .from('universal_data')
                    .delete()
                    .eq('data_type', 'user_data')
                    .eq('bot_token', this.context.botToken)
                    .eq('user_id', this.context.userId.toString())
                    .eq('data_key', key);

                if (error) throw error;
                console.log(`✅ User data deleted: ${key}`);
                return true;
            } catch (error) {
                console.error('❌ Delete user data error:', error);
                throw error;
            }
        };

        // Bot data methods - AUTO-AWAIT BUILT-IN
        this.saveBotData = async (key, value) => {
            const supabase = require('../config/supabase');
            try {
                const { data, error } = await supabase
                    .from('universal_data')
                    .upsert({
                        data_type: 'bot_data',
                        bot_token: this.context.botToken,
                        data_key: key,
                        data_value: JSON.stringify(value),
                        metadata: {
                            saved_at: new Date().toISOString(),
                            value_type: typeof value
                        },
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'data_type,bot_token,data_key'
                    });

                if (error) throw error;
                console.log(`✅ Bot data saved: ${key}`);
                return value;
            } catch (error) {
                console.error('❌ Save bot data error:', error);
                throw error;
            }
        };

        this.getBotData = async (key) => {
            const supabase = require('../config/supabase');
            try {
                const { data, error } = await supabase
                    .from('universal_data')
                    .select('data_value, metadata, updated_at')
                    .eq('data_type', 'bot_data')
                    .eq('bot_token', this.context.botToken)
                    .eq('data_key', key)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') return null;
                    console.error('❌ Get bot data error:', error);
                    return null;
                }

                if (!data || !data.data_value) return null;

                try {
                    return JSON.parse(data.data_value);
                } catch {
                    return data.data_value;
                }
            } catch (error) {
                console.error('❌ Get bot data error:', error);
                return null;
            }
        };

        // Metadata methods - AUTO-AWAIT BUILT-IN
        this.metaData = async (target = 'all') => {
            return await this.getOriginalResponse(target);
        };

        this.metadata = async (target = 'all') => {
            return await this.getOriginalResponse(target);
        };

        this.getMeta = async (target = 'all') => {
            return await this.getOriginalResponse(target);
        };

        this.inspect = async (target = 'all') => {
            return await this.getOriginalResponse(target);
        };

        // Context analysis - SYNCHRONOUS
        this.analyzeContext = () => {
            return {
                user: this.getUser(),
                chat: {
                    id: this.context.chatId,
                    type: this.context.msg?.chat?.type || 'private',
                    title: this.context.msg?.chat?.title,
                    username: this.context.msg?.chat?.username
                },
                message: this.context.msg,
                bot: {
                    token: this.context.botToken?.substring(0, 10) + '...',
                    chatId: this.context.chatId,
                    userId: this.context.userId
                },
                input: this.context.userInput,
                params: this.context.userInput ? this.context.userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                timestamp: new Date().toISOString()
            };
        };

        this.getContext = this.analyzeContext;
    }

    // 🎯 GET ORIGINAL RESPONSE ONLY (JSON FORMAT) - AUTO-AWAIT BUILT-IN
    async getOriginalResponse(target = 'all') {
        try {
            let originalResponse;

            switch (target.toLowerCase()) {
                case 'chat':
                case 'channel':
                case 'group':
                    originalResponse = await this.bot.getChat(this.context.chatId);
                    break;

                case 'user':
                case 'userinfo':
                    if (this.context.msg?.from) {
                        originalResponse = this.context.msg.from;
                    } else {
                        originalResponse = await this.bot.getChatMember(this.context.chatId, this.context.userId);
                    }
                    break;

                case 'bot':
                case 'botinfo':
                    originalResponse = await this.bot.getMe();
                    break;

                case 'update':
                case 'context':
                    originalResponse = this.context.msg || this.context;
                    break;

                case 'all':
                case 'everything':
                    const [chat, user, bot, update] = await Promise.all([
                        this.bot.getChat(this.context.chatId).catch(() => null),
                        this.bot.getChatMember(this.context.chatId, this.context.userId).catch(() => this.context.msg?.from),
                        this.bot.getMe().catch(() => null),
                        this.context.msg || this.context
                    ]);
                    originalResponse = { chat, user, bot, update };
                    break;

                default:
                    if (typeof target === 'number' || target.startsWith('@')) {
                        if (typeof target === 'number') {
                            if (target > 0) {
                                originalResponse = await this.bot.getChatMember(this.context.chatId, target);
                            } else {
                                originalResponse = await this.bot.getChat(target);
                            }
                        } else {
                            originalResponse = { username: target.substring(1), note: 'Username resolution not implemented' };
                        }
                    } else {
                        originalResponse = await this.bot.getChat(this.context.chatId);
                    }
            }

            return {
                success: true,
                type: 'original_response',
                target: target,
                data: originalResponse,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Metadata inspection error:', error);
            return {
                success: false,
                type: 'original_response',
                target: target,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Utility method to track promises for auto-await system
    trackPromise(promise) {
        this.pendingPromises.add(promise);
        promise.finally(() => this.pendingPromises.delete(promise));
        return promise;
    }

    // Wait for all pending promises to complete
    async waitForAllPromises() {
        if (this.pendingPromises.size > 0) {
            console.log(`⏳ Waiting for ${this.pendingPromises.size} pending promises...`);
            await Promise.allSettled([...this.pendingPromises]);
            console.log('✅ All pending promises completed');
        }
    }
}

module.exports = ApiWrapper;