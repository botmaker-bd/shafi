// server/core/command-executor.js - COMPLETELY UPDATED
async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput } = context;
            
            // Create COMPREHENSIVE execution environment
            const executionEnv = {
                // === TELEGRAM BOT METHODS ===
                // Direct bot instance (for advanced users)
                bot: botInstance,
                
                // === API WRAPPER INSTANCE ===
                Api: new (require('./api-wrapper'))(botInstance, context),
                
                // === USER INFORMATION ===
                getUser: () => ({
                    id: userId,
                    username: username,
                    first_name: first_name,
                    chat_id: chatId
                }),
                
                // === MESSAGE CONTEXT ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                
                // === DATA STORAGE ===
                User: context.User,
                Bot: context.Bot,
                
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

            // Create SHORTCUT functions that call the Api wrapper
            const shortcuts = {
                // Message shortcuts
                sendMessage: (text, options) => executionEnv.Api.sendMessage(text, options),
                send: (text, options) => executionEnv.Api.send(text, options),
                reply: (text, options) => executionEnv.Api.reply(text, options),
                
                // Media shortcuts
                sendPhoto: (photo, options) => executionEnv.Api.sendPhoto(photo, options),
                sendDocument: (doc, options) => executionEnv.Api.sendDocument(doc, options),
                sendVideo: (video, options) => executionEnv.Api.sendVideo(video, options),
                
                // Keyboard shortcuts
                sendKeyboard: (text, buttons, options) => executionEnv.Api.sendKeyboard(text, buttons, options),
                
                // Python integration
                runPython: (code) => executionEnv.Api.runPython(code),
                
                // Wait for answer
                waitForAnswer: (question, options) => executionEnv.Api.waitForAnswer(question, options)
            };

            // Merge everything into final execution context
            const finalContext = {
                ...executionEnv,
                ...shortcuts,
                
                // Make bot available as both 'bot' and 'Bot'
                Bot: executionEnv.Api, // Alias for backward compatibility
                
                // Make Api available as both 'Api' and 'api'
                api: executionEnv.Api
            };

            // Enhanced execution code with ALL variables injected
            const executionCode = `
                // Inject ALL variables into execution context
                const { 
                    bot, Api, api, Bot, getUser, User, 
                    msg, chatId, userId, userInput, params,
                    sendMessage, send, reply, sendPhoto, sendDocument, sendVideo,
                    sendKeyboard, runPython, waitForAnswer, wait, HTTP
                } = this.context;

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
            `;

            const executionWrapper = {
                context: finalContext
            };

            // Execute the command
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionWrapper);
            
            const result = await boundFunction();
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };