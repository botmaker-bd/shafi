// server/core/api-wrapper.js
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupMethods();
    }

    setupMethods() {
        // Basic Telegram methods
        const methods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 
            'sendAudio', 'sendVoice', 'sendLocation', 'sendContact',
            'sendPoll', 'editMessageText', 'deleteMessage', 'forwardMessage'
        ];

        methods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        // Auto-fill chatId for methods that need it
                        if (this.needsChatId(method) && (args.length === 0 || typeof args[0] !== 'object')) {
                            args.unshift(this.context.chatId);
                        }
                        
                        const result = await this.bot[method](...args);
                        return result;
                    } catch (error) {
                        console.error(`❌ API ${method} error:`, error);
                        throw error;
                    }
                };
            }
        });
    }

    needsChatId(method) {
        const chatIdMethods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo',
            'sendAudio', 'sendVoice', 'sendLocation', 'sendContact',
            'sendPoll', 'forwardMessage'
        ];
        return chatIdMethods.includes(method);
    }

    // Simple send method
    send(text, options = {}) {
        return this.sendMessage(this.context.chatId, text, {
            parse_mode: 'Markdown',
            ...options
        });
    }

    // Simple reply method
    reply(text, options = {}) {
        return this.sendMessage(this.context.chatId, text, {
            reply_to_message_id: this.context.msg.message_id,
            parse_mode: 'Markdown',
            ...options
        });
    }
}

module.exports = ApiWrapper;