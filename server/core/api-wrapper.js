// server/core/api-wrapper.js - FIXED DUMP & RESPONSE
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();      
        this.setupEnhancedMethods(); 
        this.setupDebugMethods();    
    }

    // --- 1. OFFICIAL TELEGRAM API METHODS ---
    setupAllMethods() {
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

        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        let finalArgs = [...args];
                        // Smart ChatID Injection
                        if (this.needsChatId(method)) {
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                        }
                        
                        // Resolve Promises & Stringify Objects for sendMessage
                        for (let i = 0; i < finalArgs.length; i++) {
                            if (finalArgs[i] instanceof Promise) finalArgs[i] = await finalArgs[i];
                            if (method === 'sendMessage' && i === 1 && typeof finalArgs[i] === 'object') {
                                finalArgs[i] = await this.resolveAndStringify(finalArgs[i]);
                            }
                        }
                        
                        return await this.bot[method](...finalArgs);
                    } catch (error) {
                        throw new Error(`API Error (${method}): ${error.message}`);
                    }
                };
            }
        });
    }

    // --- 2. ENHANCED & CUSTOM METHODS ---
    setupEnhancedMethods() {
        // getUser
        this.getUser = async (targetUserId = null) => {
            const uid = targetUserId || this.context.userId;
            try {
                const member = await this.bot.getChatMember(this.context.chatId, uid);
                return {
                    id: member.user.id,
                    first_name: member.user.first_name,
                    last_name: member.user.last_name || '',
                    username: member.user.username ? `@${member.user.username}` : null,
                    status: member.status,
                    is_bot: member.user.is_bot,
                    language_code: member.user.language_code,
                    raw: member.user
                };
            } catch (e) {
                const from = this.context.msg?.from || {};
                return {
                    id: from.id || uid,
                    first_name: from.first_name || 'Unknown',
                    username: from.username || null,
                    note: 'Fetched from local context (API failed)'
                };
            }
        };

        // Send & Reply
        this.send = async (text, options = {}) => {
            const cleanText = await this.resolveAndStringify(text);
            return this.sendMessage(this.context.chatId, cleanText, { parse_mode: 'HTML', ...options });
        };

        this.reply = async (text, options = {}) => {
            const cleanText = await this.resolveAndStringify(text);
            return this.sendMessage(this.context.chatId, cleanText, {
                reply_to_message_id: this.context.msg?.message_id, parse_mode: 'HTML', ...options
            });
        };

        // Wait/Sleep
        this.wait = (sec) => new Promise(resolve => setTimeout(resolve, sec * 1000));
        this.sleep = this.wait;

        // Media Shortcuts
        this.sendImage = (photo, caption = '', opt = {}) => this.sendPhoto(this.context.chatId, photo, { caption, ...opt });
        this.sendFile = (doc, caption = '', opt = {}) => this.sendDocument(this.context.chatId, doc, { caption, ...opt });
    }

    // --- 3. DUMP & DETAILS METHODS (FIXED) ---
    setupDebugMethods() {
        const dumpLogic = async (target = 'update') => {
            let data;
            let header = `🔍 <b>Debug Info: ${target.toUpperCase()}</b>`;
            
            try {
                switch (target.toLowerCase()) {
                    case 'chat': 
                        data = await this.bot.getChat(this.context.chatId); 
                        break;
                    case 'me':
                    case 'bot': 
                        data = await this.bot.getMe(); 
                        break;
                    case 'user': 
                        // Raw user data for debugging
                        const member = await this.bot.getChatMember(this.context.chatId, this.context.userId);
                        data = member; 
                        break;
                    case 'update': 
                    case 'msg':
                    default: 
                        data = this.context.msg; 
                        break;
                }
            } catch (err) {
                data = { error: err.message };
            }

            // 🔥 FIX: সরাসরি সেন্ড মেথড কল করা হচ্ছে
            await this.send(header);
            await this.send(data); // this.send অটোমেটিক JSON ফরম্যাট করবে
            
            return data;
        };

        this.dump = dumpLogic;
        this.details = dumpLogic;
        this.inspect = dumpLogic;
    }

    // --- 4. HELPERS ---
    async resolveAndStringify(content) {
        let value = content;
        if (value instanceof Promise) {
            try { value = await value; } catch (e) { return `❌ Promise Error: ${e.message}`; }
        }

        if (typeof value === 'object' && value !== null) {
            try {
                return `<pre><code class="language-json">${JSON.stringify(value, null, 2)}</code></pre>`;
            } catch (e) { return String(value); }
        }
        return String(value);
    }

    needsChatId(method) {
        const methods = [
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
        return methods.includes(method);
    }
}

module.exports = ApiWrapper;