// server/core/command-executor.js - FIXED METADATA METHODS
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            // ✅ FIX: Handle missing botToken gracefully
            let resolvedBotToken = botToken;
            if (!resolvedBotToken && context.command) {
                resolvedBotToken = context.command.bot_token;
            }
            if (!resolvedBotToken) {
                console.error('❌ CRITICAL: botToken is undefined! Using fallback...');
                try {
                    const botInfo = await botInstance.getMe();
                    resolvedBotToken = botInfo.token || 'fallback_token';
                } catch (e) {
                    resolvedBotToken = 'fallback_token';
                }
            }
            
            console.log(`🔧 Starting command execution for user ${userId}, bot: ${resolvedBotToken.substring(0, 10)}...`);
            
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
                botToken: resolvedBotToken,
                userInput: userInput,
                nextCommandHandlers: nextCommandHandlers || new Map()
            };
            
            // Create ApiWrapper instance
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // ✅ FIXED: Create unique variable names to avoid conflicts
            const createUserObject = () => {
                const userObj = msg.from ? Object.assign({}, msg.from) : {
                    id: userId,
                    first_name: first_name || '',
                    username: username || '',
                    language_code: context.language_code || ''
                };
                
                userObj.chat_id = chatId;
                return userObj;
            };

            const createChatObject = () => {
                const chatObj = msg.chat ? Object.assign({}, msg.chat) : {
                    id: chatId,
                    type: 'private'
                };
                return chatObj;
            };

            // ✅ FIXED: Python runner
            const pythonRunner = require('./python-runner');
            const runPythonSync = (pythonCode) => {
                try {
                    return pythonRunner.runPythonCodeSync(pythonCode);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            };

            // ✅ FIXED: Wait for answer function
            const waitForAnswer = async (question, options = {}) => {
                return new Promise((resolve, reject) => {
                    try {
                        const waitKey = `${resolvedBotToken}_${userId}`;
                        console.log(`⏳ Setting up waitForAnswer for user ${userId}`);
                        
                        // Send question first
                        botInstance.sendMessage(chatId, question, options)
                            .then(() => {
                                if (nextCommandHandlers) {
                                    nextCommandHandlers.set(waitKey, {
                                        resolve: resolve,
                                        reject: reject,
                                        timestamp: Date.now()
                                    });
                                    
                                    // Timeout cleanup
                                    setTimeout(() => {
                                        if (nextCommandHandlers.has(waitKey)) {
                                            const handler = nextCommandHandlers.get(waitKey);
                                            if (handler && handler.reject) {
                                                handler.reject(new Error('Wait for answer timeout (5 minutes)'));
                                            }
                                            nextCommandHandlers.delete(waitKey);
                                        }
                                    }, 5 * 60 * 1000);
                                }
                            })
                            .catch(sendError => {
                                reject(new Error('Failed to send question: ' + sendError.message));
                            });
                    } catch (error) {
                        reject(new Error('WaitForAnswer setup failed: ' + error.message));
                    }
                });
            };

            // ✅ FIXED: WAIT FUNCTION - IN SECONDS
            const waitFunction = (seconds) => {
                // Convert seconds to milliseconds
                const ms = seconds * 1000;
                console.log(`⏰ Waiting for ${seconds} seconds (${ms}ms)...`);
                return new Promise(resolve => {
                    setTimeout(() => {
                        console.log(`✅ Wait completed: ${seconds} seconds`);
                        resolve(`Waited ${seconds} seconds`);
                    }, ms);
                });
            };

            // ✅ FIXED: METADATA EXTRACTION FUNCTIONS
            const extractMetadata = async (target = 'all', options = {}) => {
                try {
                    return await apiWrapperInstance.inspectMetadata(target, options);
                } catch (error) {
                    console.error('❌ Metadata extraction error:', error);
                    return { error: error.message };
                }
            };

            // ✅ AUTO CONTEXT ANALYSIS
            const analyzeContext = () => {
                return {
                    user: createUserObject(),
                    chat: createChatObject(),
                    message: msg,
                    bot: {
                        token: resolvedBotToken?.substring(0, 10) + '...',
                        chatId: chatId,
                        userId: userId
                    },
                    input: userInput,
                    params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                    timestamp: new Date().toISOString()
                };
            };

            // ✅ CREATE BOT OBJECT WITH ALL METADATA METHODS
            const enhancedBot = {
                // Copy all methods from apiWrapperInstance
                ...apiWrapperInstance,
                
                // ✅ METADATA METHODS
                metadata: extractMetadata,
                metaData: extractMetadata,
                inspect: extractMetadata,
                getMeta: extractMetadata,
                analyze: (target, options) => extractMetadata(target, { deep: true, ...options }),
                
                // Quick access methods
                chatInfo: (chatId) => extractMetadata('chat', { chatId }),
                userInfo: (userId) => extractMetadata('user', { userId }),
                botInfo: () => extractMetadata('bot'),
                updateInfo: () => extractMetadata('update'),
                
                // Context analysis
                analyzeContext: analyzeContext,
                getContext: analyzeContext,
                
                // Other methods
                runPython: (pythonCode) => runPythonSync(pythonCode),
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer,
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction
            };

            // ✅ FIXED: Create execution environment
            const executionEnv = {
                // === BOT INSTANCES ===
                bot: enhancedBot,
                Bot: enhancedBot,
                Api: enhancedBot,
                api: enhancedBot,

                // === USER INFORMATION ===
                getUser: createUserObject,
                getCurrentUser: createUserObject,
                userData: createUserObject(),
                currentUser: createUserObject(),
                
                // === CHAT INFORMATION ===
                getChat: createChatObject,
                getCurrentChat: createChatObject,
                chatData: createChatObject(),
                currentChat: createChatObject(),
                
                // === MESSAGE & PARAMS ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                message: userInput,
                botToken: resolvedBotToken,
                
                // ✅ METADATA FUNCTIONS
                metadata: extractMetadata,
                inspect: extractMetadata,
                getMeta: extractMetadata,
                analyze: (target, options) => extractMetadata(target, { deep: true, ...options }),
                
                // Quick access methods
                chatInfo: (chatId) => extractMetadata('chat', { chatId }),
                userInfo: (userId) => extractMetadata('user', { userId }),
                botInfo: () => extractMetadata('bot'),
                updateInfo: () => extractMetadata('update'),
                
                // Context analysis
                analyzeContext: analyzeContext,
                getContext: analyzeContext,
                context: analyzeContext(),
                ctx: analyzeContext(),
                
                // === DATA STORAGE ===
                User: {
                    saveData: async (key, value) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data').upsert({
                                data_type: 'user_data',
                                bot_token: resolvedBotToken,
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
                                .eq('bot_token', resolvedBotToken)
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
                                .eq('bot_token', resolvedBotToken)
                                .eq('user_id', userId.toString())
                                .eq('data_key', key);
                        } catch (error) {
                            console.error('❌ Delete data error:', error);
                            throw error;
                        }
                    }
                },
                
                BotData: {
                    saveData: async (key, value) => {
                        try {
                            const supabase = require('../config/supabase');
                            await supabase.from('universal_data').upsert({
                                data_type: 'bot_data',
                                bot_token: resolvedBotToken,
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
                                .eq('bot_token', resolvedBotToken)
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
                                .eq('bot_token', resolvedBotToken)
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
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: (pythonCode) => runPythonSync(pythonCode),
                executePython: (pythonCode) => runPythonSync(pythonCode),
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer
            };

            // ✅ FIXED: Direct function shortcuts
            const directFunctions = {
                sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                send: (text, options) => botInstance.sendMessage(chatId, text, options),
                reply: (text, options) => botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                }),
                sendPhoto: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
                sendDocument: (doc, options) => botInstance.sendDocument(chatId, doc, options),
                getCurrentUser: createUserObject,
                getCurrentChat: createChatObject
            };

            // ✅ FIXED: Merge all functions
            const finalContext = {
                ...executionEnv,
                ...directFunctions
            };

            // ✅ FIXED: Create ASYNC execution function
            const executionFunction = new Function(
                'getUser', 'getCurrentUser', 'userData', 'currentUser', 
                'getChat', 'getCurrentChat', 'chatData', 'currentChat',
                'sendMessage', 'send', 'reply', 'bot', 'Api', 'Bot', 
                'params', 'message', 'User', 'BotData', 'wait', 'delay', 'sleep',
                'runPython', 'executePython', 'waitForAnswer', 'ask',
                'metadata', 'inspect', 'getMeta', 'analyze',
                'chatInfo', 'userInfo', 'botInfo', 'updateInfo',
                'analyzeContext', 'getContext', 'context', 'ctx',
                `return (async function() {
                    try {
                        // ✅ User can use all functions
                        var user = getUser();
                        var currentUser = getCurrentUser();
                        
                        console.log('✅ Execution started for user:', user.first_name);
                        
                        // User's code starts here
                        ${code}
                        // User's code ends here
                        
                        return "Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
                            await sendMessage("❌ Error: " + error.message);
                        } catch (e) {
                            console.error('Failed to send error message:', e);
                        }
                        throw error;
                    }
                })();`
            );

            // Execute the command
            console.log('🚀 Executing command...');
            const result = await executionFunction(
                finalContext.getUser,
                finalContext.getCurrentUser,
                finalContext.userData,
                finalContext.currentUser,
                finalContext.getChat,
                finalContext.getCurrentChat,
                finalContext.chatData,
                finalContext.currentChat,
                finalContext.sendMessage,
                finalContext.send,
                finalContext.reply,
                finalContext.bot,
                finalContext.Api,
                finalContext.Bot,
                finalContext.params,
                finalContext.message,
                finalContext.User,
                finalContext.BotData,
                finalContext.wait,
                finalContext.delay,
                finalContext.sleep,
                finalContext.runPython,
                finalContext.executePython,
                finalContext.waitForAnswer,
                finalContext.ask,
                finalContext.metadata,
                finalContext.inspect,
                finalContext.getMeta,
                finalContext.analyze,
                finalContext.chatInfo,
                finalContext.userInfo,
                finalContext.botInfo,
                finalContext.updateInfo,
                finalContext.analyzeContext,
                finalContext.getContext,
                finalContext.context,
                finalContext.ctx
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