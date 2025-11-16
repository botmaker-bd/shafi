const ApiWrapper = require('./api-wrapper');
const vm = require('vm');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken.substring(0, 15)}...`);
            console.log(`💬 Input: "${userInput || msg.text || 'No input'}"`);

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
                userInput: userInput || msg.text || '',
                User: context.User,
                Bot: context.Bot
            };

            // Create ApiWrapper instance
            const apiWrapper = new ApiWrapper(botInstance, executionContext);

            // ✅ FIXED: Safer execution environment without return statement issue
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
                userInput: userInput || msg.text || '',
                params: userInput || msg.text || '',
                text: userInput || msg.text || '',
                
                // Data storage
                User: context.User,
                Bot: context.Bot,
                
                // Safe utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // Safe HTTP client
                HTTP: {
                    get: async (url, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.get(url, { 
                                ...options, 
                                timeout: 10000 
                            });
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP GET failed: ${error.message}`);
                        }
                    },
                    post: async (url, data = {}, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.post(url, data, { 
                                ...options, 
                                timeout: 10000 
                            });
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP POST failed: ${error.message}`);
                        }
                    }
                },

                // Safe globals
                Math: Math,
                Date: Date,
                JSON: JSON,
                console: console,
                String: String,
                Number: Number,
                Boolean: Boolean,
                Array: Array,
                Object: Object,
                RegExp: RegExp
            };

            console.log('🚀 Executing user command code...');

            try {
                // ✅ FIXED: Remove the problematic return statement
                const wrappedCode = `
                    try {
                        const { 
                            bot, Api, Bot, getUser, User,
                            msg, chatId, userId, userInput, params, text,
                            wait, HTTP,
                            Math, Date, JSON, console, String, Number, Boolean, Array, Object, RegExp
                        } = this;

                        // User's code execution
                        ${code}

                        // Auto-return if user doesn't return anything
                        if (typeof result !== 'undefined') {
                            return result;
                        }
                        return "Command executed successfully";
                    } catch (error) {
                        console.error('User code execution error:', error);
                        throw error;
                    }
                `;

                const script = new vm.Script(wrappedCode);
                const sandbox = vm.createContext(executionEnv);
                const result = script.runInContext(sandbox, {
                    timeout: 30000,
                    displayErrors: true
                });

                console.log('✅ Command execution completed successfully');
                console.log(`📦 Result:`, result);
                console.log(`✅ ========== COMMAND EXECUTION COMPLETE ==========\n`);
                
                resolve(result);

            } catch (vmError) {
                console.error('❌ VM execution error:', vmError);
                
                // ✅ Better error message for common issues
                let userFriendlyError = vmError.message;
                if (vmError.message.includes('Illegal return statement')) {
                    userFriendlyError = 'Syntax error: Remove return statements from your code. Use Api.sendMessage() instead.';
                } else if (vmError.message.includes('Unexpected token')) {
                    userFriendlyError = 'Syntax error: Check your JavaScript code for typos.';
                }
                
                throw new Error(`Code execution error: ${userFriendlyError}`);
            }

        } catch (error) {
            console.error('❌ Command execution setup error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };