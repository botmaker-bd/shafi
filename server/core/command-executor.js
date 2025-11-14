// server/core/command-executor.js - সম্পূর্ণ ঠিক করা ভার্সন
async function executeCommandCode(bot, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, User, Bot } = context;
            
            // Create comprehensive execution environment
            const executionEnv = {
                // ✅ Bot instance - সরাসরি bot object
                bot: bot,
                
                // ✅ Bot functions with proper context
                sendMessage: (text, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                send: (text, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                reply: (text, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        reply_to_message_id: msg.message_id,
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                // Media functions
                sendPhoto: (photo, options = {}) => {
                    return bot.sendPhoto(chatId, photo, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                sendVideo: (video, options = {}) => {
                    return bot.sendVideo(chatId, video, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                sendDocument: (document, options = {}) => {
                    return bot.sendDocument(chatId, document, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                sendAudio: (audio, options = {}) => {
                    return bot.sendAudio(chatId, audio, {
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                // User information
                getUser: () => ({
                    id: userId,
                    username: username,
                    first_name: first_name,
                    chat_id: chatId
                }),
                
                // Command context
                params: userInput,
                userInput: userInput,
                message: msg,
                chatId: chatId,
                userId: userId,
                
                // Data storage
                User: User,
                Bot: Bot,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // Wait for answer functionality
                waitForAnswer: (question, options = {}) => {
                    return new Promise((resolve, reject) => {
                        const nextCommandKey = `${botToken}_${userId}`;
                        
                        // Send question first
                        bot.sendMessage(chatId, question, {
                            parse_mode: 'HTML',
                            ...options
                        }).then(() => {
                            // Set up handler for next message
                            const botManager = require('./bot-manager');
                            botManager.nextCommandHandlers.set(nextCommandKey, (answer) => {
                                resolve(answer);
                            });
                        }).catch(reject);
                    });
                },
                
                // HTTP functions (if available)
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
                },
                
                // Python runner (if available)
                runPython: async (pythonCode) => {
                    try {
                        const pythonRunner = require('./python-runner');
                        return await pythonRunner.runPythonCode(pythonCode);
                    } catch (error) {
                        throw new Error(`Python execution failed: ${error.message}`);
                    }
                }
            };

            // ✅ IMPORTANT: Create a function that exposes ALL variables to the execution context
            const executionCode = `
                // Inject all variables into the execution context
                const { ${Object.keys(executionEnv).join(', ')} } = this.executionEnv;
                
                // User code execution
                try {
                    ${code}
                } catch (error) {
                    console.error('Command execution error:', error);
                    throw error;
                }
            `;

            // Create execution context with all variables
            const executionContext = {
                executionEnv: executionEnv
            };

            // Execute the command code
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionContext);
            
            const result = boundFunction();
            
            // Handle async commands
            if (result && typeof result.then === 'function') {
                const finalResult = await result;
                resolve(finalResult);
            } else {
                resolve(result);
            }

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };