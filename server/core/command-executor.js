// server/core/command-executor.js - COMPLETELY FIXED
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            // ✅ FIX: Validate botToken
            if (!botToken) {
                console.error('❌ CRITICAL: botToken is undefined!');
                console.log('Context keys:', Object.keys(context));
                reject(new Error('botToken is required but was undefined'));
                return;
            }
            
            console.log(`🔧 Starting command execution for user ${userId}, bot: ${botToken.substring(0, 10)}...`);
            
            // Import ApiWrapper
            const ApiWrapper = require('./api-wrapper');
            
            // Create the context for ApiWrapper
            const apiContext = {
                msg: msg,
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: context.last_name || '',
                language_code: context.language_code || '',
                botToken: botToken, // ✅ NOW DEFINED
                userInput: userInput,
                nextCommandHandlers: nextCommandHandlers || new Map(),
                User: context.User || {},
                Bot: context.Bot || {}
            };
            
            // Create ApiWrapper instance
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // Parse parameters
            const parseParams = (input) => {
                if (!input) return [];
                const parts = input.split(' ').slice(1);
                return parts.filter(param => param.trim() !== '');
            };

            const params = parseParams(userInput);
            const message = userInput;

            // ✅ SYNCHRONOUS PYTHON RUNNER
            const pythonRunner = require('./python-runner');
            
            const runPythonSync = (pythonCode) => {
                try {
                    console.log('🐍 Running Python code synchronously...');
                    const result = pythonRunner.runPythonCodeSync(pythonCode);
                    console.log('✅ Python execution completed');
                    return result;
                } catch (error) {
                    console.error('❌ Python execution failed:', error);
                    throw new Error(`Python Error: ${error.message}`);
                }
            };

            // ✅ FIXED: PROPER WAIT FOR ANSWER WITH BOTTOKEN VALIDATION
            const waitForAnswer = (question, options = {}) => {
                return new Promise((resolve, reject) => {
                    try {
                        console.log(`⏳ Setting up waitForAnswer for user ${userId}, bot: ${botToken.substring(0, 10)}...`);
                        
                        // ✅ VALIDATE botToken again
                        if (!botToken) {
                            reject(new Error('botToken is undefined in waitForAnswer'));
                            return;
                        }

                        // First send the question
                        botInstance.sendMessage(chatId, question, options)
                            .then(() => {
                                // Create unique key for this waiting answer
                                const waitKey = `${botToken}_${userId}`;
                                
                                console.log(`🔑 Wait key created: ${waitKey}`);
                                console.log(`📊 nextCommandHandlers available: ${!!nextCommandHandlers}`);
                                
                                // Store the resolver in nextCommandHandlers
                                if (nextCommandHandlers) {
                                    // Store both resolve and reject functions
                                    nextCommandHandlers.set(waitKey, {
                                        resolve: resolve,
                                        reject: reject,
                                        timestamp: Date.now(),
                                        botToken: botToken, // ✅ Store for verification
                                        userId: userId
                                    });
                                    
                                    console.log(`✅ WaitForAnswer handler stored for ${waitKey}`);
                                    console.log(`📋 Total handlers: ${nextCommandHandlers.size}`);
                                } else {
                                    reject(new Error('nextCommandHandlers not available'));
                                    return;
                                }
                                
                                // Set timeout to clean up (5 minutes)
                                setTimeout(() => {
                                    if (nextCommandHandlers && nextCommandHandlers.has(waitKey)) {
                                        const handler = nextCommandHandlers.get(waitKey);
                                        if (handler && handler.reject) {
                                            handler.reject(new Error('Wait for answer timeout (5 minutes)'));
                                        }
                                        nextCommandHandlers.delete(waitKey);
                                        console.log(`⏰ WaitForAnswer timeout for ${waitKey}`);
                                    }
                                }, 5 * 60 * 1000);
                                
                            })
                            .catch(sendError => {
                                console.error('❌ Failed to send waitForAnswer question:', sendError);
                                reject(new Error('Failed to send question: ' + sendError.message));
                            });
                            
                    } catch (error) {
                        console.error('❌ WaitForAnswer setup error:', error);
                        reject(new Error('WaitForAnswer setup failed: ' + error.message));
                    }
                });
            };

            // Create execution environment
            const executionEnv = {
                // === BOT INSTANCES ===
                bot: apiWrapperInstance,
                Api: apiWrapperInstance,
                
                // ✅ FIXED: Bot object with all methods
                Bot: {
                    ...apiWrapperInstance,
                    runPython: (pythonCode) => runPythonSync(pythonCode),
                    waitForAnswer: waitForAnswer,
                    ask: waitForAnswer
                },
                
                // === USER INFORMATION ===
                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    chat_id: chatId
                }),
                
                // === MESSAGE & PARAMS ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: params,
                message: message,
                botToken: botToken, // ✅ DEFINED
                
                // === DATA STORAGE ===
                User: context.User || {
                    saveData: async (key, value) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data').upsert({
                                data_type: 'user_data',
                                bot_token: botToken,
                                user_id: userId.toString(),
                                data_key: key,
                                data_value: JSON.stringify(value),
                                updated_at: new Date().toISOString()
                            });
                        } catch (error) {
                            console.error('❌ Save data error:', error);
                            throw error;
                        }
                    },
                    getData: async (key) => {
                        try {
                            const supabase = require('../config/supabase');
                            const { data } = await supabase.from('universal_data')
                                .select('data_value')
                                .eq('data_type', 'user_data')
                                .eq('bot_token', botToken)
                                .eq('user_id', userId.toString())
                                .eq('data_key', key)
                                .single();
                            return data ? JSON.parse(data.data_value) : null;
                        } catch (error) {
                            console.error('❌ Get data error:', error);
                            return null;
                        }
                    },
                    deleteData: async (key) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data')
                                .delete()
                                .eq('data_type', 'user_data')
                                .eq('bot_token', botToken)
                                .eq('user_id', userId.toString())
                                .eq('data_key', key);
                        } catch (error) {
                            console.error('❌ Delete data error:', error);
                            throw error;
                        }
                    }
                },
                
                BotData: context.Bot || {
                    saveData: async (key, value) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data').upsert({
                                data_type: 'bot_data',
                                bot_token: botToken,
                                data_key: key,
                                data_value: JSON.stringify(value),
                                updated_at: new Date().toISOString()
                            });
                        } catch (error) {
                            console.error('❌ Save bot data error:', error);
                            throw error;
                        }
                    },
                    getData: async (key) => {
                        try {
                            const supabase = require('../config/supabase');
                            const { data } = await supabase.from('universal_data')
                                .select('data_value')
                                .eq('data_type', 'bot_data')
                                .eq('bot_token', botToken)
                                .eq('data_key', key)
                                .single();
                            return data ? JSON.parse(data.data_value) : null;
                        } catch (error) {
                            console.error('❌ Get bot data error:', error);
                            return null;
                        }
                    },
                    deleteData: async (key) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data')
                                .delete()
                                .eq('data_type', 'bot_data')
                                .eq('bot_token', botToken)
                                .eq('data_key', key);
                        } catch (error) {
                            console.error('❌ Delete bot data error:', error);
                            throw error;
                        }
                    }
                },
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers,
                
                // === UTILITY FUNCTIONS ===
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                runPython: (pythonCode) => runPythonSync(pythonCode),
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer
            };

            // Direct function shortcuts
            const directFunctions = {
                sendMessage: (text, options) => {
                    return botInstance.sendMessage(chatId, text, options);
                },
                send: (text, options) => {
                    return botInstance.sendMessage(chatId, text, options);
                },
                reply: (text, options) => {
                    return botInstance.sendMessage(chatId, text, {
                        reply_to_message_id: msg.message_id,
                        ...options
                    });
                },
                sendPhoto: (photo, options) => {
                    return botInstance.sendPhoto(chatId, photo, options);
                },
                sendDocument: (doc, options) => {
                    return botInstance.sendDocument(chatId, doc, options);
                },
                getUser: () => executionEnv.getUser(),
                wait: (ms) => executionEnv.wait(ms),
                runPython: (code) => executionEnv.runPython(code),
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer
            };

            // Merge all functions
            const finalContext = {
                ...executionEnv,
                ...directFunctions
            };

            // ✅ FIXED: Create the execution function with user code
            const executionFunction = new Function(
                'getUser', 'sendMessage', 'bot', 'Api', 'Bot', 'params', 'message', 'User', 'BotData', 'wait', 'runPython', 'waitForAnswer', 'ask',
                `try {
                    var user = getUser();
                    console.log('✅ Execution started for user:', user.first_name);
                    console.log('📝 User input:', message);
                    console.log('📋 Parameters:', params);
                    console.log('🤖 Bot.runPython available:', typeof Bot.runPython);
                    console.log('🐍 runPython available:', typeof runPython);
                    console.log('⏳ waitForAnswer available:', typeof waitForAnswer);
                    console.log('❓ ask available:', typeof ask);
                    console.log('🔑 botToken available:', typeof botToken);
                    
                    // User's code starts here
                    ${code}
                    // User's code ends here
                    
                    return "Command completed successfully";
                } catch (error) {
                    console.error('❌ Execution error:', error);
                    try {
                        sendMessage("❌ Error: " + error.message);
                    } catch (e) {
                        console.error('Failed to send error message:', e);
                    }
                    throw error;
                }`
            );

            // Execute the command
            console.log('🚀 Executing command...');
            const result = await executionFunction(
                finalContext.getUser,
                finalContext.sendMessage,
                finalContext.bot,
                finalContext.Api,
                finalContext.Bot,
                finalContext.params,
                finalContext.message,
                finalContext.User,
                finalContext.BotData,
                finalContext.wait,
                finalContext.runPython,
                finalContext.waitForAnswer,
                finalContext.ask
            );
            
            console.log('✅ Command execution completed');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };