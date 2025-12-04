// server/core/api-wrapper.js - ULTIMATE COMPLETE VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();      // অফিসিয়াল সকল মেথড
        this.setupEnhancedMethods(); // কাস্টম মেথড (send, reply, wait, getUser)
        this.setupDebugMethods();    // dump, details
    }

    // --- 1. OFFICIAL TELEGRAM API METHODS ---
    setupAllMethods() {
        // টেলিগ্রামের সকল অফিসিয়াল মেথডের লিস্ট
        const allMethods = [
            // Messages
            'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
            'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
            'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
            'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',
            
            // Updates & Editing
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'stopMessageLiveLocation', 'deleteMessage', 
            'deleteMessages',

            // Chat Management
            'getChat', 'getChatAdministrators', 'getChatMember', 'getChatMemberCount',
            'setChatTitle', 'setChatDescription', 'setChatPhoto', 'deleteChatPhoto',
            'setChatPermissions', 'exportChatInviteLink', 'createChatInviteLink',
            'editChatInviteLink', 'revokeChatInviteLink', 'approveChatJoinRequest',
            'declineChatJoinRequest', 'setChatAdministratorCustomTitle',
            'banChatMember', 'unbanChatMember', 'restrictChatMember', 'promoteChatMember',
            'setChatStickerSet', 'deleteChatStickerSet', 'createForumTopic',
            'editForumTopic', 'closeForumTopic', 'reopenForumTopic', 'deleteForumTopic',
            'unpinAllForumTopicMessages', 'editGeneralForumTopic', 'closeGeneralForumTopic',
            'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',
            'unpinAllChatMessages', 'leaveChat', 'pinChatMessage', 'unpinChatMessage',

            // Stickers
            'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
            'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
            'setStickerPositionInSet', 'deleteStickerFromSet', 'setStickerSetThumbnail',

            // Others
            'getMe', 'logOut', 'close', 'getFile', 'getUserProfilePhotos',
            'setMyCommands', 'deleteMyCommands', 'getMyCommands',
            'setMyName', 'getMyName', 'setMyDescription', 'getMyDescription',
            'setMyShortDescription', 'getMyShortDescription', 'getBusinessConnection',
            'answerCallbackQuery', 'answerInlineQuery'
        ];

        allMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // ✅ ১. স্মার্ট টেক্সট হ্যান্ডলিং (Promise/Object ফিক্স)
                        // যদি প্রথম আর্গুমেন্ট (টেক্সট/ক্যাপশন) প্রমিস বা অবজেক্ট হয়, তবে ঠিক করা হবে
                        if (args.length > 0 && (method === 'sendMessage' || method === 'editMessageText' || method === 'sendPhoto')) {
                             // সাধারণত টেক্সট থাকে ২য় আর্গুমেন্টে যদি চ্যাট আইডি প্রথম হয়, অথবা কনটেক্সট ইনজেক্ট হলে ১ম
                             // সিম্পল রাখার জন্য আমরা args এর সব এলিমেন্ট চেক করব না, শুধু টেক্সট পজিশন দেখব
                        }

                        // ✅ ২. স্মার্ট চ্যাট আইডি ইনজেকশন (Smart ChatID Injection)
                        let finalArgs = [...args];
                        if (this.needsChatId(method)) {
                            // যদি প্রথম আর্গুমেন্ট চ্যাট আইডি না হয় (নাম্বার না হয়), তবে অটোমেটিক বর্তমান চ্যাট আইডি বসবে
                            if (finalArgs.length === 0 || typeof finalArgs[0] !== 'number') {
                                finalArgs.unshift(this.context.chatId);
                            }
                        }

                        // ✅ ৩. ইনপুট স্যানিটাইজেশন (Promise Resolve)
                        // আর্গুমেন্টের ভেতরে যদি কোনো Promise থাকে, সেটাকে Resolve করা হবে
                        for (let i = 0; i < finalArgs.length; i++) {
                            if (finalArgs[i] instanceof Promise) {
                                finalArgs[i] = await finalArgs[i];
                            }
                            // যদি অবজেক্ট হয় এবং সেটা টেক্সট ফিল্ডে যায় (শুধুমাত্র sendMessage এর জন্য)
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
        
        // ✅ ইউজার ইনফো বের করার স্মার্ট মেথড
        this.getUser = async (targetUserId = null) => {
            const uid = targetUserId || this.context.userId;
            try {
                // চ্যাট মেম্বার থেকে লেটেস্ট ডাটা আনার চেষ্টা
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
                // ফেইল করলে লোকাল কনটেক্সট থেকে ডাটা দিবে
                const from = this.context.msg?.from || {};
                return {
                    id: from.id || uid,
                    first_name: from.first_name || 'Unknown',
                    username: from.username || null,
                    note: 'Fetched from local context (API failed)'
                };
            }
        };

        // ✅ Send মেথড (অটোমেটিক অবজেক্ট স্ট্রিংফাই করবে)
        this.send = async (text, options = {}) => {
            const cleanText = await this.resolveAndStringify(text);
            return this.sendMessage(this.context.chatId, cleanText, {
                parse_mode: 'HTML',
                ...options
            });
        };

        // ✅ Reply মেথড
        this.reply = async (text, options = {}) => {
            const cleanText = await this.resolveAndStringify(text);
            return this.sendMessage(this.context.chatId, cleanText, {
                reply_to_message_id: this.context.msg?.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // ✅ টাইমিং মেথড (Wait / Sleep)
        this.wait = (sec) => new Promise(resolve => setTimeout(resolve, sec * 1000));
        this.sleep = this.wait; // Alias

        // মিডিয়া শর্টকাট
        this.sendImage = (photo, caption = '', opt = {}) => this.sendPhoto(this.context.chatId, photo, { caption, ...opt });
        this.sendFile = (doc, caption = '', opt = {}) => this.sendDocument(this.context.chatId, doc, { caption, ...opt });
    }

    // --- 3. DUMP & DETAILS METHODS ---
    setupDebugMethods() {
        // এই লজিকটি Raw ডাটা রিটার্ন করবে
        const dumpLogic = async (target = 'update') => {
            let data;
            switch (target.toLowerCase()) {
                case 'chat': 
                    data = await this.bot.getChat(this.context.chatId); 
                    break;
                case 'me':
                case 'bot': 
                    data = await this.bot.getMe(); 
                    break;
                case 'user': 
                    data = await this.getUser(); 
                    break;
                case 'update': 
                case 'msg':
                default: 
                    data = this.context.msg; 
                    break;
            }
            // JSON হিসেবে সুন্দর করে রিটার্ন করা
            return {
                _type: 'debug_dump',
                target: target,
                data: data
            };
        };

        // ✅ আপনার চাওয়া অনুযায়ী নামগুলো সেট করা হলো
        this.dump = dumpLogic;
        this.details = dumpLogic;
        
        // ডেভেলপারদের জন্য এক্সট্রা নাম
        this.inspect = dumpLogic;
    }

    // --- 4. HELPERS ---
    
    // 🔥 CRITICAL: Promise রেজলভ করা এবং Object কে স্ট্রিং করা
    async resolveAndStringify(content) {
        // ১. যদি প্রমিস হয়, আগে রেজলভ করো
        let value = content;
        if (value instanceof Promise) {
            try {
                value = await value;
            } catch (e) {
                return `❌ Error resolving promise: ${e.message}`;
            }
        }

        // ২. যদি অবজেক্ট হয় (এবং নাল না হয়), সুন্দর JSON বানাও
        if (typeof value === 'object' && value !== null) {
            try {
                // HTML Code Block এ সুন্দর করে দেখাবে
                return `<pre><code class="language-json">${JSON.stringify(value, null, 2)}</code></pre>`;
            } catch (e) {
                return String(value);
            }
        }

        // ৩. অন্যথায় স্ট্রিং হিসেবে রিটার্ন করো
        return String(value);
    }

    needsChatId(method) {
        // যেসব মেথডে চ্যাট আইডি দরকার
        const methods = [
            'sendMessage', 'sendPhoto', 'sendVideo', 'sendDocument', 'sendVoice', 
            'sendAnimation', 'sendSticker', 'sendLocation', 'sendContact', 'sendPoll', 
            'sendDice', 'sendChatAction', 'forwardMessage', 'copyMessage', 'getChat', 
            'getChatMember', 'getChatAdministrators', 'leaveChat', 'pinChatMessage', 
            'unpinChatMessage', 'restrictChatMember', 'promoteChatMember', 'banChatMember', 
            'unbanChatMember', 'setChatTitle', 'setChatDescription', 'setChatPermissions'
        ];
        return methods.includes(method);
    }
}

module.exports = ApiWrapper;