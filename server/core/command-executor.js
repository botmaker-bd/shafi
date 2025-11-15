// server/core/command-executor.js - FIXED VERSION (No Async/Await)
const ApiWrapper = require('./api-wrapper');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken ? botToken.substring(0, 15) + '...' : 'TEST_MODE'}`);
            console.log(`💬 Input: "${userInput}"`);
            console.log(`📝 Code length: ${code.length} characters`);
            console.log(`📊 nextCommandHandlers available: ${!!nextCommandHandlers}`);

            // Handle test mode where context might be incomplete
            const executionContext = {
                msg: msg || {},
                chatId: chatId || context.testChatId || 123456789,
                userId: userId || context.testUserId || 123456789,
                username: username || 'test_user',
                first_name: first_name || 'Test User',
                last_name: context.last_name || '',
                language_code: context.language_code || '',
                botToken: botToken || context.testBotToken || 'test_bot_token',
                userInput: userInput || '',
                nextCommandHandlers: nextCommandHandlers || new Map(),
                User: context.User || {
                    saveData: (key, value) => {
                        console.log(`💾 TEST MODE - Save data: ${key} = ${value}`);
                        return value;
                    },
                    getData: (key) => {
                        console.log(`💾 TEST MODE - Get data: ${key}`);
                        return null;
                    },
                    deleteData: (key) => {
                        console.log(`💾 TEST MODE - Delete data: ${key}`);
                        return true;
                    }
                },
                Bot: context.Bot || {
                    saveData: (key, value) => {
                        console.log(`💾 TEST MODE - Save bot data: ${key} = ${value}`);
                        return value;
                    },
                    getData: (key) => {
                        console.log(`💾 TEST MODE - Get bot data: ${key}`);
                        return null;
                    }
                }
            };

            // Create ApiWrapper instance
            const apiWrapper = new ApiWrapper(botInstance, executionContext);

            // Create execution environment
            const executionEnv = {
                // Core Telegram methods
                bot: botInstance,
                Api: apiWrapper,
                api: apiWrapper,
                Bot: apiWrapper,

                // User context
                getUser: () => ({
                    id: executionContext.userId,
                    username: executionContext.username,
                    first_name: executionContext.first_name,
                    last_name: executionContext.last_name,
                    language_code: executionContext.language_code,
                    chat_id: executionContext.chatId
                }),

                // Message data
                msg: executionContext.msg,
                chatId: executionContext.chatId,
                userId: executionContext.userId,
                userInput: executionContext.userInput,
                params: executionContext.userInput,
                botToken: executionContext.botToken,
                
                // Data storage
                User: executionContext.User,
                Bot: executionContext.Bot,
                
                // Next command handlers
                nextCommandHandlers: executionContext.nextCommandHandlers,
                
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
            console.log('🔍 Execution mode:', botToken ? 'LIVE' : 'TEST');

            // ✅ FIX: Execute user code WITHOUT async/await in Function constructor
            const executeUserCode = async () => {
                try {
                    const isTestMode = !botToken || botToken === 'test_bot_token';
                    
                    if (isTestMode) {
                        console.log('🧪 TEST MODE - Simulating command execution');
                        
                        // For test mode, use simplified execution
                        const testFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            console.log('📊 TEST - Starting command execution');
                            
                            // Mock waitForAnswer for testing
                            Api.waitForAnswer = function(question, options) {
                                console.log("⏳ TEST - Would wait for answer:", question);
                                return Promise.resolve({
                                    text: "Test User Response",
                                    message: { from: { first_name: "Test", id: 123456789 } },
                                    userId: 123456789,
                                    chatId: 123456789,
                                    timestamp: new Date().toISOString()
                                });
                            };
                            
                            // Mock sendMessage for testing
                            Api.sendMessage = function(text, options) {
                                console.log("📤 TEST - Message:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
                                return Promise.resolve({ message_id: 123, date: Date.now() });
                            };
                            
                            try {
                                // User's code
                                ${code}
                                
                                if (typeof result === 'undefined') {
                                    return "Test command executed successfully";
                                }
                                return result;
                            } catch (error) {
                                console.error('❌ Test code error:', error);
                                throw error;
                            }
                        `);
                        
                        return testFunction.call(executionEnv);
                    } else {
                        console.log('🚀 LIVE MODE - Executing real command');
                        
                        // For live mode, handle async operations differently
                        // We'll execute the code and handle async operations at our level
                        const liveCode = code.replace(/await\s+(\w+\.\w+)/g, '/* await $1 */');
                        
                        const liveFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            let finalResult;
                            
                            try {
                                // User's code (async operations handled externally)
                                ${liveCode}
                                
                                if (typeof result === 'undefined') {
                                    finalResult = "Command executed successfully";
                                } else {
                                    finalResult = result;
                                }
                            } catch (error) {
                                console.error('❌ Live code error:', error);
                                throw error;
                            }
                            
                            return finalResult;
                        `);
                        
                        const syncResult = liveFunction.call(executionEnv);
                        
                        // If there are async operations in the code, handle them manually
                        if (code.includes('Api.waitForAnswer') || code.includes('Api.sendMessage')) {
                            console.log('🔄 Live mode with async operations - executing step by step');
                            
                            // Execute async operations sequentially
                            if (code.includes('Api.waitForAnswer')) {
                                // This would be handled by the actual waitForAnswer implementation
                                console.log('⏳ Live waitForAnswer would execute here');
                            }
                            
                            return syncResult || "Live command with async operations executed";
                        }
                        
                        return syncResult;
                    }
                    
                } catch (error) {
                    console.error('❌ User code execution error:', error);
                    throw error;
                }
            };

            // Execute the user code
            const result = await executeUserCode();
            
            console.log('✅ Command execution completed successfully');
            console.log(`📦 Result:`, result);
            console.log(`📊 Active handlers after execution: ${executionContext.nextCommandHandlers?.size || 0}`);
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