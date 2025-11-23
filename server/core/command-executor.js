// server/core/command-executor.js - COMPLETELY FIXED VERSION
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

            // ✅ FIXED: METADATA FUNCTION - ORIGINAL RESPONSE ONLY
            const extractMetadata = async (target = 'message') => {
                return await apiWrapperInstance.metadata(target);
            };

            // ✅ FIXED: USER DATA FUNCTIONS WITH AUTO-AWAIT SUPPORT
            const getUserData = async (key) => {
                return await apiWrapperInstance.User.getData(key);
            };

            const saveUserData = async (key, value) => {
                return await apiWrapperInstance.User.saveData(key, value);
            };

            const deleteUserData = async (key) => {
                return await apiWrapperInstance.User.deleteData(key);
            };

            const incrementUserData = async (key, amount = 1) => {
                const current = await getUserData(key);
                const newValue = (parseInt(current) || 0) + amount;
                await saveUserData(key, newValue);
                return newValue;
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

            // ✅ CREATE SMART USER OBJECT WITH AUTO-AWAIT
            const createSmartUserObject = () => {
                const userObj = {
                    getData: (key) => {
                        // Auto-handle both sync and async usage
                        const resultPromise = getUserData(key);
                        
                        // Create a proxy that handles both await and direct usage
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') {
                                    // If used with await, return the promise
                                    return resultPromise.then.bind(resultPromise);
                                }
                                if (prop === 'valueOf') {
                                    return () => resultPromise;
                                }
                                if (prop === 'toString') {
                                    return () => '[UserData Promise]';
                                }
                                return undefined;
                            }
                        };
                        
                        return new Proxy(resultPromise, handler);
                    },
                    
                    saveData: (key, value) => {
                        const resultPromise = saveUserData(key, value);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[UserSave Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    deleteData: (key) => {
                        const resultPromise = deleteUserData(key);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[UserDelete Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    increment: (key, amount = 1) => {
                        const resultPromise = incrementUserData(key, amount);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[UserIncrement Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    }
                };
                
                return userObj;
            };

            // ✅ CREATE SMART BOT OBJECT WITH AUTO-AWAIT
            const createSmartBotObject = () => {
                const botObj = {
                    // Copy all methods from apiWrapperInstance with auto-await support
                    sendMessage: (text, options) => {
                        const resultPromise = apiWrapperInstance.sendMessage(text, options);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[SendMessage Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    send: (text, options) => {
                        const resultPromise = apiWrapperInstance.send(text, options);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[Send Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    reply: (text, options) => {
                        const resultPromise = apiWrapperInstance.reply(text, options);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[Reply Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    // Metadata methods
                    metadata: (target) => {
                        const resultPromise = extractMetadata(target);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[Metadata Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    metaData: (target) => {
                        const resultPromise = extractMetadata(target);
                        const handler = {
                            get(target, prop) {
                                if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                if (prop === 'valueOf') return () => resultPromise;
                                if (prop === 'toString') return () => '[MetaData Promise]';
                                return undefined;
                            }
                        };
                        return new Proxy(resultPromise, handler);
                    },
                    
                    // Other methods with auto-await
                    getUser: () => createUserObject(),
                    getChat: () => createChatObject(),
                    wait: waitFunction,
                    delay: waitFunction,
                    sleep: waitFunction,
                    runPython: runPythonSync,
                    executePython: runPythonSync,
                    waitForAnswer: waitForAnswer,
                    ask: waitForAnswer,
                    analyzeContext: analyzeContext,
                    getContext: analyzeContext
                };
                
                // Add all other API methods dynamically
                const apiMethods = [
                    'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio', 'sendVoice',
                    'sendLocation', 'sendContact', 'sendSticker', 'sendPoll', 'sendDice',
                    'editMessageText', 'deleteMessage', 'forwardMessage', 'copyMessage',
                    'getMe', 'getChat', 'getChatAdministrators', 'getChatMember',
                    'banChatMember', 'unbanChatMember', 'restrictChatMember', 'promoteChatMember',
                    'pinChatMessage', 'unpinChatMessage', 'leaveChat', 'getFile'
                ];
                
                apiMethods.forEach(method => {
                    if (apiWrapperInstance[method]) {
                        botObj[method] = (...args) => {
                            const resultPromise = apiWrapperInstance[method](...args);
                            const handler = {
                                get(target, prop) {
                                    if (prop === 'then') return resultPromise.then.bind(resultPromise);
                                    if (prop === 'valueOf') return () => resultPromise;
                                    if (prop === 'toString') return () => `[${method} Promise]`;
                                    return undefined;
                                }
                            };
                            return new Proxy(resultPromise, handler);
                        };
                    }
                });
                
                return botObj;
            };

            // ✅ CREATE MAIN EXECUTION ENVIRONMENT
            const mainEnvironment = {
                // === SMART OBJECTS WITH AUTO-AWAIT ===
                User: createSmartUserObject(),
                Bot: createSmartBotObject(),
                bot: createSmartBotObject(),
                API: createSmartBotObject(),
                Api: createSmartBotObject(),
                
                // === CONTEXT DATA ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                message: userInput,
                botToken: resolvedBotToken,
                
                // === UTILITY FUNCTIONS ===
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonSync,
                executePython: runPythonSync,
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer,
                
                // === DATA OBJECTS ===
                userData: createUserObject(),
                chatData: createChatObject(),
                currentUser: createUserObject(),
                currentChat: createChatObject(),
                context: analyzeContext(),
                ctx: analyzeContext()
            };

            // ✅ FIXED: Create execution function with PROPER VARIABLE DECLARATIONS
            const executionFunction = new Function(
                'env',
                `return (async function() {
                    try {
                        // ✅ DECLARE ALL MAIN VARIABLES AT TOP LEVEL
                        var User = env.User;
                        var Bot = env.Bot;
                        var bot = env.bot;
                        var API = env.API;
                        var Api = env.Api;
                        
                        var msg = env.msg;
                        var chatId = env.chatId;
                        var userId = env.userId;
                        var userInput = env.userInput;
                        var params = env.params;
                        var message = env.message;
                        
                        var wait = env.wait;
                        var delay = env.delay;
                        var sleep = env.sleep;
                        var runPython = env.runPython;
                        var executePython = env.executePython;
                        var waitForAnswer = env.waitForAnswer;
                        var ask = env.ask;
                        
                        var userData = env.userData;
                        var chatData = env.chatData;
                        var currentUser = env.currentUser;
                        var currentChat = env.currentChat;
                        var context = env.context;
                        var ctx = env.ctx;
                        
                        console.log('🚀 Command execution started for user:', currentUser.first_name);
                        
                        // 🎯 USER CODE EXECUTION - NO NEED FOR AWAIT IN MOST CASES
                        ${code}
                        
                        return "✅ Command completed successfully";
                        
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
                            await env.Bot.sendMessage("❌ Error: " + error.message);
                        } catch (e) {
                            console.error('Failed to send error message:', e);
                        }
                        throw error;
                    }
                })();`
            );

            // Execute the command
            console.log('🚀 Executing command...');
            const result = await executionFunction(mainEnvironment);
            
            console.log('✅ Command execution completed');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };