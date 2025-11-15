// server/core/command-executor.js - FIXED VERSION
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

            // ✅ FIX: Handle test mode where context might be incomplete
            const executionContext = {
                msg: msg || {},
                chatId: chatId || context.testChatId || 123456789, // Default for testing
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
            const executeUserCode = () => {
                try {
                    // Extract all variables for user code
                    const { 
                        bot, Api, api, Bot, getUser, User, BotData,
                        msg, chatId, userId, userInput, params,
                        wait, HTTP, nextCommandHandlers
                    } = executionEnv;

                    console.log('📊 User code execution starting...');

                    // ========================
                    // USER'S COMMAND CODE EXECUTION
                    // ========================
                    
                    let result;
                    
                    // Check if this is test mode (no real bot token)
                    const isTestMode = !botToken || botToken === 'test_bot_token';
                    
                    if (isTestMode) {
                        console.log('🧪 TEST MODE - Simulating command execution');
                        
                        // For test mode, simulate the execution without actual API calls
                        const testCode = code.replace(/await\s+Api\.waitForAnswer/g, '// TEST: waitForAnswer skipped')
                                            .replace(/Api\.sendMessage/g, 'console.log("📤 TEST - Message:")');
                        
                        const testFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            // Mock waitForAnswer for testing
                            Api.waitForAnswer = (question, options) => {
                                console.log("⏳ TEST - waitForAnswer called:", question);
                                return Promise.resolve({
                                    text: "Test User Response",
                                    message: { from: { first_name: "Test", id: 123456789 } },
                                    userId: 123456789,
                                    chatId: 123456789,
                                    timestamp: new Date().toISOString()
                                });
                            };
                            
                            // Mock sendMessage for testing
                            Api.sendMessage = (text, options) => {
                                console.log("📤 TEST - sendMessage:", text);
                                return Promise.resolve();
                            };
                            
                            try {
                                ${testCode}
                                return typeof result !== 'undefined' ? result : "Test command executed successfully";
                            } catch (error) {
                                console.error('❌ Test code error:', error);
                                throw error;
                            }
                        `);
                        
                        result = testFunction.call(executionEnv);
                    } else {
                        console.log('🚀 LIVE MODE - Executing real command');
                        
                        // For live mode, use the original code with proper async handling
                        const liveFunction = new Function(`
                            const { 
                                bot, Api, api, Bot, getUser, User, BotData,
                                msg, chatId, userId, userInput, params,
                                wait, HTTP, nextCommandHandlers
                            } = this;
                            
                            return (async () => {
                                try {
                                    ${code}
                                    return typeof result !== 'undefined' ? result : "Command executed successfully";
                                } catch (error) {
                                    console.error('❌ Live code error:', error);
                                    throw error;
                                }
                            })();
                        `);
                        
                        result = await liveFunction.call(executionEnv);
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