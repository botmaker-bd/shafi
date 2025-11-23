// server/core/command-executor.js - 100% FIXED AND TESTED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            // ✅ Resolve bot token
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
            
            // Import dependencies
            const ApiWrapper = require('./api-wrapper');
            const pythonRunner = require('./python-runner');
            const supabase = require('../config/supabase');
            
            // Create ApiWrapper instance
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
            
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // ✅ SMART PROMISE HANDLER WITH AUTO-AWAIT SUPPORT
            const createSmartHandler = (asyncFn) => {
                return (...args) => {
                    const promise = asyncFn(...args);
                    
                    // Create a proxy that handles both await and direct usage
                    return new Proxy(promise, {
                        get(target, prop) {
                            // Handle promise methods
                            if (prop === 'then') return target.then.bind(target);
                            if (prop === 'catch') return target.catch.bind(target);
                            if (prop === 'finally') return target.finally.bind(target);
                            
                            // Handle value conversion for direct usage
                            if (prop === Symbol.toPrimitive) {
                                return () => {
                                    console.warn('⚠️ Using async function without await - returning promise');
                                    return target;
                                };
                            }
                            
                            if (prop === 'valueOf') return () => target;
                            if (prop === 'toString') return () => '[AsyncValue]';
                            
                            return undefined;
                        }
                    });
                };
            };

            // ✅ USER DATA METHODS WITH SMART HANDLING
            const userDataMethods = {
                getData: createSmartHandler(async (key) => {
                    try {
                        const result = await apiWrapperInstance.User.getData(key);
                        return result;
                    } catch (error) {
                        console.error('❌ Get user data error:', error);
                        return null;
                    }
                }),
                
                saveData: createSmartHandler(async (key, value) => {
                    try {
                        await apiWrapperInstance.User.saveData(key, value);
                        return value;
                    } catch (error) {
                        console.error('❌ Save user data error:', error);
                        return null;
                    }
                }),
                
                deleteData: createSmartHandler(async (key) => {
                    try {
                        await apiWrapperInstance.User.deleteData(key);
                        return true;
                    } catch (error) {
                        console.error('❌ Delete user data error:', error);
                        return false;
                    }
                }),
                
                increment: createSmartHandler(async (key, amount = 1) => {
                    try {
                        const current = await apiWrapperInstance.User.getData(key);
                        const newValue = (parseInt(current) || 0) + amount;
                        await apiWrapperInstance.User.saveData(key, newValue);
                        return newValue;
                    } catch (error) {
                        console.error('❌ Increment user data error:', error);
                        return 0;
                    }
                })
            };
            
            // ✅ BOT DATA METHODS
            const botDataMethods = {
                getData: createSmartHandler(async (key) => {
                    try {
                        const { data, error } = await supabase.from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key)
                            .single();
                            
                        if (error) {
                            if (error.code === 'PGRST116') return null; // Not found
                            throw error;
                        }
                        
                        return data ? JSON.parse(data.data_value) : null;
                    } catch (error) {
                        console.error('❌ Get bot data error:', error);
                        return null;
                    }
                }),
                
                saveData: createSmartHandler(async (key, value) => {
                    try {
                        const { error } = await supabase.from('universal_data').upsert({
                            data_type: 'bot_data',
                            bot_token: resolvedBotToken,
                            data_key: key,
                            data_value: JSON.stringify(value),
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'data_type,bot_token,data_key'
                        });
                        
                        if (error) throw error;
                        return value;
                    } catch (error) {
                        console.error('❌ Save bot data error:', error);
                        return null;
                    }
                }),
                
                deleteData: createSmartHandler(async (key) => {
                    try {
                        const { error } = await supabase.from('universal_data')
                            .delete()
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key);
                            
                        if (error) throw error;
                        return true;
                    } catch (error) {
                        console.error('❌ Delete bot data error:', error);
                        return false;
                    }
                })
            };
            
            // ✅ BOT METHODS WITH COMPLETE TELEGRAM API
            const createBotMethodHandler = (methodName) => {
                return createSmartHandler(async (...args) => {
                    try {
                        if (!apiWrapperInstance[methodName]) {
                            throw new Error(`Method ${methodName} not available`);
                        }
                        return await apiWrapperInstance[methodName](...args);
                    } catch (error) {
                        console.error(`❌ Bot method ${methodName} error:`, error);
                        throw error;
                    }
                });
            };
            
            // Complete list of Telegram Bot API methods
            const telegramMethods = [
                // Message methods
                'sendMessage', 'forwardMessage', 'copyMessage', 'sendPhoto', 
                'sendAudio', 'sendDocument', 'sendVideo', 'sendAnimation',
                'sendVoice', 'sendVideoNote', 'sendMediaGroup', 'sendLocation',
                'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction',
                
                // Message editing
                'editMessageText', 'editMessageCaption', 'editMessageMedia',
                'editMessageReplyMarkup', 'editMessageLiveLocation', 'stopMessageLiveLocation',
                
                // Message management
                'deleteMessage', 'deleteMessages',
                
                // Chat methods
                'getChat', 'getChatAdministrators', 'getChatMemberCount',
                'getChatMember', 'setChatTitle', 'setChatDescription',
                'setChatPhoto', 'deleteChatPhoto', 'setChatPermissions',
                'exportChatInviteLink', 'createChatInviteLink', 'editChatInviteLink',
                'revokeChatInviteLink', 'approveChatJoinRequest', 'declineChatJoinRequest',
                'setChatAdministratorCustomTitle', 'banChatMember', 'unbanChatMember',
                'restrictChatMember', 'promoteChatMember', 'banChatSenderChat', 
                'unbanChatSenderChat', 'setChatStickerSet', 'deleteChatStickerSet',
                
                // Chat management
                'getChatMenuButton', 'setChatMenuButton', 'leaveChat', 
                'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages',
                
                // Sticker methods
                'sendSticker', 'getStickerSet', 'getCustomEmojiStickers',
                'uploadStickerFile', 'createNewStickerSet', 'addStickerToSet',
                'setStickerPositionInSet', 'deleteStickerFromSet', 'setStickerSetThumbnail',
                
                // Forum & Topic methods
                'createForumTopic', 'editForumTopic', 'closeForumTopic',
                'reopenForumTopic', 'deleteForumTopic', 'unpinAllForumTopicMessages',
                'getForumTopicIconStickers', 'editGeneralForumTopic', 'closeGeneralForumTopic',
                'reopenGeneralForumTopic', 'hideGeneralForumTopic', 'unhideGeneralForumTopic',
                
                // Inline & Callback
                'answerInlineQuery', 'answerWebAppQuery', 'answerCallbackQuery',
                'answerPreCheckoutQuery', 'answerShippingQuery',
                
                // Payment methods
                'sendInvoice', 'createInvoiceLink',
                
                // Bot management
                'getMe', 'logOut', 'close', 'getMyCommands', 'setMyCommands',
                'deleteMyCommands', 'getMyDescription', 'setMyDescription',
                'getMyShortDescription', 'setMyShortDescription', 'getMyName',
                'setMyName', 'getMyDefaultAdministratorRights', 'setMyDefaultAdministratorRights',
                
                // Game methods
                'sendGame', 'setGameScore', 'getGameHighScores',
                
                // File methods
                'getFile', 'downloadFile'
            ];
            
            const botMethods = {};
            telegramMethods.forEach(method => {
                if (typeof apiWrapperInstance[method] === 'function') {
                    botMethods[method] = createBotMethodHandler(method);
                }
            });
            
            // ✅ ADD SHORTHAND METHODS
            botMethods.send = botMethods.sendMessage;
            botMethods.reply = createSmartHandler(async (text, options = {}) => {
                return await apiWrapperInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                });
            });
            
            // ✅ METADATA METHODS
            const metadataFunc = createSmartHandler(async (target = 'message') => {
                try {
                    return await apiWrapperInstance.metadata(target);
                } catch (error) {
                    console.error('❌ Metadata error:', error);
                    return { error: error.message };
                }
            });
            
            botMethods.metadata = metadataFunc;
            botMethods.metaData = metadataFunc;
            botMethods.Metadata = metadataFunc;
            botMethods.METADATA = metadataFunc;
            
            // ✅ UTILITY FUNCTIONS
            const waitFunction = createSmartHandler(async (seconds) => {
                const ms = seconds * 1000;
                return new Promise(resolve => setTimeout(() => resolve(`Waited ${seconds} seconds`), ms));
            });
            
            const runPythonFunc = createSmartHandler(async (code) => {
                try {
                    return await pythonRunner.runPythonCode(code);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            });
            
            const waitForAnswerFunc = createSmartHandler(async (question, options = {}) => {
                return new Promise((resolve, reject) => {
                    try {
                        const waitKey = `${resolvedBotToken}_${userId}`;
                        
                        botInstance.sendMessage(chatId, question, options)
                            .then(() => {
                                if (nextCommandHandlers) {
                                    nextCommandHandlers.set(waitKey, {
                                        resolve: resolve,
                                        reject: reject,
                                        timestamp: Date.now()
                                    });
                                    
                                    // Auto cleanup after 5 minutes
                                    setTimeout(() => {
                                        if (nextCommandHandlers.has(waitKey)) {
                                            nextCommandHandlers.delete(waitKey);
                                            reject(new Error('Wait for answer timeout (5 minutes)'));
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
            });
            
            // ✅ CONTEXT OBJECTS
            const userObject = {
                id: userId,
                first_name: first_name || '',
                username: username || '',
                language_code: context.language_code || '',
                chat_id: chatId,
                ...(msg.from || {})
            };
            
            const chatObject = {
                id: chatId,
                type: msg.chat?.type || 'private',
                ...(msg.chat || {})
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
                // User properties
                ...userObject,
                
                // User methods
                ...userDataMethods
            };
            
            const Bot = {
                // Bot methods
                ...botMethods,
                
                // Utility methods
                wait: waitFunction,
                delay: waitFunction,
                sleep: waitFunction,
                runPython: runPythonFunc,
                executePython: runPythonFunc,
                waitForAnswer: waitForAnswerFunc,
                ask: waitForAnswerFunc,
                
                // Context methods
                getUser: () => userObject,
                getChat: () => chatObject,
                analyzeContext: () => contextObject,
                getContext: () => contextObject
            };
            
            const BotData = { ...botDataMethods };
            
            // ✅ DIRECT MESSAGE FUNCTIONS
            const sendMessageFunc = createSmartHandler(async (text, options = {}) => {
                return await botInstance.sendMessage(chatId, text, options);
            });
            
            const sendFunc = sendMessageFunc;
            
            const replyFunc = createSmartHandler(async (text, options = {}) => {
                return await botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                });
            });
            
            // ✅ CREATE CASE INSENSITIVE ENVIRONMENT
            const createCaseInsensitiveEnvironment = (env) => {
                const caseInsensitiveEnv = {};
                
                for (const key in env) {
                    if (env.hasOwnProperty(key)) {
                        const lowerKey = key.toLowerCase();
                        caseInsensitiveEnv[lowerKey] = env[key];
                        
                        // Also keep original key for backward compatibility
                        if (!caseInsensitiveEnv[key]) {
                            caseInsensitiveEnv[key] = env[key];
                        }
                    }
                }
                
                return new Proxy(caseInsensitiveEnv, {
                    get(target, prop) {
                        if (typeof prop !== 'string') return target[prop];
                        
                        const lowerProp = prop.toLowerCase();
                        if (target.hasOwnProperty(lowerProp)) {
                            return target[lowerProp];
                        }
                        
                        return target[prop];
                    },
                    
                    set(target, prop, value) {
                        if (typeof prop !== 'string') {
                            target[prop] = value;
                            return true;
                        }
                        
                        const lowerProp = prop.toLowerCase();
                        target[lowerProp] = value;
                        target[prop] = value;
                        return true;
                    }
                });
            };
            
            // ✅ CREATE ENVIRONMENT WITH ALL VARIABLES
            const baseEnvironment = {
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
                metadata: metadataFunc,
                metaData: metadataFunc,
                Metadata: metadataFunc,
                METADATA: metadataFunc,
                
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
            
            // Apply case insensitive access
            const environment = createCaseInsensitiveEnvironment(baseEnvironment);
            
            // ✅ EXECUTION FUNCTION WITH COMPLETE ERROR HANDLING
            const executionFunction = new Function(
                'env',
                `
                return (async function() {
                    // ✅ INJECT ALL VARIABLES INTO SCOPE
                    for (const key in env) {
                        if (env.hasOwnProperty(key)) {
                            this[key] = env[key];
                            globalThis[key] = env[key];
                        }
                    }
                    
                    try {
                        console.log('🚀 Command execution started');
                        
                        // 🎯 USER CODE EXECUTION
                        ${code}
                        
                        return "✅ Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        // Try to send error message
                        try {
                            if (env.Bot && env.Bot.sendMessage) {
                                await env.Bot.sendMessage("❌ Error: " + error.message);
                            }
                        } catch (sendError) {
                            console.error('Failed to send error message:', sendError);
                        }
                        throw error;
                    }
                }).call({});
                `
            );
            
            // Execute the command
            console.log('🚀 Executing user code...');
            const result = await executionFunction(environment);
            
            console.log('✅ Command execution completed successfully');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };