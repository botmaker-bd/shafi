// server/core/command-executor.js - UPDATED VERSION
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers, waitingAnswers } = context;
            
            // FIX: Handle optional fields safely
            const lastName = context.last_name || '';
            const languageCode = context.language_code || '';
            
            console.log(`🔧 Starting command execution for user ${userId}`);
            
            // Create COMPREHENSIVE execution environment with SAFE variables
            const executionEnv = {
                // === TELEGRAM BOT METHODS ===
                bot: botInstance,
                
                // === API WRAPPER INSTANCE ===
                Api: new (require('./api-wrapper'))(botInstance, {
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
                    waitingAnswers: waitingAnswers, // ✅ ADDED: For waitForAnswer()
                    User: context.User,
                    Bot: context.Bot
                }),
                
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
                params: userInput, // For answer handlers
                botToken: botToken,
                
                // === DATA STORAGE ===
                User: context.User,
                Bot: context.Bot,
                
                // === HANDLERS ===
                nextCommandHandlers: nextCommandHandlers,
                waitingAnswers: waitingAnswers, // ✅ ADDED: For waitForAnswer()
                
                // === UTILITY FUNCTIONS ===
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
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

            // Create SHORTCUT functions
            const shortcuts = {
                sendMessage: (text, options) => executionEnv.Api.sendMessage(text, options),
                send: (text, options) => executionEnv.Api.send(text, options),
                reply: (text, options) => executionEnv.Api.reply(text, options),
                sendPhoto: (photo, options) => executionEnv.Api.sendPhoto(photo, options),
                sendDocument: (doc, options) => executionEnv.Api.sendDocument(doc, options),
                sendVideo: (video, options) => executionEnv.Api.sendVideo(video, options),
                sendKeyboard: (text, buttons, options) => executionEnv.Api.sendKeyboard(text, buttons, options),
                runPython: (code) => executionEnv.Api.runPython(code),
                waitForAnswer: (question, options) => executionEnv.Api.waitForAnswer(question, options),
                ask: (question, options) => executionEnv.Api.ask(question, options) // ✅ ADDED: Simple ask method
            };

            // Merge everything into final execution context
            const finalContext = {
                ...executionEnv,
                ...shortcuts,
                Bot: executionEnv.Api,
                api: executionEnv.Api
            };

            // Enhanced execution code with PROPER async handling
            const executionCode = `
                // Inject ALL variables into execution context
                const { 
                    bot, Api, api, Bot, getUser, User, 
                    msg, chatId, userId, userInput, params,
                    sendMessage, send, reply, sendPhoto, sendDocument, sendVideo,
                    sendKeyboard, runPython, waitForAnswer, ask, wait, HTTP,
                    nextCommandHandlers, waitingAnswers, botToken
                } = this.context;

                console.log('🔧 User code execution starting...');
                console.log('🤖 Bot Token available:', typeof botToken !== 'undefined');
                console.log('📊 nextCommandHandlers available:', !!nextCommandHandlers);
                console.log('⏳ waitingAnswers available:', !!waitingAnswers);

                // Create an async wrapper for the user's code
                const executeUserCode = async () => {
                    try {
                        // User's command code
                        ${code}
                        
                        // If no explicit return, return success
                        if (typeof result === 'undefined') {
                            return "Command executed successfully";
                        }
                        return result;
                    } catch (error) {
                        console.error('Command execution error:', error);
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