// server/core/command-executor.js - waitForAnswer execution context
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken.substring(0, 15)}...`);
            console.log(`💬 Input: "${userInput}"`);
            console.log(`📝 Code length: ${code.length} characters`);

            // Create enhanced execution environment
            const executionEnv = {
                bot: botInstance,
                
                Api: new (require('./api-wrapper'))(botInstance, {
                    msg: msg,
                    chatId: chatId,
                    userId: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    botToken: botToken,
                    userInput: userInput,
                    nextCommandHandlers: nextCommandHandlers,
                    User: context.User,
                    Bot: context.Bot
                }),

                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    chat_id: chatId
                }),

                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                botToken: botToken,
                
                User: context.User,
                Bot: context.Bot,
                
                nextCommandHandlers: nextCommandHandlers,
                
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                HTTP: {
                    get: async (url, options = {}) => {
                        const axios = require('axios');
                        try {
                            console.log(`🌐 HTTP GET: ${url}`);
                            const response = await axios.get(url, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP GET failed: ${error.message}`);
                        }
                    },
                    post: async (url, data = {}, options = {}) => {
                        const axios = require('axios');
                        try {
                            console.log(`🌐 HTTP POST: ${url}`);
                            const response = await axios.post(url, data, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP POST failed: ${error.message}`);
                        }
                    }
                }
            };

            // Enhanced execution code with COMPREHENSIVE logging
            const executionCode = `
                console.log('🚀 User code execution starting...');
                console.log('📊 Execution environment:', {
                    hasBot: typeof bot !== 'undefined',
                    hasApi: typeof Api !== 'undefined', 
                    hasGetUser: typeof getUser !== 'undefined',
                    hasWaitForAnswer: typeof waitForAnswer !== 'undefined',
                    nextCommandHandlersCount: nextCommandHandlers ? nextCommandHandlers.size : 0
                });

                try {
                    // User's command code
                    ${code}
                    
                    console.log('✅ User code executed successfully');
                    
                    // If no explicit return, return success
                    if (typeof result === 'undefined') {
                        return "Command executed successfully";
                    }
                    return result;
                } catch (error) {
                    console.error('❌ User code execution error:', error);
                    throw error;
                }
            `;

            const executionWrapper = {
                context: executionEnv
            };

            console.log('🚀 Executing user command code...');
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionWrapper);
            
            const result = await boundFunction();
            console.log('✅ Command execution completed successfully');
            console.log(`📦 Result:`, result);
            console.log(`✅ ========== COMMAND EXECUTION COMPLETE ==========\n`);
            
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            console.error('🔍 Error details:', {
                message: error.message,
                stack: error.stack
            });
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };