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

            // ✅ FIXED: USER DATA FUNCTIONS
            const getUserData = async (key) => {
                return await apiWrapperInstance.User.getData(key);
            };

            const saveUserData = async (key, value) => {
                return await apiWrapperInstance.User.saveData(key, value);
            };

            const deleteUserData = async (key) => {
                return await apiWrapperInstance.User.deleteData(key);
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

            // ✅ DYNAMIC CASE INSENSITIVE PROXY HANDLER
            const createDynamicCaseInsensitiveObject = (targetObj) => {
                const caseInsensitiveCache = new Map();
                
                return new Proxy(targetObj, {
                    get: function(obj, prop) {
                        if (typeof prop !== 'string') return obj[prop];
                        
                        // Convert property to lowercase for case insensitive access
                        const lowerProp = prop.toLowerCase();
                        
                        // Check cache first
                        if (caseInsensitiveCache.has(lowerProp)) {
                            return caseInsensitiveCache.get(lowerProp);
                        }
                        
                        // Find the actual property (case insensitive)
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        );
                        
                        if (actualProp) {
                            const value = obj[actualProp];
                            caseInsensitiveCache.set(lowerProp, value);
                            return value;
                        }
                        
                        // If not found, return undefined
                        return undefined;
                    },
                    
                    set: function(obj, prop, value) {
                        if (typeof prop !== 'string') {
                            obj[prop] = value;
                            return true;
                        }
                        
                        const lowerProp = prop.toLowerCase();
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        ) || prop;
                        
                        obj[actualProp] = value;
                        caseInsensitiveCache.set(lowerProp, value);
                        return true;
                    },
                    
                    has: function(obj, prop) {
                        if (typeof prop !== 'string') return prop in obj;
                        
                        const lowerProp = prop.toLowerCase();
                        return Object.keys(obj).some(key => 
                            key.toLowerCase() === lowerProp
                        );
                    },
                    
                    ownKeys: function(obj) {
                        return Object.keys(obj);
                    },
                    
                    getOwnPropertyDescriptor: function(obj, prop) {
                        if (typeof prop !== 'string') return Object.getOwnPropertyDescriptor(obj, prop);
                        
                        const lowerProp = prop.toLowerCase();
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        );
                        
                        return actualProp ? Object.getOwnPropertyDescriptor(obj, actualProp) : undefined;
                    }
                });
            };

            // ✅ CREATE BOT OBJECT WITH ALL METHODS
            const createBotObject = () => {
                const botObj = {
                    // Copy all methods from apiWrapperInstance
                    ...apiWrapperInstance,
                    
                    // ✅ FIXED: METADATA METHODS - ORIGINAL RESPONSE ONLY
                    metadata: extractMetadata,
                    metaData: extractMetadata,
                    Metadata: extractMetadata,
                    METADATA: extractMetadata,
                    
                    // ✅ FIXED: USER DATA METHODS
                    User: {
                        getData: getUserData,
                        saveData: saveUserData,
                        deleteData: deleteUserData,
                        increment: async (key, amount = 1) => {
                            const current = await getUserData(key);
                            const newValue = (parseInt(current) || 0) + amount;
                            await saveUserData(key, newValue);
                            return newValue;
                        }
                    },
                    
                    // Context analysis
                    analyzeContext: analyzeContext,
                    getContext: analyzeContext,
                    
                    // Utility methods
                    wait: waitFunction,
                    delay: waitFunction,
                    sleep: waitFunction,
                    runPython: runPythonSync,
                    executePython: runPythonSync,
                    waitForAnswer: waitForAnswer,
                    ask: waitForAnswer
                };
                
                return createDynamicCaseInsensitiveObject(botObj);
            };

            // ✅ CREATE BOT INSTANCE
            const botObject = createBotObject();

            // ✅ CREATE BASE EXECUTION ENVIRONMENT
            const baseExecutionEnv = {
                // === CORE FUNCTIONS ===
                getUser: createUserObject,
                getChat: createChatObject,
                getCurrentUser: createUserObject,
                getCurrentChat: createChatObject,
                
                // === BOT INSTANCES - ALL VARIATIONS ===
                bot: botObject,
                Bot: botObject,
                api: botObject,
                Api: botObject,
                API: botObject,
                
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
                
                // === METADATA FUNCTIONS ===
                metadata: extractMetadata,
                metaData: extractMetadata,
                Metadata: extractMetadata,
                METADATA: extractMetadata,
                
                // === USER DATA FUNCTIONS ===
                User: {
                    getData: getUserData,
                    saveData: saveUserData,
                    deleteData: deleteUserData,
                    increment: async (key, amount = 1) => {
                        const current = await getUserData(key);
                        const newValue = (parseInt(current) || 0) + amount;
                        await saveUserData(key, newValue);
                        return newValue;
                    }
                },
                
                // === DATA STORAGE ===
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
                
                // === DATA OBJECTS ===
                userData: createUserObject(),
                chatData: createChatObject(),
                currentUser: createUserObject(),
                currentChat: createChatObject(),
                context: analyzeContext(),
                ctx: analyzeContext()
            };

            // ✅ ADD DIRECT MESSAGE FUNCTIONS
            const messageFunctions = {
                sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                send: (text, options) => botInstance.sendMessage(chatId, text, options),
                reply: (text, options) => botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                }),
                sendPhoto: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
                sendDocument: (doc, options) => botInstance.sendDocument(chatId, doc, options),
                sendVideo: (video, options) => botInstance.sendVideo(chatId, video, options),
                sendAudio: (audio, options) => botInstance.sendAudio(chatId, audio, options),
                sendVoice: (voice, options) => botInstance.sendVoice(chatId, voice, options),
                sendLocation: (latitude, longitude, options) => botInstance.sendLocation(chatId, latitude, longitude, options),
                sendContact: (phoneNumber, firstName, options) => botInstance.sendContact(chatId, phoneNumber, firstName, options)
            };

            // ✅ MERGE ALL FUNCTIONS
            const mergedEnvironment = {
                ...baseExecutionEnv,
                ...messageFunctions
            };

            // ✅ CREATE DYNAMIC CASE INSENSITIVE ENVIRONMENT
            const finalContext = createDynamicCaseInsensitiveObject(mergedEnvironment);

            // ✅ FIXED: Create ASYNC execution function with UNIQUE VARIABLE NAMES
            const executionFunction = new Function(
                'env',
                `return (async function() {
                    try {
                        // ✅ UNIQUE VARIABLE NAMES TO AVOID DUPLICATE DECLARATION ERRORS
                        var MainBot = env.bot;
                        var MainApi = env.api;
                        var MainUser = env.user;
                        
                        var getUserFunc = env.getuser;
                        var getCurrentUserFunc = env.getcurrentuser;
                        var userDataObj = env.userdata;
                        var currentUserObj = env.currentuser;
                        
                        var getChatFunc = env.getchat;
                        var getCurrentChatFunc = env.getcurrentchat;
                        var chatDataObj = env.chatdata;
                        var currentChatObj = env.currentchat;
                        
                        var sendMessageFunc = env.sendmessage;
                        var sendFunc = env.send;
                        var replyFunc = env.reply;
                        var sendPhotoFunc = env.sendphoto;
                        var sendDocumentFunc = env.senddocument;
                        
                        var paramsArray = env.params;
                        var messageText = env.message;
                        var UserData = env.user;
                        var BotDataStorage = env.botdata;
                        
                        var waitFunc = env.wait;
                        var delayFunc = env.delay;
                        var sleepFunc = env.sleep;
                        
                        var runPythonFunc = env.runpython;
                        var executePythonFunc = env.executepython;
                        var waitForAnswerFunc = env.waitforanswer;
                        var askFunc = env.ask;
                        
                        var metadataFunc = env.metadata;
                        var metaDataFunc = env.metadata;
                        var MetadataFunc = env.metadata;
                        var METADATAFunc = env.metadata;
                        
                        var analyzeContextFunc = env.analyzecontext;
                        var getContextFunc = env.getcontext;
                        var contextObj = env.context;
                        var ctxObj = env.ctx;
                        
                        console.log('✅ Execution started for user:', currentUserObj.first_name);
                        
                        // User's code starts here - NO VARIABLE DECLARATIONS NEEDED
                        ${code}
                        // User's code ends here
                        
                        return "Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
                            await env.sendMessage("❌ Error: " + error.message);
                        } catch (e) {
                            console.error('Failed to send error message:', e);
                        }
                        throw error;
                    }
                })();`
            );

            // Execute the command
            console.log('🚀 Executing command...');
            const result = await executionFunction(finalContext);
            
            console.log('✅ Command execution completed');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };