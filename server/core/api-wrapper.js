// server/core/api-wrapper.js - COMPLETELY FIXED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();        // Official Telegram methods
        this.setupPythonMethods();     // Python integration
        this.setupEnhancedMethods();   // Enhanced utilities
        this.setupMetadataMethods();   // Metadata methods
    }

    setupAllMethods() {
        // 🔥 OFFICIAL TELEGRAM BOT API METHODS
        const officialMethods = [
            // MESSAGES
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',

            // EDITING
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',

            // MESSAGE MANAGEMENT
            'deleteMessage', 'deleteMessages',

            // CHAT
            'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
            'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
            'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
            'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
            'restrictChatMember', 'promoteChatMember',
            'banChatSenderChat', 'unbanChatSenderChat', 'setChatStickerSet',
            'deleteChatStickerSet',

            // CHAT MANAGEMENT
            'getChatMenuButton', 'setChatMenuButton',
            'leaveChat', 'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages',

            // STICKERS
            'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
            'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
            'setStickerPositionInSet', 'deleteStickerFromSet', 'setStickerSetThumbnail',
            'setStickerEmojiList', 'setStickerKeywords', 'setStickerMaskPosition',
            'setStickerSetTitle',

            // FORUM & TOPICS
            'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
            'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
            'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',

            // INLINE & CALLBACK
            'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
            'answerPreCheckoutQuery', 'answerShippingQuery',

            // PAYMENTS
            'sendInvoice', 'createInvoiceLink', 'refundStarPayment',

            // BOT MANAGEMENT
            'getMe', 'logOut', 'close', 'getMyCommands', 'setMyCommands',
            'deleteMyCommands', 'getMyDescription', 'setMyDescription',
            'getMyShortDescription', 'setMyShortDescription', 'getMyName',
            'setMyName', 'getMyDefaultAdministratorRights', 'setMyDefaultAdministratorRights',

            // GAMES
            'sendGame', 'setGameScore', 'getGameHighScores',

            // FILES
            'getFile'
        ];

        // Bind methods
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
                        
                        return await this.bot[method](...finalArgs);
                    } catch (error) {
                        console.error(`❌ ${method} failed:`, error.message);
                        throw error;
                    }
                };
            }
        });
    }

    setupPythonMethods() {
        const pythonRunner = require('./python-runner');
        
        this.runPython = async (code) => {
            try {
                return await pythonRunner.runPythonCode(code);
            } catch (error) {
                console.error('❌ Python execution failed:', error.message);
                throw error;
            }
        };
        
        this.installPython = async (library) => {
            try {
                return await pythonRunner.installPythonLibrary(library);
            } catch (error) {
                console.error('❌ Python install failed:', error.message);
                throw error;
            }
        };
        
        this.uninstallPython = async (library) => {
            try {
                return await pythonRunner.uninstallPythonLibrary(library);
            } catch (error) {
                console.error('❌ Python uninstall failed:', error.message);
                throw error;
            }
        };
    }

    setupEnhancedMethods() {
        // ✅ Essential utilities
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        this.sleep = this.wait;
        
        // ✅ ask/waitForAnswer - FIXED: Use context's ask function
        this.ask = (question, options = {}) => {
            // Check if ask function is provided in context
            if (this.context.ask && typeof this.context.ask === 'function') {
                return this.context.ask(question, options);
            }
            // Fallback to sendMessage
            return this.sendMessage(this.context.chatId, question, {
                parse_mode: 'HTML',
                ...options
            });
        };
        this.waitForAnswer = this.ask;
        
        // ✅ send/reply shortcuts
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
        
        // ✅ getUser - GLOBAL FUNCTION (not Bot.getUser)
        this.getUser = () => {
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
        };
    }

    setupMetadataMethods() {
        // 🔍 Metadata aliases
        this.getInfo = async (target = 'chat') => await this.fetchMetadata(target);
        this.inspect = async (target = 'chat') => await this.fetchMetadata(target);
        this.details = async (target = 'chat') => await this.fetchMetadata(target);
        this.meta = async (target = 'chat') => await this.fetchMetadata(target);
    }

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
                    data = this.context.msg?.from || 
                           await this.bot.getChatMember(this.context.chatId, this.context.userId);
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
                    if (typeof target === 'number') {
                        data = target > 0 
                            ? await this.bot.getChatMember(this.context.chatId, target)
                            : await this.bot.getChat(target);
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

    // ✅ KEEP: needsChatId
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
}

module.exports = ApiWrapper;