// server/core/command-executor.js - COMPLETELY FIXED VERSION
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
                try {
                    const botInfo = await botInstance.getMe();
                    resolvedBotToken = botInfo.token || 'fallback_token';
                } catch (e) {
                    resolvedBotToken = 'fallback_token';
                }
            }
            
            // Import dependencies
            const ApiWrapper = require('./api-wrapper');
            const pythonRunner = require('./python-runner');
            const supabase = require('../config/supabase');
            
            // Create ApiWrapper context
            const apiContext = {
                msg, 
                chatId, 
                userId, 
                username: username || '', 
                first_name: first_name || '',
                last_name: context.last_name || '', 
                language_code: context.language_code || '',
                botToken: resolvedBotToken, 
                userInput, 
                nextCommandHandlers: nextCommandHandlers || new Map()
            };
            
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // Helper functions
            const createUserObject = () => ({
                ...(msg.from || { 
                    id: userId, 
                    first_name: first_name || '', 
                    username: username || '',
                    language_code: context.language_code || 'en'
                }),
                chat_id: chatId
            });

            const runPythonSync = (pythonCode) => {
                try {
                    return pythonRunner.runPythonCodeSync(pythonCode);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            };

            const waitForAnswer = async (question, options = {}) => {
                return new Promise((resolveWait, rejectWait) => {
                    const waitKey = `${resolvedBotToken}_${userId}`;
                    
                    botInstance.sendMessage(chatId, question, options)
                        .then(() => {
                            if (nextCommandHandlers) {
                                nextCommandHandlers.set(waitKey, {
                                    resolve: resolveWait,
                                    reject: rejectWait,
                                    timestamp: Date.now()
                                });
                                
                                setTimeout(() => {
                                    if (nextCommandHandlers.has(waitKey)) {
                                        const handler = nextCommandHandlers.get(waitKey);
                                        if (handler?.reject) handler.reject(new Error('Wait for answer timeout'));
                                        nextCommandHandlers.delete(waitKey);
                                    }
                                }, 5 * 60 * 1000);
                            }
                        })
                        .catch(sendError => {
                            rejectWait(new Error('Failed to send question: ' + sendError.message));
                        });
                });
            };

            const wait = (seconds) => new Promise(resolveWait => {
                setTimeout(() => resolveWait(`Waited ${seconds} seconds`), seconds * 1000);
            });

            const extractMetadata = async (target = 'all') => {
                return await apiWrapperInstance.getOriginalResponse(target);
            };

            // Data storage functions
            const userDataFunctions = {
                saveData: async (key, value) => {
                    const { error } = await supabase
                        .from('universal_data')
                        .upsert({
                            data_type: 'user_data',
                            bot_token: resolvedBotToken,
                            user_id: userId.toString(),
                            data_key: key,
                            data_value: JSON.stringify(value),
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'data_type,bot_token,user_id,data_key' });

                    if (error) {
                        console.error('❌ Save data error:', error);
                        throw new Error(`Failed to save data: ${error.message}`);
                    }
                    return value;
                },
                
                getData: async (key) => {
                    const { data, error } = await supabase
                        .from('universal_data')
                        .select('data_value')
                        .eq('data_type', 'user_data')
                        .eq('bot_token', resolvedBotToken)
                        .eq('user_id', userId.toString())
                        .eq('data_key', key)
                        .single();

                    if (error?.code === 'PGRST116') return null;
                    if (error) {
                        console.error('❌ Get data error:', error);
                        return null;
                    }
                    if (!data?.data_value) return null;

                    try {
                        return JSON.parse(data.data_value);
                    } catch {
                        return data.data_value;
                    }
                },
                
                deleteData: async (key) => {
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
                    return true;
                },

                increment: async (key, amount = 1) => {
                    const current = await userDataFunctions.getData(key) || 0;
                    const newValue = parseInt(current) + parseInt(amount);
                    await userDataFunctions.saveData(key, newValue);
                    return newValue;
                }
            };

            const botDataFunctions = {
                saveData: async (key, value) => {
                    const { data: existingData } = await supabase
                        .from('universal_data')
                        .select('id')
                        .eq('data_type', 'bot_data')
                        .eq('bot_token', resolvedBotToken)
                        .eq('data_key', key)
                        .single();

                    let result;
                    
                    if (existingData) {
                        result = await supabase
                            .from('universal_data')
                            .update({
                                data_value: JSON.stringify(value),
                                updated_at: new Date().toISOString()
                            })
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', resolvedBotToken)
                            .eq('data_key', key);
                    } else {
                        result = await supabase
                            .from('universal_data')
                            .insert({
                                data_type: 'bot_data',
                                bot_token: resolvedBotToken,
                                data_key: key,
                                data_value: JSON.stringify(value),
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });
                    }

                    if (result.error) {
                        console.error('❌ Save bot data error:', result.error);
                        throw new Error(`Failed to save bot data: ${result.error.message}`);
                    }
                    return value;
                },
                
                getData: async (key) => {
                    const { data, error } = await supabase
                        .from('universal_data')
                        .select('data_value')
                        .eq('data_type', 'bot_data')
                        .eq('bot_token', resolvedBotToken)
                        .eq('data_key', key)
                        .single();

                    if (error?.code === 'PGRST116') return null;
                    if (error) {
                        console.error('❌ Get bot data error:', error);
                        return null;
                    }
                    if (!data?.data_value) return null;

                    try {
                        return JSON.parse(data.data_value);
                    } catch {
                        return data.data_value;
                    }
                }
            };

            // Create bot object with ALL methods properly exposed
            const botObject = {
                // Core Telegram methods
                sendMessage: (text, options) => apiWrapperInstance.sendMessage(text, options),
                sendPhoto: (photo, options) => apiWrapperInstance.sendPhoto(photo, options),
                sendDocument: (document, options) => apiWrapperInstance.sendDocument(document, options),
                sendVideo: (video, options) => apiWrapperInstance.sendVideo(video, options),
                sendAudio: (audio, options) => apiWrapperInstance.sendAudio(audio, options),
                sendVoice: (voice, options) => apiWrapperInstance.sendVoice(voice, options),
                sendLocation: (latitude, longitude, options) => apiWrapperInstance.sendLocation(latitude, longitude, options),
                sendVenue: (latitude, longitude, title, address, options) => apiWrapperInstance.sendVenue(latitude, longitude, title, address, options),
                sendContact: (phoneNumber, firstName, options) => apiWrapperInstance.sendContact(phoneNumber, firstName, options),
                sendPoll: (question, options, pollOptions) => apiWrapperInstance.sendPoll(question, options, pollOptions),
                sendDice: (options) => apiWrapperInstance.sendDice(options),
                sendSticker: (sticker, options) => apiWrapperInstance.sendSticker(sticker, options),
                sendChatAction: (action) => apiWrapperInstance.sendChatAction(action),
                sendMediaGroup: (media) => apiWrapperInstance.sendMediaGroup(media),
                forwardMessage: (fromChatId, messageId) => apiWrapperInstance.forwardMessage(fromChatId, messageId),
                copyMessage: (fromChatId, messageId) => apiWrapperInstance.copyMessage(fromChatId, messageId),
                deleteMessage: (messageId) => apiWrapperInstance.deleteMessage(messageId),
                
                // Chat methods
                getChat: () => apiWrapperInstance.getChat(),
                getChatAdministrators: () => apiWrapperInstance.getChatAdministrators(),
                getChatMemberCount: () => apiWrapperInstance.getChatMemberCount(),
                getChatMember: (userId) => apiWrapperInstance.getChatMember(userId),
                getMe: () => apiWrapperInstance.getMe(),
                setChatTitle: (title) => apiWrapperInstance.setChatTitle(title),
                banChatMember: (userId) => apiWrapperInstance.banChatMember(userId),
                unbanChatMember: (userId) => apiWrapperInstance.unbanChatMember(userId),
                
                // Enhanced methods
                send: (text, options) => apiWrapperInstance.send(text, options),
                reply: (text, options) => apiWrapperInstance.reply(text, options),
                sendImage: (photo, caption, options) => apiWrapperInstance.sendImage(photo, caption, options),
                sendFile: (document, caption, options) => apiWrapperInstance.sendFile(document, caption, options),
                sendVideoFile: (video, caption, options) => apiWrapperInstance.sendVideoFile(video, caption, options),
                sendAudioFile: (audio, caption, options) => apiWrapperInstance.sendAudioFile(audio, caption, options),
                sendVoiceMessage: (voice, caption, options) => apiWrapperInstance.sendVoiceMessage(voice, caption, options),
                sendLocationMsg: (latitude, longitude, options) => apiWrapperInstance.sendLocationMsg(latitude, longitude, options),
                sendVenueMsg: (latitude, longitude, title, address, options) => apiWrapperInstance.sendVenueMsg(latitude, longitude, title, address, options),
                sendContactMsg: (phoneNumber, firstName, options) => apiWrapperInstance.sendContactMsg(phoneNumber, firstName, options),
                sendKeyboard: (text, buttons, options) => apiWrapperInstance.sendKeyboard(text, buttons, options),
                sendReplyKeyboard: (text, buttons, options) => apiWrapperInstance.sendReplyKeyboard(text, buttons, options),
                removeKeyboard: (text, options) => apiWrapperInstance.removeKeyboard(text, options),
                sendPollMsg: (question, options, pollOptions) => apiWrapperInstance.sendPollMsg(question, options, pollOptions),
                sendQuiz: (question, options, correctOptionId, quizOptions) => apiWrapperInstance.sendQuiz(question, options, correctOptionId, quizOptions),
                sendDiceMsg: (emoji, options) => apiWrapperInstance.sendDiceMsg(emoji, options),
                sendMarkdown: (text, options) => apiWrapperInstance.sendMarkdown(text, options),
                replyMarkdown: (text, options) => apiWrapperInstance.replyMarkdown(text, options),
                
                // Utility methods
                wait: apiWrapperInstance.wait,
                waitForAnswer: apiWrapperInstance.waitForAnswer,
                ask: apiWrapperInstance.ask,
                runPython: apiWrapperInstance.runPython,
                executePython: runPythonSync,
                
                // Metadata methods
                metaData: apiWrapperInstance.metaData,
                metadata: apiWrapperInstance.metadata,
                getMeta: apiWrapperInstance.getMeta,
                inspect: apiWrapperInstance.inspect,
                getOriginalResponse: apiWrapperInstance.getOriginalResponse,
                analyzeContext: apiWrapperInstance.analyzeContext,
                getContext: apiWrapperInstance.getContext,
                
                // User methods
                getUser: apiWrapperInstance.getUser,
                getCurrentUser: createUserObject,
                
                // Markdown utility
                escapeMarkdown: apiWrapperInstance.escapeMarkdown
            };

            // Execution environment
            const executionEnv = {
                // Core functions
                getUser: createUserObject,
                getCurrentUser: createUserObject,
                
                // Bot instances - ALL variations
                Bot: botObject,
                bot: botObject,
                api: botObject,
                Api: botObject,
                API: botObject,
                
                // Context data
                msg, 
                chatId, 
                userId, 
                userInput, 
                botToken: resolvedBotToken,
                params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
                
                // Utility functions
                wait, 
                delay: wait, 
                sleep: wait,
                runPython: runPythonSync, 
                executePython: runPythonSync,
                waitForAnswer, 
                ask: waitForAnswer,
                
                // Metadata functions
                metaData: extractMetadata, 
                metadata: extractMetadata,
                getMeta: extractMetadata, 
                inspect: extractMetadata,
                
                // Data storage
                User: userDataFunctions,
                BotData: botDataFunctions,
                
                // Direct message functions (legacy support)
                sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                send: (text, options) => botInstance.sendMessage(chatId, text, options)
            };

            // Execute with auto-await and proper error handling
            const executeWithAutoAwait = async (userCode, env) => {
                try {
                    // Process code for auto-await
                    let processedCode = userCode
                        .replace(/User\.saveData\(([^)]+)\)/g, 'await __autoAwait.UserSave($1)')
                        .replace(/User\.getData\(([^)]+)\)/g, 'await __autoAwait.UserGet($1)')
                        .replace(/BotData\.saveData\(([^)]+)\)/g, 'await __autoAwait.BotDataSave($1)')
                        .replace(/BotData\.getData\(([^)]+)\)/g, 'await __autoAwait.BotDataGet($1)')
                        .replace(/bot\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)');

                    // Auto-await wrapper
                    const autoAwaitWrapper = {
                        UserSave: async (key, value) => await env.User.saveData(key, value),
                        UserGet: async (key) => await env.User.getData(key),
                        BotDataSave: async (key, value) => await env.BotData.saveData(key, value),
                        BotDataGet: async (key) => await env.BotData.getData(key),
                        BotSend: async (text, options) => {
                            try {
                                return await botInstance.sendMessage(env.chatId, text, options);
                            } catch (error) {
                                console.error('❌ BotSend error:', error);
                                throw error;
                            }
                        }
                    };

                    const enhancedEnv = { ...env, __autoAwait: autoAwaitWrapper };
                    
                    const executionFunction = new Function(
                        'env',
                        `with(env) {
                            return (async function() {
                                try {
                                    ${processedCode}
                                    return "Command executed successfully";
                                } catch (error) {
                                    console.error('❌ Command execution error:', error);
                                    try {
                                        await env.bot.sendMessage(env.chatId, "❌ Error: " + error.message);
                                    } catch (sendError) {
                                        console.error('❌ Failed to send error message:', sendError);
                                    }
                                    throw error;
                                }
                            })();
                        }`
                    );

                    return await executionFunction(enhancedEnv);
                    
                } catch (error) {
                    console.error('❌ Auto-await execution error:', error);
                    throw error;
                }
            };

            // Execute command
            console.log('🔧 Executing command code...');
            const result = await executeWithAutoAwait(code, executionEnv);
            console.log('✅ Command executed successfully');
            resolve(result);

        } catch (error) {
            console.error('❌ Command executor error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };