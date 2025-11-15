// server/core/api-wrapper.js - SIMPLIFIED VERSION
class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupAllMethods();
    }

    setupAllMethods() {
        // Basic Telegram methods
        const methods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 
            'sendAudio', 'sendVoice', 'sendLocation', 'sendVenue',
            'sendContact', 'sendChatAction', 'getMe'
        ];

        // Bind all methods to this instance
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
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw new Error(`Telegram API Error (${method}): ${error.message}`);
                    }
                };
            }
        });

        // Enhanced utility methods
        this.setupEnhancedMethods();
    }

    needsChatId(method) {
        const chatIdMethods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio',
            'sendVoice', 'sendLocation', 'sendVenue', 'sendContact', 'sendChatAction'
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
            chat_id: this.context.chatId
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
                reply_to_message_id: this.context.msg.message_id,
                parse_mode: 'HTML',
                ...options
            });
        };

        // ✅ FIXED: Simplified waitForAnswer without nextCommandHandlers
        this.waitForAnswer = (question, options = {}) => {
            return new Promise(async (resolve, reject) => {
                console.log(`🎯 waitForAnswer: "${question}"`);
                
                const timeout = options.timeout || 30000;
                
                try {
                    // Send question
                    await this.sendMessage(this.context.chatId, question, {
                        parse_mode: 'HTML',
                        ...options
                    });
                    
                    console.log(`✅ Question sent, waiting for response...`);
                    
                    // Set timeout
                    const timeoutId = setTimeout(() => {
                        reject(new Error(`Wait for answer timeout (${timeout/1000} seconds)`));
                    }, timeout);

                    // Store the resolve function in context for bot-manager to call
                    this.context.waitForAnswerResolve = resolve;
                    this.context.waitForAnswerTimeout = timeoutId;
                    
                } catch (error) {
                    reject(new Error(`Failed to set up wait for answer: ${error.message}`));
                }
            });
        };

        // Python integration
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCode(code);
        };

        // Utility methods
        this.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ApiWrapper;