// server/core/command-executor.js - FIXED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`🔧 Starting command execution with waitForAnswer support`);
            
            // Create enhanced execution environment
            const executionEnv = {
                bot: botInstance,
                
                // FIX: Proper Api wrapper with correct context
                Api: new (require('./api-wrapper'))(botInstance, {
                    msg: context.msg,
                    chatId: context.chatId,
                    userId: context.userId,
                    username: context.username || '',
                    first_name: context.first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    botToken: context.botToken,
                    userInput: context.userInput,
                    nextCommandHandlers: context.nextCommandHandlers, // ✅ FIXED: Properly pass nextCommandHandlers
                    User: context.User,
                    Bot: context.Bot
                }),
                
                // User information
                getUser: () => ({
                    id: context.userId,
                    username: context.username || '',
                    first_name: context.first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    chat_id: context.chatId
                }),
                
                // Message context
                msg: context.msg,
                chatId: context.chatId,
                userId: context.userId,
                userInput: context.userInput,
                params: context.userInput,
                botToken: context.botToken,
                
                // Data storage
                User: context.User,
                Bot: context.Bot,
                
                // FIX: Properly expose nextCommandHandlers
                nextCommandHandlers: context.nextCommandHandlers,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // HTTP client
                HTTP: {
                    get: async (url, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.get(url, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP GET failed: ${error.message}`);
                        }
                    },
                    post: async (url, data = {}, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.post(url, data, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP POST failed: ${error.message}`);
                        }
                    }
                }
            };

            // Enhanced execution code with proper async handling
            const executionCode = `
                const { 
                    Api, getUser, User, Bot,
                    msg, chatId, userId, userInput, params,
                    nextCommandHandlers, wait, HTTP
                } = this.context;

                console.log('🔧 User code execution starting...');
                console.log('⏳ WaitForAnswer available:', typeof Api.waitForAnswer === 'function');
                console.log('📊 nextCommandHandlers available:', !!nextCommandHandlers);

                // Async wrapper for user's code
                const executeUserCode = async () => {
                    try {
                        // User's command code
                        ${code}
                        
                        return typeof result !== 'undefined' ? result : "Command executed successfully";
                    } catch (error) {
                        console.error('Command execution error:', error);
                        throw error;
                    }
                };

                return executeUserCode();
            `;

            const executionWrapper = {
                context: executionEnv
            };

            console.log('🚀 Executing user command code with waitForAnswer support...');
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionWrapper);
            
            const result = await boundFunction();
            console.log('✅ Command execution completed successfully');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };