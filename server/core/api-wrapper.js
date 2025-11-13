class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupMethods();
    }

    setupMethods() {
        // All Telegram Bot API methods
        const methods = [
            // Message methods
            'sendMessage', 'sendPhoto', 'sendVideo', 'sendDocument', 'sendAudio',
            'sendVoice', 'sendSticker', 'sendLocation', 'sendVenue', 'sendContact',
            'sendPoll', 'sendDice', 'sendChatAction', 'sendMediaGroup',
            
            // Edit methods
            'editMessageText', 'editMessageCaption', 'editMessageMedia',
            'editMessageReplyMarkup', 'editMessageLiveLocation',
            'stopMessageLiveLocation',
            
            // Delete methods
            'deleteMessage', 'deleteMessages',
            
            // Chat methods
            'getChat', 'getChatAdministrators', 'getChatMemberCount',
            'getChatMember', 'setChatTitle', 'setChatDescription',
            'setChatPhoto', 'deleteChatPhoto', 'pinChatMessage',
            'unpinChatMessage', 'unpinAllChatMessages', 'leaveChat',
            
            // Inline methods
            'answerInlineQuery',
            
            // Callback methods
            'answerCallbackQuery',
            
            // Payment methods
            'sendInvoice', 'answerShippingQuery', 'answerPreCheckoutQuery',
            
            // Forum methods
            'createForumTopic', 'editForumTopic', 'closeForumTopic',
            'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
            
            // Sticker methods
            'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
            'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
            'setStickerPositionInSet', 'deleteStickerFromSet',
            'setStickerSetThumbnail',
            
            // Game methods
            'sendGame', 'setGameScore', 'getGameHighScores'
        ];

        // Bind all methods to this instance
        methods.forEach(method => {
            if (this.bot[method]) {
                this[method] = (...args) => {
                    // Auto-fill chatId for methods that need it
                    if (method.startsWith('send') || method.startsWith('edit') || 
                        method === 'deleteMessage' || method === 'pinChatMessage') {
                        if (args.length === 1 || (args.length > 1 && typeof args[0] !== 'object')) {
                            args.unshift(this.context.chatId);
                        }
                    }
                    return this.bot[method](...args);
                };
            }
        });

        // Add utility methods
        this.setupUtilityMethods();
    }

    setupUtilityMethods() {
        // User information
        this.getUser = () => ({
            id: this.context.userId,
            username: this.context.username,
            first_name: this.context.first_name,
            chat_id: this.context.chatId
        });

        // Enhanced sendMessage with shortcuts
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
                reply_markup: {
                    inline_keyboard: buttons
                },
                parse_mode: 'HTML',
                ...options
            });
        };

        this.sendReplyKeyboard = (text, buttons, options = {}) => {
            return this.sendMessage(this.context.chatId, text, {
                reply_markup: {
                    keyboard: buttons,
                    resize_keyboard: true
                },
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

        // Python integration
        this.runPython = (code) => this.context.pythonRunner.runPythonCode(code);
        this.installPython = (library) => this.context.pythonRunner.installPythonLibrary(library);

        // Utility
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Wait for answer
        this.waitForAnswer = (question, options = {}) => {
            return new Promise((resolve) => {
                const nextCommandKey = `${this.context.botToken}_${this.context.userId}`;
                
                this.sendMessage(this.context.chatId, question, {
                    parse_mode: 'HTML',
                    ...options
                }).then(() => {
                    this.context.nextCommandHandlers.set(nextCommandKey, (answer) => {
                        resolve(answer);
                    });
                }).catch(console.error);
            });
        };
    }
}

module.exports = ApiWrapper;