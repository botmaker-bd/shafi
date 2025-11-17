// server/core/command-executor.js - COMPLETELY FIXED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers, waitingAnswers } = context;
            
            // Handle optional fields
            const lastName = context.last_name || '';
            const languageCode = context.language_code || '';
            
            console.log(`🔧 Starting command execution for user ${userId}`);
            
            // ✅ CRITICAL FIX: Import and create ApiWrapper PROPERLY
            const ApiWrapper = require('./api-wrapper');
            
            // Create the context for ApiWrapper
            const apiContext = {
                msg: msg,
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: lastName,
                language_code: languageCode,
                botToken: botToken,
                userInput: userInput,
                nextCommandHandlers: nextCommandHandlers || new Map(),
                waitingAnswers: waitingAnswers || new Map(),
                User: context.User || {},
                Bot: context.Bot || {}
            };
            
            // ✅ Create ApiWrapper instance
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            
            // Parse parameters
            const parseParams = (input) => {
                if (!input) return [];
                const parts = input.split(' ').slice(1);
                return parts.filter(param => param.trim() !== '');
            };

            const params = parseParams(userInput);
            const message = userInput;

            // ✅ FIXED: Create execution environment with PROPER references
            const executionEnv = {
                // === BOT INSTANCES (ALL WORKING) ===
                bot: apiWrapperInstance,      // bot.sendMessage()
                Api: apiWrapperInstance,      // Api.sendMessage()  
                Bot: apiWrapperInstance,      // Bot.sendMessage()
                
                // === USER INFORMATION ===
                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: lastName,
                    language_code: languageCode,
                    chat_id: chatId
                }),
                
                // === MESSAGE & PARAMS ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: params,
                message: message,
                botToken: botToken,
                
                // === DATA STORAGE ===
                User: context.User || {
                    saveData: async (key, value) => {
                        const supabase = require('../config/supabase');
                        await supabase.from('universal_data').upsert({
                            data_type: 'user_data',
                            bot_token: botToken,
                            user_id: userId.toString(),
                            data_key: key,
                            data_value: JSON.stringify(value)
                        });
                    },
                    getData: async (key) => {
                        const supabase = require('../config/supabase');
                        const { data } = await supabase.from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', userId.toString())
                            .eq('data_key', key)
                            .single();
                        return data ? JSON.parse(data.data_value) : null;
                    },
                    deleteData: async (key) => {
                        const supabase = require('../config/supabase');
                        await supabase.from('universal_data')
                            .delete()
                            .eq('data_type', 'user_data')
                            .eq('bot_token', botToken)
                            .eq('user_id', userId.toString())
                            .eq('data_key', key);
                    }
                },
                
                BotData: context.Bot || {
                    saveData: async (key, value) => {
                        const supabase = require('../config/supabase');
                        await supabase.from('universal_data').upsert({
                            data_type: 'bot_data',
                            bot_token: botToken,
                            data_key: key,
                            data_value: JSON.stringify(value)
                        });
                    },
                    getData: async (key) => {
                        const supabase = require('../config/supabase');
                        const { data } = await supabase.from('universal_data')
                            .select('data_value')
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', botToken)
                            .eq('data_key', key)
                            .single();
                        return data ? JSON.parse(data.data_value) : null;
                    },
                    deleteData: async (key) => {
                        const supabase = require('../config/supabase');
                        await supabase.from('universal_data')
                            .delete()
                            .eq('data_type', 'bot_data')
                            .eq('bot_token', botToken)
                            .eq('data_key', key);
                    }
                },
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers || new Map(),
                waitingAnswers: waitingAnswers || new Map(),
                
                // === UTILITY FUNCTIONS ===
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // === PYTHON RUNNER ===
                runPython: function(code) {
        const pythonRunner = require('./python-runner');
        return pythonRunner.runPythonCodeSync(code);
    },
            };

            // ✅ DIRECT FUNCTION SHORTCUTS
            const directFunctions = {
                sendMessage: (text, options) => {
                    return botInstance.sendMessage(chatId, text, options);
                },
                send: (text, options) => {
                    return botInstance.sendMessage(chatId, text, options);
                },
                reply: (text, options) => {
                    return botInstance.sendMessage(chatId, text, {
                        reply_to_message_id: msg.message_id,
                        ...options
                    });
                },
                sendPhoto: (photo, options) => {
                    return botInstance.sendPhoto(chatId, photo, options);
                },
                sendDocument: (doc, options) => {
                    return botInstance.sendDocument(chatId, doc, options);
                },
                getUser: () => executionEnv.getUser(),
                wait: (ms) => executionEnv.wait(ms),
                runPython: (code) => executionEnv.runPython(code)
            };

            // ✅ WAIT FOR ANSWER IMPLEMENTATION
            const waitForAnswer = async (question, options = {}) => {
                return new Promise(async (resolve) => {
                    try {
                        // First send the question
                        await directFunctions.sendMessage(question, options);
                        
                        // Create unique key for this waiting answer
                        const waitKey = `${botToken}_${userId}_${Date.now()}`;
                        
                        // Store the resolver in waitingAnswers map
                        if (waitingAnswers) {
                            waitingAnswers.set(waitKey, resolve);
                        }
                        
                        // Set timeout to clean up (5 minutes)
                        setTimeout(() => {
                            if (waitingAnswers && waitingAnswers.has(waitKey)) {
                                waitingAnswers.delete(waitKey);
                                resolve(null); // Return null on timeout
                            }
                        }, 5 * 60 * 1000);
                        
                    } catch (error) {
                        console.error('WaitForAnswer error:', error);
                        resolve(null);
                    }
                });
            };

            // Merge all functions
            const finalContext = {
                ...executionEnv,
                ...directFunctions,
                waitForAnswer: waitForAnswer,
                ask: waitForAnswer
            };

            // Execution code
            const executionCode = `
                try {
                    // All variables are available
                    const user = getUser();
                    
                    // Test all methods
                    console.log('✅ Execution started');
                    console.log('🤖 User:', user.first_name);
                    
                    // User's code
                    ${code}
                    
                    return "Command completed";
                } catch (error) {
                    console.error('❌ Execution error:', error);
                    // Still send error message to user
                    try {
                        sendMessage(\`❌ Error: \${error.message}\`);
                    } catch (e) {
                        // If sendMessage fails, at least log it
                        console.error('Failed to send error message:', e);
                    }
                    throw error;
                }
            `;

            // Execute
            console.log('🚀 Executing command...');
            const commandFunction = new Function('getUser', 'sendMessage', 'bot', 'Api', 'Bot', 'params', 'message', 'User', 'BotData', 'waitForAnswer', 'wait', 'runPython', executionCode);
            
            const result = await commandFunction(
                finalContext.getUser,
                finalContext.sendMessage,
                finalContext.bot,
                finalContext.Api,
                finalContext.Bot,
                finalContext.params,
                finalContext.message,
                finalContext.User,
                finalContext.BotData,
                finalContext.waitForAnswer,
                finalContext.wait,
                finalContext.runPython
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