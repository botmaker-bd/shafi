// server/core/command-executor.js - COMPLETELY FIXED VERSION
const ApiWrapper = require('./api-wrapper');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken.substring(0, 15)}...`);
            console.log(`💬 Input: "${userInput}"`);
            console.log(`📝 Code length: ${code.length} characters`);
            console.log(`📊 nextCommandHandlers available: ${!!nextCommandHandlers}`);

            // ✅ FIX: Create proper execution context
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
                nextCommandHandlers: nextCommandHandlers,
                User: context.User,
                Bot: context.Bot
            };

            // Create ApiWrapper instance
            const apiWrapper = new ApiWrapper(botInstance, executionContext);

            // ✅ FIX: Create execution environment with PROPER function binding
            const executionEnv = {
                // Core Telegram methods
                bot: botInstance,
                Api: apiWrapper,
                api: apiWrapper,
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

                // Message data
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                botToken: botToken,
                
                // Data storage
                User: context.User,
                Bot: context.Bot,
                
                // Next command handlers
                nextCommandHandlers: nextCommandHandlers,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // HTTP client
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

            console.log('🚀 Executing user command code...');
            console.log('🔍 Execution environment prepared:', {
                hasApiWrapper: !!apiWrapper,
                hasWaitForAnswer: typeof apiWrapper.waitForAnswer === 'function',
                hasNextCommandHandlers: !!executionEnv.nextCommandHandlers
            });

            // ✅ CRITICAL FIX: Use async function wrapper for user code
            const executeUserCode = async () => {
                try {
                    // Extract all variables for user code
                    const { 
                        bot, Api, api, Bot, getUser, User, BotData,
                        msg, chatId, userId, userInput, params,
                        wait, HTTP, nextCommandHandlers
                    } = executionEnv;

                    console.log('📊 User code execution starting...');
                    console.log('🔍 Available functions:', {
                        hasWaitForAnswer: typeof Api.waitForAnswer === 'function',
                        hasSendMessage: typeof Api.sendMessage === 'function',
                        chatId: chatId
                    });

                    // ========================
                    // USER'S COMMAND CODE EXECUTION
                    // ========================
                    
                    // ✅ FIX: Handle both async and sync code properly
                    let result;
                    
                    // Check if code contains async operations
                    if (code.includes('await') || code.includes('.then')) {
                        console.log('🔄 Detected async code, executing with await...');
                        
                        // For async code, we need to handle it differently
                        const asyncCode = `
                            try {
                                ${code}
                                return typeof result !== 'undefined' ? result : "Command executed successfully";
                            } catch (error) {
                                console.error('❌ User code error:', error);
                                throw error;
                            }
                        `;
                        
                        // Create async function
                        const asyncFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            return (async () => {
                                ${asyncCode}
                            })();
                        `);
                        
                        result = await asyncFunction.call(executionEnv);
                    } else {
                        console.log('⚡ Executing sync code...');
                        // For sync code, use regular function
                        const syncFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            try {
                                ${code}
                                return typeof result !== 'undefined' ? result : "Command executed successfully";
                            } catch (error) {
                                console.error('❌ User code error:', error);
                                throw error;
                            }
                        `);
                        
                        result = syncFunction.call(executionEnv);
                    }

                    console.log('✅ User code executed successfully');
                    return result;
                    
                } catch (error) {
                    console.error('❌ User code execution error:', error);
                    throw error;
                }
            };

            // Execute the user code
            const result = await executeUserCode();
            
            console.log('✅ Command execution completed successfully');
            console.log(`📦 Result:`, result);
            console.log(`📊 Active handlers after execution: ${nextCommandHandlers?.size || 0}`);
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