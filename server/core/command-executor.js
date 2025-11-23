// server/core/command-executor.js - COMPLETELY REWRITTEN AND FIXED
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        // ✅ Add execution timeout
        const executionTimeout = setTimeout(() => {
            reject(new Error('Command execution timeout (30 seconds)'));
        }, 30000);

        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            // ✅ Validate essential context
            if (!chatId || !userId) {
                throw new Error('Invalid context: missing chatId or userId');
            }

            // ✅ Resolve bot token with better validation
            let resolvedBotToken = botToken;
            if (!resolvedBotToken && context.command) {
                resolvedBotToken = context.command.bot_token;
            }
            if (!resolvedBotToken) {
                console.error('❌ Bot token undefined, using fallback');
                try {
                    const botInfo = await botInstance.getMe();
                    resolvedBotToken = botInfo.token || 'fallback_token';
                } catch (e) {
                    resolvedBotToken = 'fallback_token';
                }
            }
            
            console.log(`🔧 Executing command for user ${userId} in chat ${chatId}`);
            
            // ✅ Import dependencies with error handling
            let ApiWrapper, pythonRunner, supabase;
            try {
                ApiWrapper = require('./api-wrapper');
                pythonRunner = require('./python-runner');
                supabase = require('../config/supabase');
            } catch (importError) {
                throw new Error(`Module import failed: ${importError.message}`);
            }
            
            // ✅ Create ApiWrapper instance with validation
            const apiContext = {
                msg: msg || {},
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: context.last_name || '',
                language_code: context.language_code || '',
                botToken: resolvedBotToken,
                userInput: userInput || '',
                nextCommandHandlers: nextCommandHandlers || new Map()
            };
            
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // ✅ IMPROVED SMART PROMISE HANDLER WITH PROPER PROXY
            const createSmartHandler = (asyncFn, functionName = 'unknown') => {
                const handler = (...args) => {
                    try {
                        const promise = asyncFn(...args);
                        
                        // Create a proper proxy for the promise
                        const promiseProxy = new Proxy(promise, {
                            get(target, prop) {
                                // Handle promise methods
                                if (prop === 'then') return target.then.bind(target);
                                if (prop === 'catch') return target.catch.bind(target);
                                if (prop === 'finally') return target.finally.bind(target);
                                
                                // Handle primitive conversion
                                if (prop === Symbol.toPrimitive) {
                                    return function(hint) {
                                        if (hint === 'number') return NaN;
                                        if (hint === 'string') return `[Async:${functionName}]`;
                                        return `[Async:${functionName}]`;
                                    };
                                }
                                
                                if (prop === 'valueOf') return () => promiseProxy;
                                if (prop === 'toString') return () => `[Async:${functionName}]`;
                                if (prop === 'toJSON') return () => ({ type: 'AsyncValue', function: functionName });
                                
                                // For other properties, return undefined to avoid confusion
                                return undefined;
                            }
                        });
                        
                        return promiseProxy;
                    } catch (error) {
                        console.error(`❌ Handler execution error for ${functionName}:`, error);
                        return Promise.reject(error);
                    }
                };
                
                return handler;
            };

            // ✅ USER DATA METHODS WITH VALIDATION
            const userDataMethods = {
                getData: createSmartHandler(async (key) => {
                    // ✅ Input validation
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    
                    try {
                        const result = await apiWrapperInstance.User.getData(key);
                        return result !== null && result !== undefined ? result : null;
                    } catch (error) {
                        console.error('❌ Get user data error:', error);
                        return null;
                    }
                }, 'User.getData'),
                
                saveData: createSmartHandler(async (key, value) => {
                    // ✅ Input validation
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    if (value === undefined || value === null) {
                        throw new Error('Invalid value: cannot be null or undefined');
                    }
                    
                    try {
                        await apiWrapperInstance.User.saveData(key, value);
                        return value;
                    } catch (error) {
                        console.error('❌ Save user data error:', error);
                        return null;
                    }
                }, 'User.saveData'),
                
                deleteData: createSmartHandler(async (key) => {
                    // ✅ Input validation
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    
                    try {
                        await apiWrapperInstance.User.deleteData(key);
                        return true;
                    } catch (error) {
                        console.error('❌ Delete user data error:', error);
                        return false;
                    }
                }, 'User.deleteData'),
                
                increment: createSmartHandler(async (key, amount = 1) => {
                    // ✅ Input validation
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    if (typeof amount !== 'number' || isNaN(amount)) {
                        throw new Error('Invalid amount: must be a number');
                    }
                    
                    try {
                        const current = await apiWrapperInstance.User.getData(key);
                        const currentValue = parseInt(current) || 0;
                        const newValue = currentValue + amount;
                        await apiWrapperInstance.User.saveData(key, newValue);
                        return newValue;
                    } catch (error) {
                        console.error('❌ Increment user data error:', error);
                        return 0;
                    }
                }, 'User.increment')
            };
            
            // ✅ BOT DATA METHODS WITH PROPER ERROR HANDLING
            const botDataMethods = {
                getData: createSmartHandler(async (key) => {
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    
                    try {
                        const { data, error } = await supabase.from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key)
                            .single();
                            
                        if (error) {
                            // Handle different Supabase error codes
                            if (error.code === 'PGRST116') return null; // Not found
                            if (error.code === '42P01') throw new Error('Database table not found'); // Table doesn't exist
                            throw error;
                        }
                        
                        if (!data || !data.data_value) return null;
                        
                        try {
                            return JSON.parse(data.data_value);
                        } catch (parseError) {
                            console.error('❌ JSON parse error for bot data:', parseError);
                            return data.data_value; // Return as string if parse fails
                        }
                    } catch (error) {
                        console.error('❌ Get bot data error:', error);
                        return null;
                    }
                }, 'BotData.getData'),
                
                saveData: createSmartHandler(async (key, value) => {
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    if (value === undefined || value === null) {
                        throw new Error('Invalid value: cannot be null or undefined');
                    }
                    
                    try {
                        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        
                        const { error } = await supabase.from('universal_data').upsert({
                            data_type: 'bot_data',
                            bot_token: resolvedBotToken,
                            data_key: key,
                            data_value: serializedValue,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'data_type,bot_token,data_key'
                        });
                        
                        if (error) {
                            if (error.code === '42P01') throw new Error('Database table not found');
                            throw error;
                        }
                        
                        return value;
                    } catch (error) {
                        console.error('❌ Save bot data error:', error);
                        return null;
                    }
                }, 'BotData.saveData'),
                
                deleteData: createSmartHandler(async (key) => {
                    if (typeof key !== 'string' || key.trim() === '') {
                        throw new Error('Invalid key: must be non-empty string');
                    }
                    
                    try {
                        const { error } = await supabase.from('universal_data')
                            .delete()
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key);
                            
                        if (error) {
                            if (error.code === '42P01') return true; // Table doesn't exist, consider deleted
                            throw error;
                        }
                        
                        return true;
                    } catch (error) {
                        console.error('❌ Delete bot data error:', error);
                        return false;
                    }
                }, 'BotData.deleteData')
            };
            
            // ✅ COMPLETE TELEGRAM BOT METHODS
            const createBotMethod = (methodName) => {
                return createSmartHandler(async (...args) => {
                    if (!apiWrapperInstance[methodName]) {
                        throw new Error(`Telegram API method '${methodName}' not available`);
                    }
                    
                    try {
                        return await apiWrapperInstance[methodName](...args);
                    } catch (error) {
                        console.error(`❌ Telegram API ${methodName} error:`, error);
                        throw new Error(`Telegram API Error (${methodName}): ${error.message}`);
                    }
                }, `Bot.${methodName}`);
            };
            
            // ✅ COMPLETE LIST OF TELEGRAM METHODS
            const telegramMethods = [
                // Core message methods
                'sendMessage', 'forwardMessage', 'copyMessage', 
                'sendPhoto', 'sendAudio', 'sendDocument', 'sendVideo', 
                'sendAnimation', 'sendVoice', 'sendVideoNote', 'sendMediaGroup',
                'sendLocation', 'sendVenue', 'sendContact', 'sendPoll', 
                'sendDice', 'sendChatAction', 'sendSticker',
                
                // Message management
                'editMessageText', 'editMessageCaption', 'editMessageMedia',
                'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',
                'deleteMessage', 'deleteMessages',
                
                // Chat management
                'getChat', 'getChatAdministrators', 'getChatMemberCount',
                'getChatMember', 'setChatTitle', 'setChatDescription',
                'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
                'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
                'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
                'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
                'restrictChatMember', 'promoteChatMember', 'banChatSenderChat', 
                'unbanChatSenderChat', 'setChatStickerSet', 'deleteChatStickerSet',
                'getChatMenuButton', 'setChatMenuButton', 'leaveChat', 
                'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages',
                
                // Sticker management
                'getStickerSet', 'getCustomEmojiStickers', 'uploadStickerFile',
                'createNewStickerSet', 'addStickerToSet', 'setStickerPositionInSet',
                'deleteStickerFromSet', 'setStickerSetThumbnail',
                
                // Forum management
                'createForumTopic', 'editForumTopic', 'closeForumTopic',
                'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
                'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
                'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',
                
                // Inline and callback
                'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
                'answerPreCheckoutQuery', 'answerShippingQuery',
                
                // Payments
                'sendInvoice', 'createInvoiceLink', 'refundStarPayment',
                
                // Bot management
                'getMe', 'logOut', 'close', 'getMyCommands', 'setMyCommands',
                'deleteMyCommands', 'getMyDescription', 'setMyDescription',
                'getMyShortDescription', 'setMyShortDescription', 'getMyName',
                'setMyName', 'getMyDefaultAdministratorRights', 'setMyDefaultAdministratorRights',
                
                // Games
                'sendGame', 'setGameScore', 'getGameHighScores',
                
                // Files
                'getFile', 'downloadFile'
            ];
            
            const botMethods = {};
            telegramMethods.forEach(method => {
                botMethods[method] = createBotMethod(method);
            });
            
            // ✅ ADD CONVENIENCE METHODS
            botMethods.send = botMethods.sendMessage;
            botMethods.reply = createSmartHandler(async (text, options = {}) => {
                return await apiWrapperInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                });
            }, 'Bot.reply');
            
            // ✅ METADATA METHODS
            const createMetadataHandler = createSmartHandler(async (target = 'message') => {
                if (typeof target !== 'string') {
                    throw new Error('Metadata target must be a string');
                }
                
                try {
                    return await apiWrapperInstance.metadata(target);
                } catch (error) {
                    console.error('❌ Metadata error:', error);
                    return { error: error.message, target: target };
                }
            }, 'metadata');
            
            botMethods.metadata = createMetadataHandler;
            botMethods.metaData = createMetadataHandler;
            botMethods.Metadata = createMetadataHandler;
            botMethods.METADATA = createMetadataHandler;
            
            // ✅ UTILITY FUNCTIONS
            const waitFunction = createSmartHandler(async (seconds) => {
                if (typeof seconds !== 'number' || seconds < 0) {
                    throw new Error('Wait time must be a positive number');
                }
                const ms = seconds * 1000;
                return new Promise(resolve => setTimeout(() => resolve(`Waited ${seconds} seconds`), ms));
            }, 'wait');
            
            const runPythonFunc = createSmartHandler(async (code) => {
                if (typeof code !== 'string' || code.trim() === '') {
                    throw new Error('Python code must be non-empty string');
                }
                try {
                    return await pythonRunner.runPythonCode(code);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            }, 'runPython');
            
            const waitForAnswerFunc = createSmartHandler(async (question, options = {}) => {
                if (typeof question !== 'string' || question.trim() === '') {
                    throw new Error('Question must be non-empty string');
                }
                
                return new Promise((resolve, reject) => {
                    try {
                        const waitKey = `${resolvedBotToken}_${userId}`;
                        
                        // Clear any existing handler
                        if (nextCommandHandlers && nextCommandHandlers.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                        }
                        
                        botInstance.sendMessage(chatId, question, options)
                            .then(() => {
                                if (nextCommandHandlers) {
                                    const handler = {
                                        resolve: resolve,
                                        reject: reject,
                                        timestamp: Date.now(),
                                        question: question
                                    };
                                    
                                    nextCommandHandlers.set(waitKey, handler);
                                    
                                    // Auto cleanup after 5 minutes
                                    setTimeout(() => {
                                        if (nextCommandHandlers.has(waitKey)) {
                                            nextCommandHandlers.delete(waitKey);
                                            reject(new Error('Wait for answer timeout (5 minutes)'));
                                        }
                                    }, 5 * 60 * 1000);
                                } else {
                                    reject(new Error('Next command handlers not available'));
                                }
                            })
                            .catch(sendError => {
                                reject(new Error('Failed to send question: ' + sendError.message));
                            });
                    } catch (error) {
                        reject(new Error('WaitForAnswer setup failed: ' + error.message));
                    }
                });
            }, 'waitForAnswer');
            
            // ✅ CONTEXT OBJECTS WITH PROPER DATA
            const userObject = {
                id: userId,
                first_name: first_name || '',
                username: username || '',
                language_code: context.language_code || '',
                chat_id: chatId,
                // Add message from data without overwriting
                ...(msg.from && typeof msg.from === 'object' ? msg.from : {})
            };
            
            const chatObject = {
                id: chatId,
                type: msg.chat?.type || 'private',
                title: msg.chat?.title || '',
                username: msg.chat?.username || '',
                ...(msg.chat && typeof msg.chat === 'object' ? msg.chat : {})
            };
            
            const contextObject = {
                user: userObject,
                chat: chatObject,
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
            
            // ✅ CREATE MAIN OBJECTS
            const User = {
                ...userObject,
                ...userDataMethods
            };
            
            const Bot = {
                ...botMethods,
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonFunc,
                executePython: runPythonFunc,
                waitForAnswer: waitForAnswerFunc,
                ask: waitForAnswerFunc,
                getUser: () => userObject,
                getChat: () => chatObject,
                analyzeContext: () => contextObject,
                getContext: () => contextObject
            };
            
            const BotData = { ...botDataMethods };
            
            // ✅ DIRECT MESSAGE FUNCTIONS
            const sendMessageFunc = createSmartHandler(async (text, options = {}) => {
                if (typeof text !== 'string' || text.trim() === '') {
                    throw new Error('Message text must be non-empty string');
                }
                return await botInstance.sendMessage(chatId, text, options);
            }, 'sendMessage');
            
            const sendFunc = sendMessageFunc;
            
            const replyFunc = createSmartHandler(async (text, options = {}) => {
                if (typeof text !== 'string' || text.trim() === '') {
                    throw new Error('Reply text must be non-empty string');
                }
                return await botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                });
            }, 'reply');
            
            // ✅ CREATE ENVIRONMENT WITHOUT GLOBAL POLLUTION
            const environment = {
                // Core objects
                User,
                Bot,
                bot: Bot,
                API: Bot,
                Api: Bot,
                BotData,
                
                // Context data
                msg,
                chatId,
                userId,
                userInput,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                message: userInput,
                botToken: resolvedBotToken,
                
                // Utility functions
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonFunc,
                executePython: runPythonFunc,
                waitForAnswer: waitForAnswerFunc,
                ask: waitForAnswerFunc,
                
                // Metadata functions
                metadata: createMetadataHandler,
                metaData: createMetadataHandler,
                Metadata: createMetadataHandler,
                METADATA: createMetadataHandler,
                
                // Data objects
                userData: userObject,
                chatData: chatObject,
                currentUser: userObject,
                currentChat: chatObject,
                context: contextObject,
                ctx: contextObject,
                
                // Direct message functions
                sendMessage: sendMessageFunc,
                send: sendFunc,
                reply: replyFunc
            };
            
            // ✅ IMPROVED CASE INSENSITIVE ENVIRONMENT
            const createCaseInsensitiveEnv = (env) => {
                const caseInsensitiveEnv = { ...env };
                
                // Add lowercase versions without removing originals
                Object.keys(env).forEach(key => {
                    if (typeof key === 'string') {
                        const lowerKey = key.toLowerCase();
                        if (!caseInsensitiveEnv.hasOwnProperty(lowerKey)) {
                            caseInsensitiveEnv[lowerKey] = env[key];
                        }
                    }
                });
                
                return new Proxy(caseInsensitiveEnv, {
                    get(target, prop) {
                        if (typeof prop !== 'string') return target[prop];
                        
                        // First try exact match
                        if (target.hasOwnProperty(prop)) {
                            return target[prop];
                        }
                        
                        // Then try case insensitive
                        const lowerProp = prop.toLowerCase();
                        if (target.hasOwnProperty(lowerProp)) {
                            return target[lowerProp];
                        }
                        
                        return undefined;
                    },
                    
                    set(target, prop, value) {
                        if (typeof prop !== 'string') {
                            target[prop] = value;
                            return true;
                        }
                        
                        target[prop] = value;
                        
                        // Also set lowercase version
                        const lowerProp = prop.toLowerCase();
                        if (!target.hasOwnProperty(lowerProp)) {
                            target[lowerProp] = value;
                        }
                        
                        return true;
                    },
                    
                    has(target, prop) {
                        if (typeof prop !== 'string') return prop in target;
                        return target.hasOwnProperty(prop) || target.hasOwnProperty(prop.toLowerCase());
                    }
                });
            };
            
            const caseInsensitiveEnv = createCaseInsensitiveEnv(environment);
            
            // ✅ SAFE EXECUTION FUNCTION WITHOUT GLOBAL POLLUTION
            const executionFunction = new Function(
                'env',
                `
                return (async function() {
                    // ✅ SAFELY EXTRACT VARIABLES WITHOUT GLOBAL POLLUTION
                    const {
                        User, Bot, bot, API, Api, BotData,
                        msg, chatId, userId, userInput, params, message, botToken,
                        wait, delay, sleep, runPython, executePython, waitForAnswer, ask,
                        metadata, metaData, Metadata, METADATA,
                        userData, chatData, currentUser, currentChat, context, ctx,
                        sendMessage, send, reply
                    } = env;
                    
                    try {
                        console.log('🚀 Command execution started for user:', currentUser.first_name);
                        
                        // 🎯 USER CODE EXECUTION
                        ${code}
                        
                        return "✅ Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
                            // Use Bot directly from env to avoid scope issues
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
            console.log('🚀 Executing user code...');
            const result = await executionFunction(caseInsensitiveEnv);
            
            clearTimeout(executionTimeout);
            console.log('✅ Command execution completed successfully');
            resolve(result);

        } catch (error) {
            clearTimeout(executionTimeout);
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };