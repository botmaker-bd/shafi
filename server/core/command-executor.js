// server/core/command-executor.js - COMPLETELY FIXED
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

            // ✅ FIXED: USER DATA STORAGE - SYNC VERSION
            const userDataStorage = {
                data: {},
                
                set: function(key, value) {
                    this.data[key] = value;
                    console.log(`💾 User data saved: ${key} = ${value}`);
                    return value;
                },
                
                get: function(key) {
                    const value = this.data[key];
                    console.log(`📖 User data read: ${key} = ${value}`);
                    return value !== undefined ? value : null;
                },
                
                delete: function(key) {
                    delete this.data[key];
                    console.log(`🗑️ User data deleted: ${key}`);
                    return true;
                },
                
                getAll: function() {
                    return this.data;
                },
                
                clear: function() {
                    this.data = {};
                    console.log('🧹 All user data cleared');
                    return true;
                }
            };

            // ✅ CREATE CASE INSENSITIVE PROXY HANDLER
            const createCaseInsensitiveProxy = (target) => {
                return new Proxy(target, {
                    get: function(obj, prop) {
                        if (typeof prop !== 'string') return obj[prop];
                        
                        // Convert property to lowercase for case insensitive access
                        const lowerProp = prop.toLowerCase();
                        
                        // Find the actual property (case insensitive)
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        ) || prop;
                        
                        return obj[actualProp];
                    }
                });
            };

            // ✅ CREATE BOT OBJECT WITH ALL METHODS
            const createBotObject = () => {
                const botObj = {
                    // Copy all methods from apiWrapperInstance
                    ...apiWrapperInstance,
                    
                    // Utility methods
                    wait: waitFunction,
                    delay: waitFunction,
                    sleep: waitFunction,
                    runPython: runPythonSync,
                    executePython: runPythonSync,
                    waitForAnswer: waitForAnswer,
                    ask: waitForAnswer
                };
                
                return createCaseInsensitiveProxy(botObj);
            };

            // ✅ CREATE BASE EXECUTION ENVIRONMENT
            const baseExecutionEnv = {
                // === BOT INSTANCES ===
                bot: createBotObject(),
                Bot: createBotObject(),
                api: createBotObject(),
                Api: createBotObject(),
                API: createBotObject(),

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
                
                // === DATA STORAGE - FIXED SYNC VERSION ===
                User: {
                    saveData: function(key, value) {
                        return userDataStorage.set(key, value);
                    },
                    getData: function(key) {
                        return userDataStorage.get(key);
                    },
                    deleteData: function(key) {
                        return userDataStorage.delete(key);
                    },
                    getAllData: function() {
                        return userDataStorage.getAll();
                    },
                    clearData: function() {
                        return userDataStorage.clear();
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
                            return value;
                        } catch (error) {
                            console.error('❌ Save bot data error:', error);
                            return value;
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
                            return true;
                        } catch (error) {
                            console.error('❌ Delete bot data error:', error);
                            return false;
                        }
                    }
                },
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers,
                
                // === UTILITY FUNCTIONS ===
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonSync,
                executePython: runPythonSync,
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer
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
            const finalContext = createCaseInsensitiveProxy(mergedEnvironment);

            // ✅ FIXED: Create ASYNC execution function
            const executionFunction = new Function(
                'env',
                `return (async function() {
                    try {
                        // ✅ EXTRACT ALL VARIABLES FROM ENVIRONMENT
                        var Bot = env.bot;
                        var bot = env.bot;
                        var Api = env.api;
                        var api = env.api;
                        
                        var getUser = env.getuser;
                        var getCurrentUser = env.getcurrentuser;
                        var userData = env.userdata;
                        var currentUser = env.currentuser;
                        
                        var getChat = env.getchat;
                        var getCurrentChat = env.getcurrentchat;
                        var chatData = env.chatdata;
                        var currentChat = env.currentchat;
                        
                        var sendMessage = env.sendmessage;
                        var send = env.send;
                        var reply = env.reply;
                        
                        var params = env.params;
                        var message = env.message;
                        var User = env.user;
                        var BotData = env.botdata;
                        
                        var wait = env.wait;
                        var delay = env.delay;
                        var sleep = env.sleep;
                        
                        var runPython = env.runpython;
                        var executePython = env.executepython;
                        var waitForAnswer = env.waitforanswer;
                        var ask = env.ask;
                        
                        console.log('✅ Execution started for user:', currentUser.first_name);
                        
                        // User's code starts here
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