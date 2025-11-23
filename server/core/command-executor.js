// server/core/command-executor.js - FINAL FIXED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            // Resolve bot token
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
            
            // ✅ ULTIMATE SMART HANDLER - BOTH AWAIT AND SYNC
            const createUltimateHandler = (asyncFn, functionName = 'unknown') => {
                return (...args) => {
                    const promise = asyncFn(...args);
                    
                    // Create a smart promise that works with both await and direct usage
                    const smartPromise = promise.then(result => {
                        return result;
                    }).catch(error => {
                        console.error(`❌ ${functionName} error:`, error);
                        return null;
                    });
                    
                    // Add magic methods for direct usage
                    const handler = {
                        get(target, prop) {
                            if (prop === 'then') return target.then.bind(target);
                            if (prop === 'catch') return target.catch.bind(target);
                            if (prop === 'finally') return target.finally.bind(target);
                            if (prop === 'valueOf') return () => target;
                            if (prop === 'toString') return () => {
                                // When used in string context, wait and return the value
                                return target.then(val => String(val || '')).catch(() => '');
                            };
                            return undefined;
                        }
                    };
                    
                    return new Proxy(smartPromise, handler);
                };
            };

            // ✅ USER DATA METHODS
            const userDataMethods = {
                getData: createUltimateHandler(async (key) => {
                    try {
                        return await apiWrapperInstance.User.getData(key);
                    } catch (error) {
                        return null;
                    }
                }, 'User.getData'),
                
                saveData: createUltimateHandler(async (key, value) => {
                    try {
                        await apiWrapperInstance.User.saveData(key, value);
                        return value;
                    } catch (error) {
                        return null;
                    }
                }, 'User.saveData'),
                
                deleteData: createUltimateHandler(async (key) => {
                    try {
                        await apiWrapperInstance.User.deleteData(key);
                        return true;
                    } catch (error) {
                        return false;
                    }
                }, 'User.deleteData'),
                
                increment: createUltimateHandler(async (key, amount = 1) => {
                    try {
                        const current = await apiWrapperInstance.User.getData(key);
                        const newValue = (parseInt(current) || 0) + amount;
                        await apiWrapperInstance.User.saveData(key, newValue);
                        return newValue;
                    } catch (error) {
                        return 0;
                    }
                }, 'User.increment')
            };
            
            // ✅ BOT DATA METHODS
            const botDataMethods = {
                getData: createUltimateHandler(async (key) => {
                    try {
                        const { data, error } = await supabase.from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key)
                            .single();
                            
                        if (error) {
                            if (error.code === 'PGRST116') return null;
                            throw error;
                        }
                        
                        return data ? JSON.parse(data.data_value) : null;
                    } catch (error) {
                        return null;
                    }
                }, 'Bot.getData'),
                
                saveData: createUltimateHandler(async (key, value) => {
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
                        return null;
                    }
                }, 'Bot.saveData'),
                
                deleteData: createUltimateHandler(async (key) => {
                    try {
                        const { error } = await supabase.from('universal_data')
                            .delete()
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key);
                            
                        if (error) throw error;
                        return true;
                    } catch (error) {
                        return false;
                    }
                }, 'Bot.deleteData')
            };
            
            // ✅ BOT METHODS
            const createBotMethod = (methodName) => {
                return createUltimateHandler(async (...args) => {
                    if (!apiWrapperInstance[methodName]) {
                        throw new Error(`Method ${methodName} not available`);
                    }
                    return await apiWrapperInstance[methodName](...args);
                }, `Bot.${methodName}`);
            };
            
            const telegramMethods = [
                'sendMessage', 'send', 'reply', 'sendPhoto', 'sendDocument', 
                'sendVideo', 'sendAudio', 'sendVoice', 'sendLocation', 'sendContact',
                'sendSticker', 'sendPoll', 'sendDice', 'editMessageText', 'deleteMessage',
                'forwardMessage', 'copyMessage', 'getMe', 'getChat', 'getChatAdministrators',
                'getChatMember', 'banChatMember', 'unbanChatMember', 'restrictChatMember',
                'promoteChatMember', 'pinChatMessage', 'unpinChatMessage', 'leaveChat', 'getFile'
            ];
            
            const botMethods = {};
            telegramMethods.forEach(method => {
                if (typeof apiWrapperInstance[method] === 'function') {
                    botMethods[method] = createBotMethod(method);
                }
            });
            
            // ✅ METADATA METHODS
            const metadataFunc = createUltimateHandler(async (target = 'message') => {
                try {
                    return await apiWrapperInstance.metadata(target);
                } catch (error) {
                    return { error: error.message };
                }
            }, 'metadata');
            
            botMethods.metadata = metadataFunc;
            botMethods.metaData = metadataFunc;
            botMethods.Metadata = metadataFunc;
            botMethods.METADATA = metadataFunc;
            
            // ✅ UTILITY FUNCTIONS
            const waitFunction = createUltimateHandler(async (seconds) => {
                const ms = seconds * 1000;
                return new Promise(resolve => setTimeout(() => resolve(`Waited ${seconds} seconds`), ms));
            }, 'wait');
            
            const runPythonFunc = createUltimateHandler(async (code) => {
                try {
                    return await pythonRunner.runPythonCode(code);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            }, 'runPython');
            
            const waitForAnswerFunc = createUltimateHandler(async (question, options = {}) => {
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
                                    
                                    setTimeout(() => {
                                        if (nextCommandHandlers.has(waitKey)) {
                                            nextCommandHandlers.delete(waitKey);
                                            reject(new Error('Wait for answer timeout'));
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
            }, 'waitForAnswer');
            
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
            
            const Bot = { ...botDataMethods };
            
            // ✅ DIRECT MESSAGE FUNCTIONS
            const sendMessageFunc = createUltimateHandler(async (text, options = {}) => {
                return await botInstance.sendMessage(chatId, text, options);
            }, 'sendMessage');
            
            const sendFunc = sendMessageFunc;
            
            const replyFunc = createUltimateHandler(async (text, options = {}) => {
                return await botInstance.sendMessage(chatId, text, {
                    reply_to_message_id: msg.message_id,
                    ...options
                });
            }, 'reply');
            
            // ✅ CREATE ENVIRONMENT
            const environment = {
                // Core objects
                User,
                Bot,
                bot: Bot,
                API: Bot,
                Api: Bot,
                
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
            
            // ✅ SPECIAL EXECUTION FUNCTION FOR MIXED USAGE
            const executionFunction = new Function(
                'env',
                `
                return (async function() {
                    const {
                        User, Bot, bot, API, Api,
                        msg, chatId, userId, userInput, params, message, botToken,
                        wait, delay, sleep, runPython, executePython, waitForAnswer, ask,
                        metadata, metaData, Metadata, METADATA,
                        userData, chatData, currentUser, currentChat, context, ctx,
                        sendMessage, send, reply
                    } = env;
                    
                    try {
                        console.log('🚀 Command execution started for user:', currentUser.first_name);
                        
                        // 🎯 SPECIAL: Auto-resolve promises in string context
                        const originalSendMessage = Bot.sendMessage;
                        Bot.sendMessage = async function(text, options) {
                            if (typeof text === 'string') {
                                // Auto-resolve any promises in the text
                                const resolvedText = await Promise.resolve(text);
                                return originalSendMessage(resolvedText, options);
                            }
                            return originalSendMessage(text, options);
                        };
                        
                        // 🎯 USER CODE EXECUTION
                        ${code}
                        
                        return "✅ Command completed successfully";
                    } catch (error) {
                        console.error('❌ Execution error:', error);
                        try {
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