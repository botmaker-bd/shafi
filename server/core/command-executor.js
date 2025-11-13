const { runPythonCode } = require('./python-runner');

function executeCommandCode(bot, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, Data, Python } = context;
            
            // Create safe execution environment with all necessary functions
            const botFunctions = {
                // Basic messaging
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
                
                sendVideo: (video, options = {}) => {
                    return bot.sendVideo(chatId, video, {
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
                
                sendSticker: (sticker, options = {}) => {
                    return bot.sendSticker(chatId, sticker, options);
                },
                
                // Interactive elements
                sendMenu: (text, buttons, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        reply_markup: {
                            inline_keyboard: Array.isArray(buttons[0]) ? buttons : [buttons]
                        },
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                sendKeyboard: (text, keyboard, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        reply_markup: {
                            keyboard: Array.isArray(keyboard[0]) ? keyboard : [keyboard],
                            resize_keyboard: true,
                            one_time_keyboard: options.one_time || false
                        },
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                removeKeyboard: (text, options = {}) => {
                    return bot.sendMessage(chatId, text, {
                        reply_markup: { remove_keyboard: true },
                        parse_mode: 'HTML',
                        ...options
                    });
                },
                
                // Message actions
                showTyping: () => {
                    return bot.sendChatAction(chatId, 'typing');
                },
                
                showUploadingPhoto: () => {
                    return bot.sendChatAction(chatId, 'upload_photo');
                },
                
                deleteMessage: (messageId = null) => {
                    return bot.deleteMessage(chatId, messageId || msg.message_id);
                },
                
                editMessage: (newText, options = {}) => {
                    return bot.editMessageText(newText, {
                        chat_id: chatId,
                        message_id: msg.message_id,
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
                
                // Data storage (universal)
                Data: Data,
                
                // Python execution
                Python: Python,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // Next command handler
                nextCommand: (handlerCode) => {
                    const nextCommandKey = `${botToken}_${userId}`;
                    const handler = async (input, originalMsg) => {
                        try {
                            const newContext = {
                                ...context,
                                msg: originalMsg || msg,
                                userInput: input
                            };
                            await executeCommandCode(bot, handlerCode, newContext);
                        } catch (error) {
                            console.error('❌ Next command handler error:', error);
                            try {
                                await bot.sendMessage(chatId, '❌ Error processing your response.');
                            } catch (sendError) {
                                console.error('❌ Failed to send error message:', sendError);
                            }
                        }
                    };
                    
                    const botManager = require('./bot-manager');
                    botManager.nextCommandHandlers.set(nextCommandKey, handler);
                },
                
                // Ask user for input (simplified)
                ask: (question, handlerCode) => {
                    const nextCommandKey = `${botToken}_${userId}`;
                    
                    const handler = async (input, originalMsg) => {
                        try {
                            const newContext = {
                                ...context,
                                msg: originalMsg || msg,
                                userInput: input
                            };
                            await executeCommandCode(bot, handlerCode, newContext);
                        } catch (error) {
                            console.error('❌ Ask handler error:', error);
                            try {
                                await bot.sendMessage(chatId, '❌ Error processing your response.');
                            } catch (sendError) {
                                console.error('❌ Failed to send error message:', sendError);
                            }
                        }
                    };
                    
                    const botManager = require('./bot-manager');
                    botManager.nextCommandHandlers.set(nextCommandKey, handler);
                    
                    return bot.sendMessage(chatId, question, { parse_mode: 'HTML' });
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
                await result;
            }
            
            resolve(result);
        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };