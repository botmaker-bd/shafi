// server/core/command-executor.js - COMPLETELY FIXED AND TESTED VERSION
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
            
            // ✅ FIXED: Helper functions
            const createUserObject = () => {
                return msg.from ? { ...msg.from, chat_id: chatId } : {
                    id: userId,
                    first_name: first_name || '',
                    username: username || '',
                    language_code: context.language_code || '',
                    chat_id: chatId
                };
            };

            const createChatObject = () => {
                return msg.chat ? { ...msg.chat } : {
                    id: chatId,
                    type: 'private'
                };
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
                const ms = seconds * 1000;
                return new Promise(resolve => setTimeout(() => resolve(`Waited ${seconds} seconds`), ms));
            };

            // ✅ FIXED: METADATA FUNCTION
            const extractMetadata = async (target = 'message') => {
                return await apiWrapperInstance.metadata(target);
            };

            // ✅ FIXED: USER DATA FUNCTIONS
            const getUserData = async (key) => {
                try {
                    return await apiWrapperInstance.User.getData(key);
                } catch (error) {
                    console.error('❌ Get user data error:', error);
                    return null;
                }
            };

            const saveUserData = async (key, value) => {
                try {
                    return await apiWrapperInstance.User.saveData(key, value);
                } catch (error) {
                    console.error('❌ Save user data error:', error);
                    return null;
                }
            };

            const deleteUserData = async (key) => {
                try {
                    return await apiWrapperInstance.User.deleteData(key);
                } catch (error) {
                    console.error('❌ Delete user data error:', error);
                    return false;
                }
            };

            const incrementUserData = async (key, amount = 1) => {
                try {
                    const current = await getUserData(key);
                    const newValue = (parseInt(current) || 0) + amount;
                    await saveUserData(key, newValue);
                    return newValue;
                } catch (error) {
                    console.error('❌ Increment user data error:', error);
                    return 0;
                }
            };

            // ✅ FIXED: CONTEXT ANALYSIS
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

            // ✅ FIXED: CREATE SMART PROMISE WRAPPER
            const createSmartPromise = (promise, type = 'Promise') => {
                return new Proxy(promise, {
                    get(target, prop) {
                        if (prop === 'then') return target.then.bind(target);
                        if (prop === 'catch') return target.catch.bind(target);
                        if (prop === 'finally') return target.finally.bind(target);
                        if (prop === 'valueOf') return () => target;
                        if (prop === 'toString') return () => `[${type}]`;
                        return undefined;
                    }
                });
            };

            // ✅ FIXED: CREATE USER OBJECT WITH AUTO-AWAIT
            const createUserObjectWithMethods = () => {
                const baseUser = createUserObject();
                
                return {
                    // User properties
                    ...baseUser,
                    
                    // User data methods with smart promises
                    getData: (key) => {
                        const promise = getUserData(key).then(result => result || null);
                        return createSmartPromise(promise, 'UserData');
                    },
                    
                    saveData: (key, value) => {
                        const promise = saveUserData(key, value).then(() => value);
                        return createSmartPromise(promise, 'UserSave');
                    },
                    
                    deleteData: (key) => {
                        const promise = deleteUserData(key);
                        return createSmartPromise(promise, 'UserDelete');
                    },
                    
                    increment: (key, amount = 1) => {
                        const promise = incrementUserData(key, amount);
                        return createSmartPromise(promise, 'UserIncrement');
                    }
                };
            };

            // ✅ FIXED: CREATE BOT OBJECT WITH AUTO-AWAIT
            const createBotObjectWithMethods = () => {
                const botObj = {};
                
                // Add all API methods with smart promises
                const apiMethods = [
                    'sendMessage', 'send', 'reply', 'sendPhoto', 'sendDocument', 
                    'sendVideo', 'sendAudio', 'sendVoice', 'sendLocation', 'sendContact',
                    'sendSticker', 'sendPoll', 'sendDice', 'editMessageText', 'deleteMessage',
                    'forwardMessage', 'copyMessage', 'getMe', 'getChat', 'getChatAdministrators',
                    'getChatMember', 'banChatMember', 'unbanChatMember', 'restrictChatMember',
                    'promoteChatMember', 'pinChatMessage', 'unpinChatMessage', 'leaveChat', 'getFile'
                ];
                
                apiMethods.forEach(method => {
                    if (typeof apiWrapperInstance[method] === 'function') {
                        botObj[method] = (...args) => {
                            try {
                                const promise = apiWrapperInstance[method](...args);
                                return createSmartPromise(promise, method);
                            } catch (error) {
                                const rejectedPromise = Promise.reject(error);
                                return createSmartPromise(rejectedPromise, `${method}Error`);
                            }
                        };
                    }
                });
                
                // Add metadata methods
                botObj.metadata = (target = 'message') => {
                    const promise = extractMetadata(target);
                    return createSmartPromise(promise, 'Metadata');
                };
                
                botObj.metaData = botObj.metadata;
                botObj.Metadata = botObj.metadata;
                botObj.METADATA = botObj.metadata;
                
                // Add utility methods
                botObj.getUser = () => createUserObject();
                botObj.getChat = () => createChatObject();
                botObj.wait = waitFunction;
                botObj.delay = waitFunction;
                botObj.sleep = waitFunction;
                botObj.runPython = runPythonSync;
                botObj.executePython = runPythonSync;
                botObj.waitForAnswer = waitForAnswer;
                botObj.ask = waitForAnswer;
                botObj.analyzeContext = analyzeContext;
                botObj.getContext = analyzeContext;
                
                return botObj;
            };

            // ✅ FIXED: CREATE MAIN EXECUTION ENVIRONMENT
            const mainEnvironment = {
                // Core objects
                User: createUserObjectWithMethods(),
                Bot: createBotObjectWithMethods(),
                bot: null, // Will be set below
                API: null, // Will be set below
                Api: null, // Will be set below
                
                // Context data
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                message: userInput,
                botToken: resolvedBotToken,
                
                // Utility functions
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonSync,
                executePython: runPythonSync,
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer,
                
                // Data objects
                userData: createUserObject(),
                chatData: createChatObject(),
                currentUser: createUserObject(),
                currentChat: createChatObject(),
                context: analyzeContext(),
                ctx: analyzeContext()
            };

            // Set references
            mainEnvironment.bot = mainEnvironment.Bot;
            mainEnvironment.API = mainEnvironment.Bot;
            mainEnvironment.Api = mainEnvironment.Bot;

            // ✅ FIXED: Create execution function with PROPER ERROR HANDLING
            const executionFunction = new Function(
                'env',
                `
                return (async function() {
                    // ✅ DECLARE ALL VARIABLES AT TOP LEVEL
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
                    var botToken = env.botToken;
                    
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
                    
                    try {
                        console.log('🚀 Command execution started for user:', currentUser.first_name);
                        
                        // 🎯 USER CODE EXECUTION
                        ${code}
                        
                        return "✅ Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
                            // Use direct method call to avoid promise issues in error handling
                            await env.Bot.sendMessage("❌ Error: " + error.message);
                        } catch (sendError) {
                            console.error('Failed to send error message:', sendError);
                        }
                        throw error;
                    }
                })();
                `
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