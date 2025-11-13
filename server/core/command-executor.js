// server/core/command-executor.js - ঠিক করা ভার্সন
async function executeCommandCode(bot, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, User, Bot } = context;
            
            // Create safe execution environment
            const botFunctions = {
                // Basic messaging
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
                
                // Media messages
                sendPhoto: (photo, options = {}) => {
                    return bot.sendPhoto(chatId, photo, {
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
                
                // User information
                getUser: () => ({
                    id: userId,
                    username: username,
                    first_name: first_name,
                    chat_id: chatId
                }),
                
                // Command parameters
                params: userInput,
                userInput: userInput,
                
                // Message object
                message: msg,
                
                // Data storage
                User: User,
                Bot: Bot,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // Wait for answer functionality
                waitForAnswer: (question, options = {}) => {
                    return new Promise((resolve) => {
                        const nextCommandKey = `${botToken}_${userId}`;
                        
                        // Send question first
                        bot.sendMessage(chatId, question, options).then(() => {
                            // Set up handler for next message
                            botManager.nextCommandHandlers.set(nextCommandKey, (answer) => {
                                resolve(answer);
                            });
                        }).catch(reject);
                    });
                }
            };

            // Execute the command code in a safe context
            const commandFunction = new Function(
                ...Object.keys(botFunctions),
                `
                "use strict";
                try {
                    ${code}
                } catch (error) {
                    console.error('Command execution error:', error);
                    throw error;
                }
                `
            );

            // Call the function with all the bot functions as parameters
            const result = commandFunction(...Object.values(botFunctions));
            
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