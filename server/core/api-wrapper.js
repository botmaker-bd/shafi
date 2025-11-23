// server/core/api-wrapper.js - COMPLETELY FIXED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupMetadataMethods();
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

    // ✅ FIXED: METADATA METHODS SETUP
    setupMetadataMethods() {
        // Add metadata methods to ApiWrapper
        this.setupMetadataShortcuts();
    }

    setupMetadataShortcuts() {
        // 🔍 METADATA INSPECTION METHODS
        this.metaData = (target = 'all', options = {}) => {
            return this.inspectMetadata(target, options);
        };

        this.inspect = (target = 'all', options = {}) => {
            return this.inspectMetadata(target, options);
        };

        this.getMeta = (target = 'all', options = {}) => {
            return this.inspectMetadata(target, options);
        };

        this.analyze = (target = 'all', options = {}) => {
            return this.inspectMetadata(target, { deep: true, ...options });
        };

        // Quick access methods
        this.chatInfo = (chatId = null) => {
            return this.getChatMetadata(chatId);
        };

        this.userInfo = (userId = null) => {
            return this.getUserMetadata(userId);
        };

        this.botInfo = () => {
            return this.getBotMetadata();
        };

        this.updateInfo = () => {
            return this.getUpdateMetadata();
        };
    }

    // 🎯 MAIN METADATA INSPECTION METHOD
    async inspectMetadata(target = 'all', options = {}) {
        const {
            deep = false,
            format = 'formatted',
            sendToChat = true,
            chatId = this.context.chatId
        } = options;

        try {
            let metadata;

            switch (target.toLowerCase()) {
                case 'chat':
                case 'channel':
                case 'group':
                    metadata = await this.getChatMetadata(chatId, deep);
                    break;

                case 'user':
                case 'userinfo':
                    metadata = await this.getUserMetadata(this.context.userId, deep);
                    break;

                case 'bot':
                case 'botinfo':
                    metadata = await this.getBotMetadata(deep);
                    break;

                case 'update':
                case 'context':
                    metadata = await this.getUpdateMetadata(deep);
                    break;

                case 'all':
                case 'everything':
                    metadata = await this.getAllMetadata(deep);
                    break;

                default:
                    // If target is a specific ID
                    if (typeof target === 'number' || target.startsWith('@')) {
                        metadata = await this.getCustomTargetMetadata(target, deep);
                    } else {
                        metadata = await this.getAllMetadata(deep);
                    }
            }

            // Format and return/send result
            if (format === 'raw') {
                return metadata;
            }

            const formatted = this.formatMetadataForOutput(metadata, target, options);

            if (sendToChat && chatId) {
                await this.sendFormattedMetadata(chatId, formatted, target);
            }

            return formatted;

        } catch (error) {
            console.error('❌ Metadata inspection error:', error);
            throw error;
        }
    }

    // 📊 GET CHAT METADATA
    async getChatMetadata(chatId = null, deep = false) {
        const targetChatId = chatId || this.context.chatId;
        
        try {
            const basicInfo = await this.bot.getChat(targetChatId);
            let detailedInfo = { ...basicInfo };

            if (deep) {
                try {
                    const [admins, membersCount] = await Promise.all([
                        this.bot.getChatAdministrators(targetChatId).catch(() => null),
                        this.bot.getChatMemberCount(targetChatId).catch(() => null)
                    ]);

                    detailedInfo.administrators = admins;
                    detailedInfo.member_count = membersCount;
                } catch (deepError) {
                    console.warn('⚠️ Deep chat info failed:', deepError.message);
                }
            }

            return {
                type: 'chat',
                id: targetChatId,
                timestamp: new Date().toISOString(),
                data: detailedInfo,
                context: {
                    current_chat_id: this.context.chatId,
                    requested_chat_id: targetChatId
                }
            };

        } catch (error) {
            return {
                type: 'chat',
                id: targetChatId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 👤 GET USER METADATA
    async getUserMetadata(userId = null, deep = false) {
        const targetUserId = userId || this.context.userId;
        
        try {
            // For current user in context
            if (!userId && this.context.msg?.from) {
                const userData = {
                    ...this.context.msg.from,
                    chat_id: this.context.chatId,
                    language_code: this.context.language_code
                };

                return {
                    type: 'user',
                    id: targetUserId,
                    timestamp: new Date().toISOString(),
                    data: userData,
                    source: 'context'
                };
            }

            // Try to get user info from chat member data
            try {
                const memberInfo = await this.bot.getChatMember(this.context.chatId, targetUserId);
                return {
                    type: 'user',
                    id: targetUserId,
                    timestamp: new Date().toISOString(),
                    data: memberInfo.user,
                    status: memberInfo.status,
                    source: 'chat_member'
                };
            } catch (memberError) {
                return {
                    type: 'user',
                    id: targetUserId,
                    timestamp: new Date().toISOString(),
                    data: this.context.msg?.from || { id: targetUserId },
                    source: 'context_fallback',
                    warning: 'Could not fetch detailed member info'
                };
            }

        } catch (error) {
            return {
                type: 'user',
                id: targetUserId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 🤖 GET BOT METADATA
    async getBotMetadata(deep = false) {
        try {
            const botInfo = await this.bot.getMe();
            
            const botData = {
                ...botInfo,
                token_preview: this.context.botToken ? 
                    `${this.context.botToken.substring(0, 10)}...` : 'unknown',
                mode: process.env.USE_WEBHOOK ? 'webhook' : 'polling'
            };

            if (deep) {
                try {
                    const [commands] = await Promise.all([
                        this.bot.getMyCommands().catch(() => null)
                    ]);

                    botData.commands = commands;
                } catch (deepError) {
                    console.warn('⚠️ Deep bot info failed:', deepError.message);
                }
            }

            return {
                type: 'bot',
                id: botInfo.id,
                username: botInfo.username,
                timestamp: new Date().toISOString(),
                data: botData
            };

        } catch (error) {
            return {
                type: 'bot',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 🔄 GET UPDATE METADATA
    async getUpdateMetadata(deep = false) {
        const context = this.context;
        
        const updateData = {
            chat: {
                id: context.chatId,
                type: context.msg?.chat?.type || 'unknown'
            },
            user: {
                id: context.userId,
                username: context.username,
                first_name: context.first_name,
                language_code: context.language_code
            },
            message: {
                id: context.msg?.message_id,
                type: this.getMessageType(context.msg),
                date: context.msg?.date ? new Date(context.msg.date * 1000).toISOString() : null,
                has_text: !!(context.msg?.text || context.msg?.caption),
                entities: context.msg?.entities || context.msg?.caption_entities
            },
            bot: {
                token_preview: context.botToken ? `${context.botToken.substring(0, 10)}...` : 'unknown'
            },
            input: context.userInput || null
        };

        if (deep && context.msg) {
            updateData.raw_message = context.msg;
        }

        return {
            type: 'update',
            timestamp: new Date().toISOString(),
            data: updateData
        };
    }

    // 🌟 GET ALL METADATA
    async getAllMetadata(deep = false) {
        const [chat, user, bot, update] = await Promise.all([
            this.getChatMetadata(null, deep),
            this.getUserMetadata(null, deep),
            this.getBotMetadata(deep),
            this.getUpdateMetadata(deep)
        ]);

        return {
            type: 'complete_analysis',
            timestamp: new Date().toISOString(),
            sections: {
                chat,
                user,
                bot,
                update
            },
            summary: {
                total_sections: 4,
                has_errors: [chat, user, bot, update].some(item => item.error),
                deep_analysis: deep
            }
        };
    }

    // 🎯 GET CUSTOM TARGET METADATA
    async getCustomTargetMetadata(target, deep = false) {
        // Handle different target types
        if (typeof target === 'number') {
            if (target > 0) {
                // Positive number - user ID
                return this.getUserMetadata(target, deep);
            } else {
                // Negative number - chat ID
                return this.getChatMetadata(target, deep);
            }
        } else if (target.startsWith('@')) {
            // Username
            return {
                type: 'username',
                target: target,
                timestamp: new Date().toISOString(),
                note: 'Username resolution not implemented',
                data: { username: target.substring(1) }
            };
        } else {
            return {
                type: 'unknown',
                target: target,
                timestamp: new Date().toISOString(),
                error: 'Unknown target type'
            };
        }
    }

    // 📝 FORMAT METADATA FOR OUTPUT
    formatMetadataForOutput(metadata, target, options) {
        if (options.format === 'json') {
            return JSON.stringify(metadata, null, 2);
        }

        return this.createFormattedMetadataText(metadata, target, options);
    }

    // 🎨 CREATE FORMATTED TEXT OUTPUT
    createFormattedMetadataText(metadata, target, options) {
        let text = '';

        switch (metadata.type) {
            case 'chat':
                text = this.formatChatMetadata(metadata);
                break;
            case 'user':
                text = this.formatUserMetadata(metadata);
                break;
            case 'bot':
                text = this.formatBotMetadata(metadata);
                break;
            case 'update':
                text = this.formatUpdateMetadata(metadata);
                break;
            case 'complete_analysis':
                text = this.formatCompleteAnalysis(metadata);
                break;
            default:
                text = this.formatGenericMetadata(metadata);
        }

        return text;
    }

    // 💬 FORMAT CHAT METADATA
    formatChatMetadata(metadata) {
        if (metadata.error) {
            return `❌ <b>Chat Error</b>\n\n<code>${metadata.error}</code>`;
        }

        const chat = metadata.data;
        return `
🏠 <b>CHAT ANALYSIS</b>

<b>ID:</b> <code>${chat.id}</code>
<b>Type:</b> <code>${chat.type}</code>
<b>Title:</b> <code>${chat.title || 'N/A'}</code>
<b>Username:</b> <code>${chat.username || 'N/A'}</code>

${chat.description ? `<b>Description:</b>\n<code>${chat.description}</code>\n` : ''}
${chat.administrators ? `<b>Admins:</b> ${chat.administrators.length}\n` : ''}
${chat.member_count ? `<b>Members:</b> ${chat.member_count}\n` : ''}

<code>${metadata.timestamp}</code>
        `.trim();
    }

    // 👤 FORMAT USER METADATA
    formatUserMetadata(metadata) {
        if (metadata.error) {
            return `❌ <b>User Error</b>\n\n<code>${metadata.error}</code>`;
        }

        const user = metadata.data;
        return `
👤 <b>USER ANALYSIS</b>

<b>ID:</b> <code>${user.id}</code>
<b>Name:</b> <code>${user.first_name} ${user.last_name || ''}</code>
<b>Username:</b> <code>${user.username || 'N/A'}</code>
<b>Language:</b> <code>${user.language_code || 'N/A'}</code>
<b>Chat ID:</b> <code>${user.chat_id || 'N/A'}</code>

${metadata.status ? `<b>Status:</b> <code>${metadata.status}</code>\n` : ''}
<b>Source:</b> <code>${metadata.source}</code>

<code>${metadata.timestamp}</code>
        `.trim();
    }

    // 🤖 FORMAT BOT METADATA
    formatBotMetadata(metadata) {
        if (metadata.error) {
            return `❌ <b>Bot Error</b>\n\n<code>${metadata.error}</code>`;
        }

        const bot = metadata.data;
        return `
🤖 <b>BOT ANALYSIS</b>

<b>ID:</b> <code>${bot.id}</code>
<b>Name:</b> <code>${bot.first_name}</code>
<b>Username:</b> @${bot.username}
<b>Mode:</b> <code>${bot.mode}</code>

${bot.commands ? `<b>Commands:</b> ${bot.commands.length}\n` : ''}

<code>${metadata.timestamp}</code>
        `.trim();
    }

    // 🔄 FORMAT UPDATE METADATA
    formatUpdateMetadata(metadata) {
        const data = metadata.data;
        return `
🔄 <b>UPDATE ANALYSIS</b>

<b>Chat:</b> <code>${data.chat.id}</code> (${data.chat.type})
<b>User:</b> <code>${data.user.id}</code> (@${data.user.username || 'N/A'})
<b>Message:</b> <code>${data.message.id || 'N/A'}</code> (${data.message.type})

${data.input ? `<b>Input:</b> <code>${data.input}</code>\n` : ''}

<code>${metadata.timestamp}</code>
        `.trim();
    }

    // 🌟 FORMAT COMPLETE ANALYSIS
    formatCompleteAnalysis(metadata) {
        const sections = metadata.sections;
        return `
🌟 <b>COMPLETE ANALYSIS</b>

<b>Chat:</b> <code>${sections.chat.data?.id || 'Error'}</code>
<b>User:</b> <code>${sections.user.data?.id || 'Error'}</code>  
<b>Bot:</b> <code>${sections.bot.data?.id || 'Error'}</code>
<b>Update:</b> <code>${sections.update.data.chat.id}</code>

<code>${metadata.timestamp}</code>
        `.trim();
    }

    // 📤 SEND FORMATTED METADATA
    async sendFormattedMetadata(chatId, text, target) {
        try {
            // Split long messages for Telegram
            if (text.length <= 4096) {
                await this.sendMessage(chatId, text, { parse_mode: 'HTML' });
            } else {
                // Send in chunks
                for (let i = 0; i < text.length; i += 4096) {
                    await this.sendMessage(chatId, text.substring(i, i + 4096), { 
                        parse_mode: 'HTML' 
                    });
                }
            }
        } catch (error) {
            console.error('❌ Send metadata error:', error);
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

    // 🔧 UTILITY METHODS
    getMessageType(msg) {
        if (!msg) return 'unknown';
        
        if (msg.text) return 'text';
        if (msg.photo) return 'photo';
        if (msg.video) return 'video';
        if (msg.document) return 'document';
        if (msg.audio) return 'audio';
        if (msg.voice) return 'voice';
        if (msg.sticker) return 'sticker';
        if (msg.location) return 'location';
        if (msg.contact) return 'contact';
        
        return 'unknown';
    }

    formatGenericMetadata(metadata) {
        return `
📊 <b>METADATA ANALYSIS</b>

<b>Type:</b> <code>${metadata.type}</code>
<b>Target:</b> <code>${metadata.target || 'N/A'}</code>
${metadata.error ? `<b>Error:</b> <code>${metadata.error}</code>\n` : ''}

<code>${metadata.timestamp}</code>
        `.trim();
    }
}

module.exports = ApiWrapper;