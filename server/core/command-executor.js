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
                },
                
                // ✅ NEW: Get all user data
                getAllData: async () => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`📊 Getting all user data`);
                        
                        const { data, error } = await supabase
                            .from('universal_data')
                            .select('data_key, data_value, updated_at')
                            .eq('data_type', 'user_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('user_id', userId.toString());

                        if (error) {
                            console.error('❌ Get all data error:', error);
                            return {};
                        }

                        const result = {};
                        for (const item of data || []) {
                            try {
                                result[item.data_key] = JSON.parse(item.data_value);
                            } catch {
                                result[item.data_key] = item.data_value;
                            }
                        }
                        
                        console.log(`✅ Retrieved ${Object.keys(result).length} user data entries`);
                        return result;
                    } catch (error) {
                        console.error('❌ Get all data error:', error);
                        return {};
                    }
                },
                
                // ✅ NEW: Clear all user data
                clearAll: async () => {
                    try {
                        const supabase = require('../config/supabase');
                        console.log(`🧹 Clearing all user data`);
                        
                        const { error } = await supabase
                            .from('universal_data')
                            .delete()
                            .eq('data_type', 'user_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('user_id', userId.toString());

                        if (error) {
                            console.error('❌ Clear all data error:', error);
                            throw new Error(`Failed to clear data: ${error.message}`);
                        }
                        
                        console.log(`✅ All user data cleared`);
                        return true;
                    } catch (error) {
                        console.error('❌ Clear all data error:', error);
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

            // ✅ FIXED: PROPER AUTO-AWAIT IMPLEMENTATION
            const applyAutoAwait = (userCode) => {
                try {
                    console.log('🔧 Applying auto-await to user code...');
                    
                    // List of async function patterns that need await
                    const asyncPatterns = [
                        'User\\.', 'BotData\\.', 'bot\\.', 'Bot\\.', 'api\\.', 'Api\\.', 'API\\.',
                        'waitForAnswer', 'ask', 'wait', 'delay', 'sleep', 
                        'runPython', 'executePython', 'metaData', 'metadata', 'getMeta', 'inspect',
                        'sendMessage', 'send', 'reply', 'sendPhoto', 'sendDocument', 'sendVideo',
                        'sendAudio', 'sendVoice', 'sendLocation', 'sendContact'
                    ];
                    
                    let modifiedCode = userCode;
                    
                    // Apply auto-await to each pattern - FIXED REGEX
                    asyncPatterns.forEach(pattern => {
                        // Handle different cases: 
                        // 1. Standalone function calls: User.saveData(...)
                        // 2. Assignment: const x = User.getData(...)
                        // 3. In expressions: bot.sendMessage(...)
                        
                        const regex = new RegExp(
                            `(^|\\s|;|\\{|\\})` + // Start of line, space, semicolon, or brace
                            `(${pattern}[^(]+\\))` + // Function call
                            `(?!\\s*=>)`, // Not followed by arrow function
                            'g'
                        );
                        
                        modifiedCode = modifiedCode.replace(regex, '$1await $2');
                    });
                    
                    console.log('✅ Auto-await applied successfully');
                    console.log('📝 Modified code:', modifiedCode.substring(0, 200) + '...');
                    
                    return modifiedCode;
                    
                } catch (error) {
                    console.error('❌ Auto-await processing error:', error);
                    return userCode; // Return original code if processing fails
                }
            };

            // ✅ FIXED: EXECUTION FUNCTION WITH PROPER AUTO-AWAIT
            const processedCode = applyAutoAwait(code);
            
            const executionFunction = new Function(
                'env',
                `with(env) {
                    return (async function() {
                        try {
                            console.log('✅ Execution started for user:', currentUser.first_name);
                            
                            // User's code starts here - ALREADY PROCESSED
                            ${processedCode}
                            // User's code ends here
                            
                            return "Command completed successfully";
                        } catch (error) {
                            console.error('❌ Execution error:', error);
                            try {
                                let errorMsg = "❌ Error: " + error.message.substring(0, 100);
                                if (errorMsg.length > 200) errorMsg = errorMsg.substring(0, 200) + "...";
                                await env.sendMessage(errorMsg);
                            } catch (sendError) {
                                console.error('Failed to send error message:', sendError);
                            }
                            throw error;
                        }
                    })();
                }`
            );

            // Execute the command
            console.log('🚀 Executing command with auto-await...');
            const result = await executionFunction(mergedEnvironment);
            
            console.log('✅ Command execution completed');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution failed:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };