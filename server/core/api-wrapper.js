// server/core/api-wrapper.js - UPDATED WITH METADATA FEATURES
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
        // ... existing code (all Telegram methods) ...
  

    // ✅ NEW: METADATA METHODS SETUP
    setupMetadataMethods() {
        // Create metadata viewer instance
        const AutoMetadataViewer = require('./auto-metadata-viewer');
        this.metadataViewer = new AutoMetadataViewer(this.bot, this);
        
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
                    const [admins, membersCount, photo] = await Promise.all([
                        this.bot.getChatAdministrators(targetChatId).catch(() => null),
                        this.bot.getChatMemberCount(targetChatId).catch(() => null),
                        this.bot.getChatPhoto(targetChatId).catch(() => null)
                    ]);

                    detailedInfo.administrators = admins;
                    detailedInfo.member_count = membersCount;
                    detailedInfo.photo_info = photo;
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
                    const [commands, description, name] = await Promise.all([
                        this.bot.getMyCommands().catch(() => null),
                        this.bot.getMyDescription().catch(() => null),
                        this.bot.getMyName().catch(() => null)
                    ]);

                    botData.commands = commands;
                    botData.description = description;
                    botData.name_info = name;
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
${bot.description ? `<b>Description:</b>\n<code>${bot.description}</code>\n` : ''}

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

    // ... existing ApiWrapper methods continue ...
}

// ✅ ADD AUTO METADATA VIEWER CLASS
class AutoMetadataViewer {
    constructor(bot, apiWrapper) {
        this.bot = bot;
        this.api = apiWrapper;
        this.setupAutoViewer();
    }

    setupAutoViewer() {
        console.log('🔍 Auto Metadata Viewer Activated');
        
        // ALL MESSAGE TYPES HANDLER
        this.bot.on('message', (msg) => {
            this.autoExtractAndDisplay(msg);
        });

        // ALL OTHER UPDATE TYPES
        this.bot.on('edited_message', (msg) => {
            this.autoExtractAndDisplay(msg, 'edited');
        });

        this.bot.on('channel_post', (post) => {
            this.autoExtractAndDisplay(post, 'channel_post');
        });

        this.bot.on('edited_channel_post', (post) => {
            this.autoExtractAndDisplay(post, 'edited_channel_post');
        });

        this.bot.on('callback_query', (query) => {
            this.autoExtractCallback(query);
        });

        this.bot.on('inline_query', (query) => {
            this.autoExtractInline(query);
        });
    }

    // 🎯 AUTO EXTRACT ALL METADATA
    autoExtractAndDisplay(msg, type = 'message') {
        try {
            const allMetadata = this.extractEverything(msg);
            this.displayFormattedMetadata(allMetadata, type, msg.chat.id);
        } catch (error) {
            console.error('❌ Auto extraction error:', error);
        }
    }

    // 🔥 EXTRACT EVERYTHING AUTOMATICALLY
    extractEverything(msg) {
        const metadata = {};

        // 🎯 AUTOMATICALLY EXTRACT ALL AVAILABLE FIELDS
        Object.keys(msg).forEach(key => {
            try {
                const value = msg[key];
                
                if (value === null || value === undefined) {
                    metadata[key] = null;
                    return;
                }

                // Handle different data types
                if (typeof value === 'object' && !Array.isArray(value)) {
                    if (this.isTelegramObject(value)) {
                        metadata[key] = this.extractNestedObject(value);
                    } else {
                        metadata[key] = value;
                    }
                } else if (Array.isArray(value)) {
                    metadata[key] = this.extractArray(value);
                } else {
                    metadata[key] = value;
                }
            } catch (error) {
                metadata[key] = `Error: ${error.message}`;
            }
        });

        return metadata;
    }

    // 🔍 CHECK IF TELEGRAM OBJECT
    isTelegramObject(obj) {
        if (!obj || typeof obj !== 'object') return false;
        
        const telegramKeys = ['id', 'first_name', 'username', 'type', 'file_id', 'latitude', 'phone_number'];
        return Object.keys(obj).some(key => telegramKeys.includes(key));
    }

    // 📦 EXTRACT NESTED OBJECTS
    extractNestedObject(obj) {
        const result = {};
        
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            
            if (value === null || value === undefined) {
                result[key] = null;
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.extractNestedObject(value);
            } else if (Array.isArray(value)) {
                result[key] = this.extractArray(value);
            } else {
                result[key] = value;
            }
        });
        
        return result;
    }

    // 🧮 EXTRACT ARRAYS
    extractArray(arr) {
        return arr.map(item => {
            if (item === null || item === undefined) return null;
            
            if (typeof item === 'object') {
                return this.extractNestedObject(item);
            } else {
                return item;
            }
        });
    }

    // 📊 DISPLAY FORMATTED METADATA
    async displayFormattedMetadata(metadata, type, chatId) {
        try {
            const formattedText = this.formatMetadataForDisplay(metadata, type);
            
            // Send to chat (first 4096 characters due to Telegram limit)
            await this.api.sendMessage(chatId, formattedText.substring(0, 4096), {
                parse_mode: 'HTML'
            });

            // If text is too long, send remaining parts
            if (formattedText.length > 4096) {
                const remainingText = formattedText.substring(4096);
                for (let i = 0; i < remainingText.length; i += 4096) {
                    await this.api.sendMessage(chatId, remainingText.substring(i, i + 4096), {
                        parse_mode: 'HTML'
                    });
                }
            }

        } catch (error) {
            console.error('❌ Display metadata error:', error);
        }
    }

    // 🎨 FORMAT METADATA AS HTML
    formatMetadataForDisplay(metadata, type) {
        let html = `<b>🔍 ${type.toUpperCase()} METADATA</b>\n`;
        html += `<code>${new Date().toLocaleString()}</code>\n\n`;

        Object.keys(metadata).forEach(key => {
            const value = metadata[key];
            html += this.formatKeyValue(key, value);
        });

        return html;
    }

    // ✨ FORMAT KEY-VALUE PAIRS
    formatKeyValue(key, value, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        if (value === null || value === undefined) {
            return `${indentStr}<b>${key}:</b> <i>null</i>\n`;
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
            let result = `${indentStr}<b>${key}:</b>\n`;
            Object.keys(value).forEach(subKey => {
                result += this.formatKeyValue(subKey, value[subKey], indent + 1);
            });
            return result;
        }

        if (Array.isArray(value)) {
            let result = `${indentStr}<b>${key}:</b> [${value.length} items]\n`;
            value.forEach((item, index) => {
                result += `${indentStr}  [${index}]: ${this.formatValue(item, indent + 2)}\n`;
            });
            return result;
        }

        return `${indentStr}<b>${key}:</b> ${this.formatValue(value, indent)}\n`;
    }

    // 🎭 FORMAT DIFFERENT VALUE TYPES
    formatValue(value, indent) {
        if (value === null) return '<i>null</i>';
        if (value === undefined) return '<i>undefined</i>';
        
        switch (typeof value) {
            case 'string':
                return `<code>${this.escapeHtml(value)}</code>`;
            case 'number':
                return `<i>${value}</i>`;
            case 'boolean':
                return `<i>${value ? 'true' : 'false'}</i>`;
            default:
                return `<code>${this.escapeHtml(JSON.stringify(value))}</code>`;
        }
    }

    // 🛡️ ESCAPE HTML
    escapeHtml(text) {
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 🔘 CALLBACK QUERY METADATA
    autoExtractCallback(query) {
        const metadata = {
            id: query.id,
            from: this.extractEverything(query.from),
            message: query.message ? this.extractEverything(query.message) : null,
            inline_message_id: query.inline_message_id,
            chat_instance: query.chat_instance,
            data: query.data,
            game_short_name: query.game_short_name
        };

        this.displayFormattedMetadata(metadata, 'callback_query', query.from.id);
    }

    // 🔍 INLINE QUERY METADATA
    autoExtractInline(query) {
        const metadata = {
            id: query.id,
            from: this.extractEverything(query.from),
            query: query.query,
            offset: query.offset,
            chat_type: query.chat_type,
            location: query.location ? this.extractEverything(query.location) : null
        };

        this.displayFormattedMetadata(metadata, 'inline_query', query.from.id);
    }

    // 🚀 QUICK METADATA COMMAND
    setupMetadataCommand() {
        this.bot.onText(/\/metadata/, (msg) => {
            const allMetadata = this.extractEverything(msg);
            this.displayFormattedMetadata(allMetadata, 'command_triggered', msg.chat.id);
        });

        this.bot.onText(/\/rawdata/, (msg) => {
            const rawJson = JSON.stringify(msg, null, 2);
            this.api.sendMessage(msg.chat.id, `<pre>${this.escapeHtml(rawJson)}</pre>`, {
                parse_mode: 'HTML'
            });
        });
    }
}

module.exports = ApiWrapper;