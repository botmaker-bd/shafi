// server/core/command-executor.js - FIXED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers, waitingAnswers } = context;
            
            // FIX: Handle optional fields safely
            const lastName = context.last_name || '';
            const languageCode = context.language_code || '';
            
            console.log(`🔧 Starting command execution for user ${userId}`);
            
            // Create ApiWrapper instance FIRST
            const ApiWrapper = require('./api-wrapper');
            const apiWrapperInstance = new ApiWrapper(botInstance, {
                msg: msg,
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: lastName,
                language_code: languageCode,
                botToken: botToken,
                userInput: userInput,
                nextCommandHandlers: nextCommandHandlers,
                waitingAnswers: waitingAnswers,
                User: context.User,
                Bot: context.Bot
            });

            // Create COMPREHENSIVE execution environment with SAFE variables
            const executionEnv = {
                // === TELEGRAM BOT INSTANCE (bot.) ===
                bot: apiWrapperInstance, // ✅ FIXED: This makes bot. work
                
                // === API WRAPPER INSTANCE (Api.) ===
                Api: apiWrapperInstance,
                
                // === ALIAS FOR Bot. ===
                Bot: apiWrapperInstance,

                // === USER INFORMATION ===
                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: lastName,
                    language_code: languageCode,
                    chat_id: chatId
                }),
                
                // === MESSAGE CONTEXT ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                botToken: botToken,
                
                // === DATA STORAGE ===
                User: context.User,
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers,
                waitingAnswers: waitingAnswers,
                
                // === UTILITY FUNCTIONS ===
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // === PYTHON RUNNER ===
                runPython: async (pythonCode) => {
                    const pythonRunner = require('./python-runner');
                    return await pythonRunner.runPythonCode(pythonCode);
                },
                
                // === HTTP CLIENT ===
                HTTP: {
                    get: async (url, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.get(url, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP GET failed: ${error.message}`);
                        }
                    },
                    post: async (url, data = {}, options = {}) => {
                        const axios = require('axios');
                        try {
                            const response = await axios.post(url, data, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP POST failed: ${error.message}`);
                        }
                    }
                }
            };

            // Create SHORTCUT functions that DIRECTLY use apiWrapperInstance
            const shortcuts = {
                // ✅ FIXED: Direct shortcuts using apiWrapperInstance
                sendMessage: (text, options) => apiWrapperInstance.sendMessage(text, options),
                send: (text, options) => apiWrapperInstance.send(text, options),
                reply: (text, options) => apiWrapperInstance.reply(text, options),
                sendPhoto: (photo, options) => apiWrapperInstance.sendPhoto(photo, options),
                sendDocument: (doc, options) => apiWrapperInstance.sendDocument(doc, options),
                sendVideo: (video, options) => apiWrapperInstance.sendVideo(video, options),
                sendKeyboard: (text, buttons, options) => apiWrapperInstance.sendKeyboard(text, buttons, options),
                sendReplyKeyboard: (text, buttons, options) => apiWrapperInstance.sendReplyKeyboard(text, buttons, options),
                waitForAnswer: (question, options) => apiWrapperInstance.waitForAnswer(question, options),
                ask: (question, options) => apiWrapperInstance.waitForAnswer(question, options)
            };

            // Merge everything into final execution context
            const finalContext = {
                ...executionEnv,
                ...shortcuts
            };

            // Enhanced execution code with PROPER async handling
            const executionCode = `
                // Inject ALL variables into execution context
                const { 
                    bot, Api, Bot, getUser, User, 
                    msg, chatId, userId, userInput, params,
                    sendMessage, send, reply, sendPhoto, sendDocument, sendVideo,
                    sendKeyboard, sendReplyKeyboard, runPython, waitForAnswer, ask, wait, HTTP,
                    nextCommandHandlers, waitingAnswers, botToken
                } = this.context;

                console.log('🔧 User code execution starting...');
                console.log('🤖 Bot methods available:');
                console.log('  - bot.sendMessage:', typeof bot.sendMessage);
                console.log('  - Api.sendMessage:', typeof Api.sendMessage);
                console.log('  - Bot.sendMessage:', typeof Bot.sendMessage);
                console.log('  - sendMessage:', typeof sendMessage);

                // Create an async wrapper for the user's code
                const executeUserCode = async () => {
                    try {
                        // User's command code
                        ${code}
                        
                        // If no explicit return, return success
                        return "Command executed successfully";
                    } catch (error) {
                        console.error('❌ Command execution error:', error);
                        throw error;
                    }
                };

                // Execute and return the promise
                return executeUserCode();
            `;

            const executionWrapper = {
                context: finalContext
            };

            // Execute the command
            console.log('🚀 Executing user command code...');
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionWrapper);
            
            const result = await boundFunction();
            console.log('✅ Command execution completed successfully');
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };