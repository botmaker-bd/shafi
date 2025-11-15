// server/core/command-executor.js
const ApiWrapper = require('./api-wrapper');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken.substring(0, 15)}...`);
            console.log(`💬 Input: "${userInput}"`);

            // Create execution context
            const executionContext = {
                msg: msg,
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: context.last_name || '',
                language_code: context.language_code || '',
                botToken: botToken,
                userInput: userInput,
                User: context.User,
                Bot: context.Bot
            };

            // Create ApiWrapper instance
            const apiWrapper = new ApiWrapper(botInstance, executionContext);

            // Create execution environment
            const executionEnv = {
                // Core methods
                bot: botInstance,
                Api: apiWrapper,
                Bot: apiWrapper,

                // User context
                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    chat_id: chatId
                }),

                // User input variables
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                text: userInput,
                
                // Data storage
                User: context.User,
                Bot: context.Bot,
                
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

            console.log('🚀 Executing user command code...');

            // Execute user code
            const executeUserCode = () => {
                try {
                    const { 
                        bot, Api, Bot, getUser, User,
                        msg, chatId, userId, userInput, params, text,
                        wait, HTTP
                    } = executionEnv;

                    console.log('📊 User code execution starting...');

                    // Execute user code directly
                    const syncFunction = new Function(`
                        const { 
                            bot, Api, Bot, getUser, User,
                            msg, chatId, userId, userInput, params, text,
                            wait, HTTP
                        } = this;
                        
                        try {
                            ${code}
                            return typeof result !== 'undefined' ? result : "Command executed successfully";
                        } catch (error) {
                            console.error('User code error:', error);
                            return "Command executed with errors";
                        }
                    `);
                    
                    return syncFunction.call(executionEnv);
                    
                } catch (error) {
                    console.error('❌ User code execution error:', error);
                    return "Command execution failed";
                }
            };

            // Execute the user code
            const result = executeUserCode();
            
            console.log('✅ Command execution completed');
            console.log(`📦 Result:`, result);
            console.log(`✅ ========== COMMAND EXECUTION COMPLETE ==========\n`);
            
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };