// server/core/command-executor.js - FIXED VERSION
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
                return apiWrapperInstance.waitForAnswer(question, options);
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
                            data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'data_type,bot_token,user_id,data_key' });

                    if (error) throw new Error(`Failed to save data: ${error.message}`);
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
                    if (error || !data?.data_value) return null;

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

                    if (error) throw new Error(`Failed to delete data: ${error.message}`);
                    return true;
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
                                data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
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
                                data_value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });
                    }

                    if (result.error) throw new Error(`Failed to save bot data: ${result.error.message}`);
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
                    if (error || !data?.data_value) return null;

                    try {
                        return JSON.parse(data.data_value);
                    } catch {
                        return data.data_value;
                    }
                }
            };

            // Create bot object
            const botObject = {
                ...apiWrapperInstance,
                metaData: extractMetadata,
                metadata: extractMetadata,
                getMeta: extractMetadata,
                inspect: extractMetadata,
                wait: wait,
                delay: wait,
                sleep: wait,
                runPython: runPythonSync,
                executePython: runPythonSync,
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer,
                escapeMarkdown: apiWrapperInstance.escapeMarkdown,
                sendMarkdown: apiWrapperInstance.sendMarkdown
            };

            // Execution environment
            const executionEnv = {
                // Core functions
                getUser: createUserObject,
                getCurrentUser: createUserObject,
                
                // Bot instances
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
                
                // Direct message functions
                sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
                send: (text, options) => botInstance.sendMessage(chatId, text, options),
                
                // Markdown helpers
                escapeMarkdown: apiWrapperInstance.escapeMarkdown,
                sendMarkdown: apiWrapperInstance.sendMarkdown
            };

            // Execute with auto-await
            const executeWithAutoAwait = async (userCode, env) => {
                try {
                    // Process code for auto-await
                    let processedCode = userCode
                        .replace(/User\.saveData\(([^)]+)\)/g, 'await __autoAwait.UserSave($1)')
                        .replace(/User\.getData\(([^)]+)\)/g, 'await __autoAwait.UserGet($1)')
                        .replace(/BotData\.saveData\(([^)]+)\)/g, 'await __autoAwait.BotDataSave($1)')
                        .replace(/BotData\.getData\(([^)]+)\)/g, 'await __autoAwait.BotDataGet($1)')
                        .replace(/bot\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)')
                        .replace(/Bot\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)')
                        .replace(/api\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)')
                        .replace(/Api\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)')
                        .replace(/API\.sendMessage\(([^)]+)\)/g, 'await __autoAwait.BotSend($1)');

                    // Auto-await wrapper
                    const autoAwaitWrapper = {
                        UserSave: async (key, value) => await env.User.saveData(key, value),
                        UserGet: async (key) => await env.User.getData(key),
                        BotDataSave: async (key, value) => await env.BotData.saveData(key, value),
                        BotDataGet: async (key) => await env.BotData.getData(key),
                        BotSend: async (text, options) => await botInstance.sendMessage(env.chatId, text, options)
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
                                    try {
                                        await env.bot.sendMessage(env.chatId, "❌ Error: " + error.message);
                                    } catch (sendError) {}
                                    throw error;
                                }
                            })();
                        }`
                    );

                    return await executionFunction(enhancedEnv);
                    
                } catch (error) {
                    throw error;
                }
            };

            // Execute command
            const result = await executeWithAutoAwait(code, executionEnv);
            resolve(result);

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };