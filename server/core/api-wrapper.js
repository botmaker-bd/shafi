// server/core/api-wrapper.js - UPDATED AND OPTIMIZED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
        this.setupMetadataMethods();
    }

    setupAllMethods() {
        // 🔥 KEEP ONLY OFFICIAL Telegram Bot API Methods
        const officialMethods = [
            // === MESSAGE METHODS (Official) ===
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',

            // === MESSAGE EDITING (Official) ===
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',

            // === MESSAGE MANAGEMENT (Official) ===
            'deleteMessage', 'deleteMessages',

            // === CHAT METHODS (Official) ===
            'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
            'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
            'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
            'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember',
            'banChatSenderChat', 'unbanChatSenderChat', 'setChatStickerSet',
            'deleteChatStickerSet',

            // === CHAT MANAGEMENT (Official) ===
            'getChatMenuButton', 'setChatMenuButton',
            'leaveChat', 'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages',

            // === STICKER METHODS (Official) ===
            'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
            'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
            'setStickerPositionInSet', 'deleteStickerFromSet', 'setStickerSetThumbnail',
            'setStickerEmojiList', 'setStickerKeywords', 'setStickerMaskPosition',
            'setStickerSetTitle',

            // === FORUM & TOPIC METHODS (Official) ===
            'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
            'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
            'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',

            // === INLINE & CALLBACK (Official) ===
            'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
            'answerPreCheckoutQuery', 'answerShippingQuery',

            // === PAYMENT METHODS (Official) ===
            'sendInvoice', 'createInvoiceLink', 'refundStarPayment',

            // === BOT MANAGEMENT (Official) ===
            'getMe', 'logOut', 'close', 'getMyCommands', 'setMyCommands',
            'deleteMyCommands', 'getMyDescription', 'setMyDescription',
            'getMyShortDescription', 'setMyShortDescription', 'getMyName',
            'setMyName', 'getMyDefaultAdministratorRights', 'setMyDefaultAdministratorRights',

            // === GAME METHODS (Official) ===
            'sendGame', 'setGameScore', 'getGameHighScores',

            // === FILE METHODS (Official) ===
            'getFile'
        ];

        // Bind only official methods
        officialMethods.forEach(method => {
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
                        console.log(`✅ API ${method} executed`);
                        return result;
                    } catch (error) {
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            } else {
                console.warn(`⚠️ Method ${method} not available`);
            }
        });

        // ✅ Keep Python integration methods (exists in command-executor)
        this.setupPythonMethods();
    }

    setupPythonMethods() {
        const pythonRunner = require('./python-runner');
        
        // ✅ Keep runPython (exists in command-executor)
        this.runPython = async (code) => {
            try {
                const result = await pythonRunner.runPythonCode(code);
                console.log('✅ Python code executed');
                return result;
            } catch (error) {
                console.error('❌ Python execution failed:', error.message);
                throw new Error(`Python Error: ${error.message}`);
            }
        };
        
        // ✅ Keep installPython (optional, but useful)
        this.installPython = async (library) => {
            try {
                const result = await pythonRunner.installPythonLibrary(library);
                console.log(`✅ Python library installed: ${library}`);
                return result;
            } catch (error) {
                console.error('❌ Python install failed:', error.message);
                throw new Error(`Install Error: ${error.message}`);
            }
        };
        
        // ✅ Keep uninstallPython (optional)
        this.uninstallPython = async (library) => {
            try {
                const result = await pythonRunner.uninstallPythonLibrary(library);
                console.log(`✅ Python library removed: ${library}`);
                return result;
            } catch (error) {
                console.error('❌ Python uninstall failed:', error.message);
                throw new Error(`Uninstall Error: ${error.message}`);
            }
        };
    }

    setupMetadataMethods() {
        // 🔍 METADATA METHODS - BETTER NAMES
        this.getInfo = async (target = 'chat') => await this.fetchMetadata(target);
        this.inspect = async (target = 'chat') => await this.fetchMetadata(target);
        this.details = async (target = 'chat') => await this.fetchMetadata(target);
        this.meta = async (target = 'chat') => await this.fetchMetadata(target);
    }

    // 🎯 IMPROVED METADATA FETCHING
    async fetchMetadata(target = 'chat') {
        try {
            let data;

            switch (target.toLowerCase()) {
                case 'chat':
                case 'channel':
                case 'group':
                    data = await this.bot.getChat(this.context.chatId);
                    break;

                case 'user':
                case 'me':
                    if (this.context.msg?.from) {
                        data = this.context.msg.from;
                    } else {
                        data = await this.bot.getChatMember(this.context.chatId, this.context.userId);
                    }
                    break;

                case 'bot':
                    data = await this.bot.getMe();
                    break;

                case 'message':
                case 'msg':
                    data = this.context.msg || this.context;
                    break;

                case 'all':
                case 'full':
                    const [chat, user, bot, message] = await Promise.all([
                        this.bot.getChat(this.context.chatId).catch(() => null),
                        this.bot.getChatMember(this.context.chatId, this.context.userId)
                            .catch(() => this.context.msg?.from || null),
                        this.bot.getMe().catch(() => null),
                        this.context.msg || this.context
                    ]);
                    data = { chat, user, bot, message };
                    break;

                default:
                    // Handle numeric IDs or usernames
                    if (typeof target === 'number') {
                        if (target > 0) {
                            data = await this.bot.getChatMember(this.context.chatId, target);
                        } else {
                            data = await this.bot.getChat(target);
                        }
                    } else if (typeof target === 'string' && target.startsWith('@')) {
                        data = { username: target.substring(1), type: 'username' };
                    } else {
                        data = await this.bot.getChat(this.context.chatId);
                    }
            }

            return {
                success: true,
                data: data,
                timestamp: new Date().toISOString(),
                source: target
            };

        } catch (error) {
            console.error('❌ Metadata fetch error:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                source: target
            };
        }
    }

    // ✅ KEEP: needsChatId method (required)
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

    // ✅ KEEP: getUser method (exists in command-executor)
    getUser() {
        const msg = this.context.msg || {};
        const from = msg.from || {};
        
        return {
            id: from.id || this.context.userId,
            username: from.username || this.context.username,
            first_name: from.first_name || this.context.first_name,
            last_name: from.last_name || this.context.last_name,
            language_code: from.language_code || this.context.language_code,
            chat_id: msg.chat?.id || this.context.chatId,
            is_bot: from.is_bot || false
        };
    }

    // ✅ KEEP: Essential utility methods (exist in command-executor)
    setupEnhancedMethods() {
        // ✅ send - alias for sendMessage with chatId auto-filled
        this.send = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
        };

        // ✅ reply - send with reply_to_message_id
        this.reply = (text, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // ✅ wait - utility for delays (exists in command-executor)
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // ✅ sleep - alias for wait
        this.sleep = this.wait;
        
        // ✅ ask - for interactive questions (must match command-executor)
        this.ask = (question, options = {}) => {
            return this.sendMessage(this.context.chatId, question, {
                parse_mode: 'HTML',
                ...options
            });
        };
        
        // ✅ waitForAnswer - alias for ask
        this.waitForAnswer = this.ask;
    }
}

module.exports = ApiWrapper;