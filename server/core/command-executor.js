// server/core/command-executor.js - COMPLETE FIXED VERSION WITH DEBUG LOGS
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
            const createUserObjectFunction = () => {
                const userObj = msg.from ? Object.assign({}, msg.from) : {
                    id: userId,
                    first_name: first_name || '',
                    username: username || '',
                    language_code: context.language_code || ''
                };
                
                userObj.chat_id = chatId;
                return userObj;
            };

            const createChatObjectFunction = () => {
                const chatObj = msg.chat ? Object.assign({}, msg.chat) : {
                    id: chatId,
                    type: 'private'
                };
                return chatObj;
            };

            // ✅ FIXED: Python runner
            const pythonRunner = require('./python-runner');
            const runPythonSyncFunction = (pythonCode) => {
                try {
                    return pythonRunner.runPythonCodeSync(pythonCode);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            };

            // ✅ FIXED: Wait for answer function
            const waitForAnswerFunction = async (question, options = {}) => {
                return new Promise((resolveWait, rejectWait) => {
                    try {
                        const waitKey = `${resolvedBotToken}_${userId}`;
                        console.log(`⏳ Setting up waitForAnswer for user ${userId}`);
                        
                        // Send question first
                        botInstance.sendMessage(chatId, question, options)
                            .then(() => {
                                if (nextCommandHandlers) {
                                    nextCommandHandlers.set(waitKey, {
                                        resolve: resolveWait,
                                        reject: rejectWait,
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
                                rejectWait(new Error('Failed to send question: ' + sendError.message));
                            });
                    } catch (error) {
                        rejectWait(new Error('WaitForAnswer setup failed: ' + error.message));
                    }
                });
            };

            // ✅ FIXED: WAIT FUNCTION - IN SECONDS
            const waitFunction = (seconds) => {
                // Convert seconds to milliseconds
                const ms = seconds * 1000;
                console.log(`⏰ Waiting for ${seconds} seconds (${ms}ms)...`);
                return new Promise(resolveWait => {
                    setTimeout(() => {
                        console.log(`✅ Wait completed: ${seconds} seconds`);
                        resolveWait(`Waited ${seconds} seconds`);
                    }, ms);
                });
            };

            // ✅ FIXED: METADATA FUNCTION - ORIGINAL RESPONSE ONLY
            const extractMetadataFunction = async (target = 'all') => {
                return await apiWrapperInstance.getOriginalResponse(target);
            };

            // ✅ AUTO CONTEXT ANALYSIS
            const analyzeContextFunction = () => {
                return {
                    user: createUserObjectFunction(),
                    chat: createChatObjectFunction(),
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

            // ✅ FIXED: DATA STORAGE FUNCTIONS - COMPLETELY REWRITTEN WITH BUG FIXES
            const userDataFunctions = {
                saveData: async (key, value) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`💾 Saving user data: ${key} =`, value);
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .upsert({
                                data_type: 'user_data',
                                bot_token: resolvedBotToken,
                                user_id: userId.toString(),
                                data_key: key,
                                data_value: JSON.stringify(value),
                                metadata: {
                                    saved_at: new Date().toISOString(),
                                    value_type: typeof value
                                },
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'data_type,bot_token,user_id,data_key'
                            });

                        if (error) {
                            console.error('❌ Save data error:', error);
                            throw new Error(`Failed to save data: ${error.message}`);
                        }
                        
                        console.log(`✅ User data saved: ${key}`);
                        return value;
                    } catch (error) {
                        console.error('❌ Save data error:', error);
                        throw error;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`🔍 Reading user data: ${key}`);
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .select('data_value, metadata, updated_at')
                            .eq('data_type', 'user_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('user_id', userId.toString())
                            .eq('data_key', key)
                            .single();

                        if (error) {
                            if (error.code === 'PGRST116') {
                                console.log(`📭 No data found for key: ${key}`);
                                return null;
                            }
                            console.error('❌ Get data error:', error);
                            return null;
                        }

                        if (!data || !data.data_value) {
                            console.log(`📭 Empty data for key: ${key}`);
                            return null;
                        }

                        // ✅ FIXED: Handle both JSON and string values safely
                        try {
                            const parsedValue = JSON.parse(data.data_value);
                            console.log(`✅ User data retrieved: ${key} =`, parsedValue);
                            return parsedValue;
                        } catch (parseError) {
                            console.log(`⚠️ Data is not JSON, returning as string: ${data.data_value}`);
                            return data.data_value;
                        }
                    } catch (error) {
                        console.error('❌ Get data error:', error);
                        return null;
                    }
                },
                
                deleteData: async (key) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`🗑️ Deleting user data: ${key}`);
                        
                        const { error } = await supabase
                            .from('universal_data')
                            .delete()
                            .eq('data_type', 'user_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('user_id', userId.toString())
                            .eq('data_key', key);

                        if (error) {
                            console.error('❌ Delete data error:', error);
                            throw new Error(`Failed to delete data: ${error.message}`);
                        }
                        
                        console.log(`✅ User data deleted: ${key}`);
                        return true;
                    } catch (error) {
                        console.error('❌ Delete data error:', error);
                        throw error;
                    }
                },
                
                increment: async (key, amount = 1) => {
                    try {
                        console.log(`➕ Incrementing user data: ${key} by ${amount}`);
                        const current = await userDataFunctions.getData(key) || 0;
                        const newValue = parseInt(current) + parseInt(amount);
                        await userDataFunctions.saveData(key, newValue);
                        console.log(`✅ User data incremented: ${key} = ${newValue}`);
                        return newValue;
                    } catch (error) {
                        console.error('❌ Increment data error:', error);
                        throw error;
                    }
                }
            };

            // ✅ FIXED: BOT DATA FUNCTIONS - COMPLETELY REWRITTEN TO FIX CONSTRAINT ERROR
            const botDataFunctions = {
                saveData: async (key, value) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`💾 Saving bot data: ${key} =`, value);
                        
                        // ✅ FIX: First check if data exists
                        const { data: existingData, error: checkError } = await supabase
                            .from('universal_data')
                            .select('id')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key)
                            .single();

                        let result;
                        
                        if (checkError && checkError.code === 'PGRST116') {
                            // Data doesn't exist, insert new
                            result = await supabase
                                .from('universal_data')
                                .insert({
                                    data_type: 'bot_data',
                                    bot_token: resolvedBotToken,
                                    data_key: key,
                                    data_value: JSON.stringify(value),
                                    metadata: {
                                        saved_at: new Date().toISOString(),
                                        value_type: typeof value
                                    },
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                });
                        } else {
                            // Data exists, update it
                            result = await supabase
                                .from('universal_data')
                                .update({
                                    data_value: JSON.stringify(value),
                                    metadata: {
                                        saved_at: new Date().toISOString(),
                                        value_type: typeof value
                                    },
                                    updated_at: new Date().toISOString()
                                })
                                .eq('data_type', 'bot_data')
                                .eq('bot_token', resolvedBotToken)
                                .eq('data_key', key);
                        }

                        if (result.error) {
                            console.error('❌ Save bot data error:', result.error);
                            throw new Error(`Failed to save bot data: ${result.error.message}`);
                        }
                        
                        console.log(`✅ Bot data saved: ${key}`);
                        return value;
                    } catch (error) {
                        console.error('❌ Save bot data error:', error);
                        throw error;
                    }
                },
                
                getData: async (key) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`🔍 Reading bot data: ${key}`);
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .select('data_value, metadata, updated_at')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key)
                            .single();

                        if (error) {
                            if (error.code === 'PGRST116') {
                                console.log(`📭 No bot data found for key: ${key}`);
                                return null;
                            }
                            console.error('❌ Get bot data error:', error);
                            return null;
                        }

                        if (!data || !data.data_value) {
                            console.log(`📭 Empty bot data for key: ${key}`);
                            return null;
                        }

                        // ✅ FIXED: Handle both JSON and string values safely
                        try {
                            const parsedValue = JSON.parse(data.data_value);
                            console.log(`✅ Bot data retrieved: ${key} =`, parsedValue);
                            return parsedValue;
                        } catch (parseError) {
                            console.log(`⚠️ Bot data is not JSON, returning as string: ${data.data_value}`);
                            return data.data_value;
                        }
                    } catch (error) {
                        console.error('❌ Get bot data error:', error);
                        return null;
                    }
                },
                
                deleteData: async (key) => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`🗑️ Deleting bot data: ${key}`);
                        
                        const { error } = await supabase
                            .from('universal_data')
                            .delete()
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key);

                        if (error) {
                            console.error('❌ Delete bot data error:', error);
                            throw new Error(`Failed to delete bot data: ${error.message}`);
                        }
                        
                        console.log(`✅ Bot data deleted: ${key}`);
                        return true;
                    } catch (error) {
                        console.error('❌ Delete bot data error:', error);
                        throw error;
                    }
                }
            };

            // ✅ CREATE BOT OBJECT WITH ALL METHODS
            const createBotObject = () => {
                const botObj = {
                    // Copy all methods from apiWrapperInstance
                    ...apiWrapperInstance,
                    
                    // ✅ FIXED: METADATA METHODS - ORIGINAL RESPONSE ONLY
                    metaData: extractMetadataFunction,
                    metadata: extractMetadataFunction,
                    getMeta: extractMetadataFunction,
                    inspect: extractMetadataFunction,
                    
                    // Context analysis
                    analyzeContext: analyzeContextFunction,
                    getContext: analyzeContextFunction,
                    
                    // Utility methods
                    wait: waitFunction,
                    delay: waitFunction,
                    sleep: waitFunction,
                    runPython: runPythonSyncFunction,
                    executePython: runPythonSyncFunction,
                    waitForAnswer: waitForAnswerFunction,
                    ask: waitForAnswerFunction
                };
                
                return botObj;
            };

            // ✅ CREATE BOT INSTANCE
            const botObject = createBotObject();

            // ✅ CREATE BASE EXECUTION ENVIRONMENT
            const baseExecutionEnv = {
                // === CORE FUNCTIONS ===
                getUser: createUserObjectFunction,
                getChat: createChatObjectFunction,
                getCurrentUser: createUserObjectFunction,
                getCurrentChat: createChatObjectFunction,
                
                // === BOT INSTANCES - ALL VARIATIONS ===
                Bot: botObject,
                bot: botObject,
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
                
                runPython: runPythonSyncFunction,
                executePython: runPythonSyncFunction,
                
                waitForAnswer: waitForAnswerFunction,
                ask: waitForAnswerFunction,
                
                // === METADATA FUNCTIONS ===
                metaData: extractMetadataFunction,
                metadata: extractMetadataFunction,
                getMeta: extractMetadataFunction,
                inspect: extractMetadataFunction,
                
                analyzeContext: analyzeContextFunction,
                getContext: analyzeContextFunction,
                context: analyzeContextFunction(),
                ctx: analyzeContextFunction(),
                
                // === DATA STORAGE ===
                User: userDataFunctions,
                BotData: botDataFunctions,
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers,
                
                // === DATA OBJECTS ===
                userData: createUserObjectFunction(),
                chatData: createChatObjectFunction(),
                currentUser: createUserObjectFunction(),
                currentChat: createChatObjectFunction()
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

            // ✅ ULTIMATE SOLUTION: AUTO-AWAIT WITH DEBUG LOGS
            const executeWithAutoAwait = async (userCode, env) => {
                try {
                    console.log('🚀 STARTING AUTO-AWAIT EXECUTION');
                    console.log('📝 ORIGINAL USER CODE:');
                    console.log(userCode);
                    
                    // Create auto-await wrapper functions
                    const autoAwaitWrapper = {
                        // User data with auto-await
                        UserSave: async (key, value) => {
                            console.log(`🔄 AUTO-AWAIT: User.saveData("${key}", ${value})`);
                            const result = await env.User.saveData(key, value);
                            console.log(`✅ AUTO-AWAIT RESULT: User.saveData =`, result);
                            return result;
                        },
                        UserGet: async (key) => {
                            console.log(`🔄 AUTO-AWAIT: User.getData("${key}")`);
                            const result = await env.User.getData(key);
                            console.log(`✅ AUTO-AWAIT RESULT: User.getData =`, result);
                            return result;
                        },
                        
                        // Bot data with auto-await
                        BotDataSave: async (key, value) => {
                            console.log(`🔄 AUTO-AWAIT: BotData.saveData("${key}", ${value})`);
                            const result = await env.BotData.saveData(key, value);
                            console.log(`✅ AUTO-AWAIT RESULT: BotData.saveData =`, result);
                            return result;
                        },
                        BotDataGet: async (key) => {
                            console.log(`🔄 AUTO-AWAIT: BotData.getData("${key}")`);
                            const result = await env.BotData.getData(key);
                            console.log(`✅ AUTO-AWAIT RESULT: BotData.getData =`, result);
                            return result;
                        },
                        
                        // Bot messages with auto-await
                        // ✅ CORRECTED VERSION - server/core/command-executor.js এ পরিবর্তন করুন
BotSend: async (text, options) => {
  console.log(`🔄 AUTO-AWAIT: bot.sendMessage("${text.substring(0, 50)}...")`);
  
  try {
    // ✅ সরাসরি botInstance ব্যবহার করুন, env.bot নয়
    const result = await botInstance.sendMessage(env.chatId, text, options);
    console.log(`✅ AUTO-AWAIT RESULT: bot.sendMessage success`);
    return result;
  } catch (error) {
    console.error(`❌ AUTO-AWAIT: bot.sendMessage failed:`, error.message);
    throw error;
  }
}
                    };

                    // Process user code to add auto-await
                    let processedCode = userCode;
                    
                    console.log('🔧 PROCESSING CODE FOR AUTO-AWAIT...');
                    
                    // Replace User.saveData with auto-awaited version
                    processedCode = processedCode.replace(
                        /User\.saveData\(([^)]+)\)/g,
                        'await __autoAwait.UserSave($1)'
                    );
                    
                    // Replace User.getData with auto-awaited version
                    processedCode = processedCode.replace(
                        /User\.getData\(([^)]+)\)/g, 
                        'await __autoAwait.UserGet($1)'
                    );
                    
                    // Replace BotData.saveData with auto-awaited version
                    processedCode = processedCode.replace(
                        /BotData\.saveData\(([^)]+)\)/g,
                        'await __autoAwait.BotDataSave($1)'
                    );
                    
                    // Replace BotData.getData with auto-awaited version
                    processedCode = processedCode.replace(
                        /BotData\.getData\(([^)]+)\)/g,
                        'await __autoAwait.BotDataGet($1)'
                    );
                    
                    // Replace bot.sendMessage with auto-awaited version
                    processedCode = processedCode.replace(
                        /bot\.sendMessage\(([^)]+)\)/g,
                        'await __autoAwait.BotSend($1)'
                    );
                    
                    console.log('📝 PROCESSED CODE WITH AUTO-AWAIT:');
                    console.log(processedCode);
                    
                    // Create enhanced environment with auto-await wrapper
                    const enhancedEnv = {
                        ...env,
                        __autoAwait: autoAwaitWrapper
                    };
                    
                    // Execute the processed code
                    const executionFunction = new Function(
                        'env',
                        `with(env) {
                            return (async function() {
                                try {
                                    console.log('🎯 EXECUTING PROCESSED CODE...');
                                    ${processedCode}
                                    console.log('✅ PROCESSED CODE EXECUTION COMPLETED');
                                    return "Command executed successfully with auto-await";
                                } catch (error) {
                                    console.error('❌ PROCESSED CODE ERROR:', error);
                                    // Send error message
                                    try {
                                        await env.bot.sendMessage(env.chatId, "❌ Error: " + error.message);
                                    } catch (sendError) {
                                        console.error('Failed to send error message:', sendError);
                                    }
                                    throw error;
                                }
                            })();
                        }`
                    );

                    console.log('🚀 EXECUTING FINAL CODE...');
                    const result = await executionFunction(enhancedEnv);
                    console.log('✅ AUTO-AWAIT EXECUTION COMPLETED SUCCESSFULLY');
                    return result;
                    
                } catch (error) {
                    console.error('❌ AUTO-AWAIT EXECUTION FAILED:', error);
                    throw error;
                }
            };

            // ✅ EXECUTE WITH AUTO-AWAIT
            console.log('🔧 STARTING COMMAND EXECUTION WITH AUTO-AWAIT...');
            const result = await executeWithAutoAwait(code, mergedEnvironment);
            
            console.log('🎉 COMMAND EXECUTION COMPLETED SUCCESSFULLY');
            resolve(result);

        } catch (error) {
            console.error('💥 COMMAND EXECUTION FAILED:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };