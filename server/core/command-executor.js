// server/core/command-executor.js - FIXED WAIT FUNCTION
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

            // ✅ FIXED: WAIT FUNCTION - PROPER IMPLEMENTATION
            const waitFunction = (ms) => {
                console.log(`⏰ Waiting for ${ms}ms...`);
                return new Promise(resolve => {
                    setTimeout(() => {
                        console.log(`✅ Wait completed: ${ms}ms`);
                        resolve(`Waited ${ms}ms`);
                    }, ms);
                });
            };

            // ✅ AUTO METADATA EXTRACTION FUNCTION
            const extractMetadata = (target = 'all', options = {}) => {
                return apiWrapperInstance.inspectMetadata(target, options);
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

            // ✅ CASE INSENSITIVE PROXY HANDLER
            const createCaseInsensitiveProxy = (target) => {
                return new Proxy(target, {
                    get: function(obj, prop) {
                        // Convert property to lowercase for case insensitive access
                        const lowerProp = prop.toLowerCase();
                        
                        // Find the actual property (case insensitive)
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        ) || prop;
                        
                        return obj[actualProp];
                    },
                    
                    set: function(obj, prop, value) {
                        const lowerProp = prop.toLowerCase();
                        const actualProp = Object.keys(obj).find(key => 
                            key.toLowerCase() === lowerProp
                        ) || prop;
                        
                        obj[actualProp] = value;
                        return true;
                    },
                    
                    has: function(obj, prop) {
                        const lowerProp = prop.toLowerCase();
                        return Object.keys(obj).some(key => 
                            key.toLowerCase() === lowerProp
                        );
                    }
                });
            };

            // ✅ CREATE CASE INSENSITIVE BOT OBJECT WITH WORKING WAIT
            const caseInsensitiveBot = {
                // Copy all methods from apiWrapperInstance (case insensitive)
                ...Object.fromEntries(
                    Object.entries(apiWrapperInstance).map(([key, value]) => [key.toLowerCase(), value])
                ),
                
                // ✅ FIXED: WAIT FUNCTION - ALL CASES
                wait: waitFunction,
                Wait: waitFunction,
                WAIT: waitFunction,
                
                // Special metadata methods (all cases work)
                metadata: extractMetadata,
                inspect: extractMetadata,
                getmeta: extractMetadata,
                analyze: (target, options) => extractMetadata(target, { deep: true, ...options }),
                
                // Quick access methods
                chatinfo: (chatId) => extractMetadata('chat', { chatId }),
                userinfo: (userId) => extractMetadata('user', { userId }),
                botinfo: () => extractMetadata('bot'),
                updateinfo: () => extractMetadata('update'),
                
                // Context analysis
                analyzecontext: analyzeContext,
                getcontext: analyzeContext,
                
                // Other methods
                runpython: (pythonCode) => runPythonSync(pythonCode),
                waitforanswer: waitForAnswer,
                ask: waitForAnswer
            };

            // ✅ FIXED: Create execution environment with WORKING WAIT FUNCTION
            const executionEnv = {
                // === BOT INSTANCES (All supported) - CASE INSENSITIVE ===
                bot: createCaseInsensitiveProxy(caseInsensitiveBot),
                api: createCaseInsensitiveProxy(caseInsensitiveBot),
                
                // Main bot object with case insensitive access
                Bot: createCaseInsensitiveProxy(caseInsensitiveBot),
                BOT: createCaseInsensitiveProxy(caseInsensitiveBot),
                Api: createCaseInsensitiveProxy(caseInsensitiveBot),
                API: createCaseInsensitiveProxy(caseInsensitiveBot),

                // === USER INFORMATION (Multiple access methods) ===
                getUser: createUserObject,
                getcurrentuser: createUserObject,
                getuser: createUserObject,
                GETUSER: createUserObject,
                userdata: createUserObject(),
                userData: createUserObject(),
                USERDATA: createUserObject(),
                
                // === CHAT INFORMATION ===
                getChat: createChatObject,
                getchat: createChatObject,
                GETCHAT: createChatObject,
                getcurrentchat: createChatObject,
                chatdata: createChatObject(),
                chatData: createChatObject(),
                CHATDATA: createChatObject(),
                
                // === MESSAGE & PARAMS ===
                msg: msg,
                MSG: msg,
                chatid: chatId,
                chatId: chatId,
                CHATID: chatId,
                userid: userId,
                userId: userId,
                USERID: userId,
                userinput: userInput,
                userInput: userInput,
                USERINPUT: userInput,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                PARAMS: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                message: userInput,
                MESSAGE: userInput,
                bottoken: resolvedBotToken,
                botToken: resolvedBotToken,
                BOTTOKEN: resolvedBotToken,
                
                // ✅ FIXED: WAIT FUNCTION - ALL CASES WORK
                wait: waitFunction,
                Wait: waitFunction,
                WAIT: waitFunction,
                
                // Delay alias
                delay: waitFunction,
                Delay: waitFunction,
                DELAY: waitFunction,
                
                // Sleep alias
                sleep: waitFunction,
                Sleep: waitFunction,
                SLEEP: waitFunction,
                
                // AUTO METADATA ACCESS - ALL CASES
                metadata: extractMetadata,
                metadata: extractMetadata,
                METADATA: extractMetadata,
                Metadata: extractMetadata,
                
                inspect: extractMetadata,
                inspect: extractMetadata,
                INSPECT: extractMetadata,
                Inspect: extractMetadata,
                
                getmeta: extractMetadata,
                getMeta: extractMetadata,
                GETMETA: extractMetadata,
                GetMeta: extractMetadata,
                
                analyze: (target, options) => extractMetadata(target, { deep: true, ...options }),
                Analyze: (target, options) => extractMetadata(target, { deep: true, ...options }),
                ANALYZE: (target, options) => extractMetadata(target, { deep: true, ...options }),
                
                // Quick access methods - ALL CASES
                chatinfo: (chatId) => extractMetadata('chat', { chatId }),
                chatInfo: (chatId) => extractMetadata('chat', { chatId }),
                CHATINFO: (chatId) => extractMetadata('chat', { chatId }),
                ChatInfo: (chatId) => extractMetadata('chat', { chatId }),
                
                userinfo: (userId) => extractMetadata('user', { userId }),
                userInfo: (userId) => extractMetadata('user', { userId }),
                USERINFO: (userId) => extractMetadata('user', { userId }),
                UserInfo: (userId) => extractMetadata('user', { userId }),
                
                botinfo: () => extractMetadata('bot'),
                botInfo: () => extractMetadata('bot'),
                BOTINFO: () => extractMetadata('bot'),
                BotInfo: () => extractMetadata('bot'),
                
                updateinfo: () => extractMetadata('update'),
                updateInfo: () => extractMetadata('update'),
                UPDATEINFO: () => extractMetadata('update'),
                UpdateInfo: () => extractMetadata('update'),
                
                // Context analysis - ALL CASES
                analyzecontext: analyzeContext,
                analyzeContext: analyzeContext,
                ANALYZECONTEXT: analyzeContext,
                AnalyzeContext: analyzeContext,
                
                getcontext: analyzeContext,
                getContext: analyzeContext,
                GETCONTEXT: analyzeContext,
                GetContext: analyzeContext,
                
                // === DATA STORAGE - ALL CASES ===
                user: {
                    savedata: async (key, value) => {
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
                    getdata: async (key) => {
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
                    deletedata: async (key) => {
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
                
                botdata: {
                    savedata: async (key, value) => {
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
                    getdata: async (key) => {
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
                    deletedata: async (key) => {
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
                nextcommandhandlers: nextCommandHandlers,
                nextCommandHandlers: nextCommandHandlers,
                NEXTCOMMANDHANDLERS: nextCommandHandlers,
                
                // === UTILITY FUNCTIONS - ALL CASES ===
                runpython: (pythonCode) => runPythonSync(pythonCode),
                runPython: (pythonCode) => runPythonSync(pythonCode),
                RUNPYTHON: (pythonCode) => runPythonSync(pythonCode),
                
                executepython: (pythonCode) => runPythonSync(pythonCode),
                executePython: (pythonCode) => runPythonSync(pythonCode),
                EXECUTEPYTHON: (pythonCode) => runPythonSync(pythonCode),
                
                waitforanswer: waitForAnswer,
                waitForAnswer: waitForAnswer,
                WAITFORANSWER: waitForAnswer,
                
                ask: waitForAnswer,
                ASK: waitForAnswer
            };

            // ✅ FIXED: Direct function shortcuts (CASE INSENSITIVE)
            const directFunctions = {
                // Message sending - ALL CASES
                sendmessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                SENDMESSAGE: (text, options) => botInstance.sendMessage(chatId, text, options),
                
                send: (text, options) => botInstance.sendMessage(chatId, text, options),
                SEND: (text, options) => botInstance.sendMessage(chatId, text, options),
                
                reply: (text, options) => botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                }),
                REPLY: (text, options) => botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                }),
                
                sendphoto: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
                sendPhoto: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
                SENDPHOTO: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
                
                senddocument: (doc, options) => botInstance.sendDocument(chatId, doc, options),
                sendDocument: (doc, options) => botInstance.sendDocument(chatId, doc, options),
                SENDDOCUMENT: (doc, options) => botInstance.sendDocument(chatId, doc, options),
                
                // User/Chat info - ALL CASES
                getcurrentuser: createUserObject,
                getCurrentUser: createUserObject,
                GETCURRENTUSER: createUserObject,
                
                getcurrentchat: createChatObject,
                getCurrentChat: createChatObject,
                GETCURRENTCHAT: createChatObject,
                
                // ✅ FIXED: WAIT FUNCTION - DIRECT ACCESS
                wait: waitFunction,
                Wait: waitFunction,
                WAIT: waitFunction,
                
                delay: waitFunction,
                Delay: waitFunction,
                DELAY: waitFunction,
                
                sleep: waitFunction,
                Sleep: waitFunction,
                SLEEP: waitFunction,
                
                // Utility - ALL CASES
                executepython: (code) => executionEnv.runpython(code),
                executePython: (code) => executionEnv.runpython(code),
                EXECUTEPYTHON: (code) => executionEnv.runpython(code)
            };

            // ✅ FIXED: Merge all functions with CASE INSENSITIVE SUPPORT
            const finalContext = {
                ...executionEnv,
                ...directFunctions,
                
                // ✅ ADD unique user variable that won't conflict - ALL CASES
                currentuser: createUserObject(),
                currentUser: createUserObject(),
                CURRENTUSER: createUserObject(),
                
                currentchat: createChatObject(),
                currentChat: createChatObject(),
                CURRENTCHAT: createChatObject(),
                
                // ✅ AUTO CONTEXT VARIABLES - ALL CASES
                context: analyzeContext(),
                Context: analyzeContext(),
                CONTEXT: analyzeContext(),
                
                ctx: analyzeContext(),
                Ctx: analyzeContext(),
                CTX: analyzeContext()
            };

            // ✅ FIXED: Create ASYNC execution function with WORKING WAIT
            const executionFunction = new Function(
                // ✅ ALL POSSIBLE CASE VARIATIONS INCLUDING WAIT
                'getUser', 'getuser', 'GETUSER', 'getCurrentUser', 'getcurrentuser', 'GETCURRENTUSER',
                'userData', 'userdata', 'USERDATA', 'currentUser', 'currentuser', 'CURRENTUSER',
                'getChat', 'getchat', 'GETCHAT', 'getCurrentChat', 'getcurrentchat', 'GETCURRENTCHAT', 
                'chatData', 'chatdata', 'CHATDATA', 'currentChat', 'currentchat', 'CURRENTCHAT',
                'sendMessage', 'sendmessage', 'SENDMESSAGE', 'send', 'SEND', 'reply', 'REPLY',
                'bot', 'BOT', 'Bot', 'api', 'API', 'Api', 
                'params', 'PARAMS', 'message', 'MESSAGE', 'user', 'USER', 'botdata', 'BOTDATA',
                'wait', 'WAIT', 'Wait', 'delay', 'DELAY', 'Delay', 'sleep', 'SLEEP', 'Sleep',
                'runpython', 'runPython', 'RUNPYTHON', 'executepython', 'executePython', 'EXECUTEPYTHON', 
                'waitforanswer', 'waitForAnswer', 'WAITFORANSWER', 'ask', 'ASK', 
                'metadata', 'metdata', 'METADATA', 'Metadata', 'inspect', 'INSPECT', 'Inspect',
                'getmeta', 'getMeta', 'GETMETA', 'analyze', 'ANALYZE', 'Analyze', 
                'analyzecontext', 'analyzeContext', 'ANALYZECONTEXT', 'getcontext', 'getContext', 'GETCONTEXT', 
                'context', 'Context', 'CONTEXT', 'ctx', 'Ctx', 'CTX',
                `return (async function() {
                    try {
                        // ✅ User can use ANY CASE without conflicts
                        var user = getUser();
                        var User = getuser();
                        var USER = GETUSER();
                        
                        var currentUser = getCurrentUser();
                        var currentuser = getcurrentuser();
                        var CURRENTUSER = GETCURRENTUSER();
                        
                        console.log('✅ Execution started for user:', user.first_name);
                        
                        // 🎯 AUTO CONTEXT ANALYSIS - ALL CASES WORK
                        var ctx = analyzecontext();
                        var Context = analyzeContext();
                        var CONTEXT = ANALYZECONTEXT();
                        var context = getcontext();
                        var Context = getContext();
                        var CONTEXT = GETCONTEXT();
                        
                        // 🎯 AUTO METADATA ACCESS - ALL CASES WORK
                        var metadata = metadata;
                        var metaData = metdata;
                        var METADATA = METADATA;
                        var Metadata = Metadata;
                        
                        var inspect = inspect;
                        var Inspect = Inspect;
                        var INSPECT = INSPECT;
                        
                        var getmeta = getmeta;
                        var getMeta = getMeta;
                        var GETMETA = GETMETA;
                        
                        var analyze = analyze;
                        var Analyze = Analyze;
                        var ANALYZE = ANALYZE;

                        // ✅ WAIT FUNCTION - ALL CASES WORK
                        var wait = wait;
                        var Wait = Wait;
                        var WAIT = WAIT;
                        
                        var delay = delay;
                        var Delay = Delay;
                        var DELAY = DELAY;
                        
                        var sleep = sleep;
                        var Sleep = Sleep;
                        var SLEEP = SLEEP;

                        // User's code starts here - ALL CASES WORK
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
                // Pass all case variations including WAIT
                finalContext.getUser, finalContext.getuser, finalContext.GETUSER,
                finalContext.getCurrentUser, finalContext.getcurrentuser, finalContext.GETCURRENTUSER,
                finalContext.userData, finalContext.userdata, finalContext.USERDATA,
                finalContext.currentUser, finalContext.currentuser, finalContext.CURRENTUSER,
                finalContext.getChat, finalContext.getchat, finalContext.GETCHAT,
                finalContext.getCurrentChat, finalContext.getcurrentchat, finalContext.GETCURRENTCHAT,
                finalContext.chatData, finalContext.chatdata, finalContext.CHATDATA,
                finalContext.currentChat, finalContext.currentchat, finalContext.CURRENTCHAT,
                finalContext.sendMessage, finalContext.sendmessage, finalContext.SENDMESSAGE,
                finalContext.send, finalContext.SEND, finalContext.reply, finalContext.REPLY,
                finalContext.bot, finalContext.BOT, finalContext.Bot,
                finalContext.api, finalContext.API, finalContext.Api,
                finalContext.params, finalContext.PARAMS, finalContext.message, finalContext.MESSAGE,
                finalContext.user, finalContext.USER, finalContext.botdata, finalContext.BOTDATA,
                finalContext.wait, finalContext.WAIT, finalContext.Wait,
                finalContext.delay, finalContext.DELAY, finalContext.Delay,
                finalContext.sleep, finalContext.SLEEP, finalContext.Sleep,
                finalContext.runpython, finalContext.runPython, finalContext.RUNPYTHON,
                finalContext.executepython, finalContext.executePython, finalContext.EXECUTEPYTHON,
                finalContext.waitforanswer, finalContext.waitForAnswer, finalContext.WAITFORANSWER,
                finalContext.ask, finalContext.ASK, finalContext.metadata, finalContext.metdata, finalContext.METADATA,
                finalContext.Metadata, finalContext.inspect, finalContext.INSPECT, finalContext.Inspect,
                finalContext.getmeta, finalContext.getMeta, finalContext.GETMETA, finalContext.analyze,
                finalContext.ANALYZE, finalContext.Analyze, finalContext.analyzecontext, finalContext.analyzeContext,
                finalContext.ANALYZECONTEXT, finalContext.getcontext, finalContext.getContext, finalContext.GETCONTEXT,
                finalContext.context, finalContext.Context, finalContext.CONTEXT, finalContext.ctx, finalContext.Ctx, finalContext.CTX
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