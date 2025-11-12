const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const supabase = require('../config/supabase');

// Store active bots and their commands
const activeBots = new Map();
const botCommands = new Map();
const waitingForAnswer = new Map();

// Initialize all bots on startup
async function initializeAllBots() {
    try {
        console.log('🔄 Initializing all bots...');
        const { data: bots, error } = await supabase
            .from('bots')
            .select('token, name')
            .eq('is_active', true);

        if (error) throw error;

        let initializedCount = 0;
        let failedCount = 0;
        
        for (const bot of bots) {
            try {
                if (bot.token.includes('123456789') || bot.token.includes('987654321')) {
                    console.log(`⏭️ Skipping demo bot: ${bot.name}`);
                    continue;
                }
                
                await initializeBot(bot.token);
                initializedCount++;
            } catch (botError) {
                console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
                failedCount++;
            }
        }
        
        console.log(`✅ Bot initialization completed: ${initializedCount} successful, ${failedCount} failed`);
        
    } catch (error) {
        console.error('❌ Initialize all bots error:', error);
    }
}

// Initialize a single bot
async function initializeBot(token) {
    try {
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const bot = new TelegramBot(token, { 
            polling: true,
            request: {
                timeout: 10000,
                agentOptions: {
                    keepAlive: true,
                    maxSockets: 100
                }
            }
        });

        await bot.getMe();

        botCommands.set(token, commands || []);
        
        bot.on('message', async (msg) => {
            await handleMessage(bot, token, msg);
        });

        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, token, callbackQuery);
        });

        activeBots.set(token, bot);
        
        console.log(`✅ Bot initialized: ${token.substring(0, 15)}... with ${commands?.length || 0} commands`);
        
        return true;
    } catch (error) {
        console.error(`❌ Initialize bot error for ${token.substring(0, 15)}...:`, error.message);
        throw error;
    }
}

// Handle incoming messages
async function handleMessage(bot, token, msg) {
    try {
        if (!msg.text) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const userId = msg.from.id;

        console.log(`📩 Message from ${msg.from.first_name}: "${text}"`);

        // Check if waiting for answer
        const waitKey = `${token}_${userId}`;
        if (waitingForAnswer.has(waitKey)) {
            const waitData = waitingForAnswer.get(waitKey);
            waitingForAnswer.delete(waitKey);
            
            if (waitData.answerHandler) {
                console.log(`🔄 Processing answer for command: ${waitData.commandName}`);
                await executeAnswerHandler(bot, waitData.answerHandler, msg, waitData.originalMessage);
            }
            return;
        }

        const commands = botCommands.get(token) || [];
        let matchedCommand = null;

        // Find matching command from multiple patterns
        for (const cmd of commands) {
            const patterns = cmd.pattern.split(',').map(p => p.trim());
            for (const pattern of patterns) {
                if (text === pattern || text.startsWith(pattern + ' ')) {
                    matchedCommand = cmd;
                    break;
                }
            }
            if (matchedCommand) break;
        }

        if (matchedCommand) {
            console.log(`🎯 Executing command: ${matchedCommand.name}`);
            await executeCommand(bot, matchedCommand, msg);
        }

    } catch (error) {
        console.error('❌ Handle message error:', error);
        try {
            await bot.sendMessage(msg.chat.id, 
                '❌ An error occurred while processing your command.',
                { reply_to_message_id: msg.message_id }
            );
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, token, callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.from.id;

        console.log(`🔘 Callback query: ${data}`);

        // Handle command callbacks
        const commands = botCommands.get(token) || [];
        let matchedCommand = null;

        for (const cmd of commands) {
            const patterns = cmd.pattern.split(',').map(p => p.trim());
            for (const pattern of patterns) {
                if (data === pattern || data.startsWith(pattern + ' ')) {
                    matchedCommand = cmd;
                    break;
                }
            }
            if (matchedCommand) break;
        }

        if (matchedCommand) {
            console.log(`🎯 Executing callback command: ${matchedCommand.name}`);
            
            // Create mock message for callback execution
            const mockMsg = {
                chat: { id: chatId },
                from: callbackQuery.from,
                message_id: messageId,
                text: data
            };

            await executeCommand(bot, matchedCommand, mockMsg);
        }

        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('❌ Handle callback query error:', error);
    }
}

// Enhanced execute command
async function executeCommand(bot, command, msg, isTest = false) {
    try {
        const formattedCode = formatCommandCode(command.code);
        
        // If command requires waiting for answer, set up the wait
        if (command.wait_for_answer && command.answer_handler) {
            const waitKey = `${command.bot_token}_${msg.from.id}`;
            waitingForAnswer.set(waitKey, {
                commandName: command.name,
                answerHandler: command.answer_handler,
                originalMessage: msg,
                timestamp: Date.now()
            });
            
            console.log(`⏳ Waiting for answer for command: ${command.name}`);
        }

        const result = await executeCommandCode(bot, formattedCode, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            isTest,
            botToken: command.bot_token,
            waitForAnswer: (timeout = 60000) => waitForUserAnswer(bot, command.bot_token, msg.from.id, timeout)
        });

        return result;

    } catch (error) {
        console.error(`❌ Command "${command.name}" execution error:`, error);
        
        const errorMessage = `❌ Command Execution Error\n\nCommand: ${command.name}\nError: ${error.message}`;

        try {
            await bot.sendMessage(msg.chat.id, errorMessage, {
                reply_to_message_id: msg.message_id
            });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
        
        throw error;
    }
}

// Execute answer handler code
async function executeAnswerHandler(bot, answerHandlerCode, msg, originalMessage) {
    try {
        const formattedCode = formatCommandCode(answerHandlerCode);
        
        await executeCommandCode(bot, formattedCode, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            isTest: false,
            botToken: originalMessage.botToken,
            originalMessage: originalMessage,
            userAnswer: msg.text
        });

    } catch (error) {
        console.error('❌ Answer handler execution error:', error);
        await bot.sendMessage(msg.chat.id, '❌ Error processing your answer.');
    }
}

// Wait for user answer
function waitForUserAnswer(bot, token, userId, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const waitKey = `${token}_${userId}`;
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            waitingForAnswer.delete(waitKey);
            reject(new Error('Timeout waiting for answer'));
        }, timeout);

        // Store resolve function
        waitingForAnswer.set(waitKey, {
            resolve: (answer) => {
                clearTimeout(timeoutId);
                waitingForAnswer.delete(waitKey);
                resolve(answer);
            },
            timestamp: Date.now()
        });
    });
}

// Database functions for user and bot data
async function saveUserData(botToken, userId, key, value) {
    try {
        const { data, error } = await supabase
            .from('user_data')
            .upsert({
                bot_token: botToken,
                user_id: userId,
                data_key: key,
                data_value: typeof value === 'object' ? JSON.stringify(value) : value
            }, {
                onConflict: 'bot_token,user_id,data_key'
            });

        if (error) throw error;
        return value;
    } catch (error) {
        console.error('❌ Save user data error:', error);
        throw error;
    }
}

async function getUserData(botToken, userId, key) {
    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('data_value')
            .eq('bot_token', botToken)
            .eq('user_id', userId)
            .eq('data_key', key)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data && data.data_value) {
            try {
                return JSON.parse(data.data_value);
            } catch {
                return data.data_value;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ Get user data error:', error);
        return null;
    }
}

async function saveBotData(botToken, key, value) {
    try {
        const { data, error } = await supabase
            .from('bot_data')
            .upsert({
                bot_token: botToken,
                data_key: key,
                data_value: typeof value === 'object' ? JSON.stringify(value) : value
            }, {
                onConflict: 'bot_token,data_key'
            });

        if (error) throw error;
        return value;
    } catch (error) {
        console.error('❌ Save bot data error:', error);
        throw error;
    }
}

async function getBotData(botToken, key) {
    try {
        const { data, error } = await supabase
            .from('bot_data')
            .select('data_value')
            .eq('bot_token', botToken)
            .eq('data_key', key)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data && data.data_value) {
            try {
                return JSON.parse(data.data_value);
            } catch {
                return data.data_value;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ Get bot data error:', error);
        return null;
    }
}

// Enhanced command code execution with async/await support
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name, isTest, botToken, waitForAnswer, userAnswer, originalMessage } = context;
    
    // Enhanced available functions for command code
    const safeFunctions = {
        // ===== MESSAGE PROPERTIES =====
        message: msg,
        userAnswer: userAnswer,
        originalMessage: originalMessage,
        
        // ===== CHAT ID SHORTCUTS =====
        u: chatId,
        chat: {
            id: chatId,
            chatid: chatId
        },
        
        // ===== TEXT PROCESSING =====
        KEY: msg.text ? msg.text.split(' ') : [],
        
        // ===== USER DATA MANAGEMENT =====
        User: {
            saveData: (key, value) => saveUserData(botToken, userId, key, value),
            getData: (key) => getUserData(botToken, userId, key),
            deleteData: async (key) => {
                const { error } = await supabase
                    .from('user_data')
                    .delete()
                    .eq('bot_token', botToken)
                    .eq('user_id', userId)
                    .eq('data_key', key);
                return !error;
            }
        },
        
        Bot: {
            saveData: (key, value) => saveBotData(botToken, key, value),
            getData: (key) => getBotData(botToken, key),
            deleteData: async (key) => {
                const { error } = await supabase
                    .from('bot_data')
                    .delete()
                    .eq('bot_token', botToken)
                    .eq('data_key', key);
                return !error;
            }
        },
        
        // ===== USER INFORMATION =====
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User',
            telegramid: userId,
            language_code: msg.from.language_code
        }),
        
        getChat: () => ({
            id: chatId,
            type: msg.chat.type,
            title: msg.chat.title,
            username: msg.chat.username
        }),
        
        // ===== WAIT FOR ANSWER =====
        waitForAnswer: (timeout = 60000) => {
            if (!waitForAnswer) {
                throw new Error('waitForAnswer is not available in this context');
            }
            return waitForAnswer(timeout);
        },
        
        // ===== BOT ACTIONS =====
        bot: {
            // Message sending
            sendMessage: (text, params = {}) => {
                return bot.sendMessage(params.chat_id || chatId, text, {
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup,
                    reply_to_message_id: params.reply_to_message_id,
                    disable_web_page_preview: params.disable_web_page_preview
                });
            },
            
            replyText: (text, params = {}) => {
                return bot.sendMessage(params.chat_id || chatId, text, {
                    parse_mode: params.parse_mode,
                    reply_to_message_id: params.reply_to_message_id || msg.message_id,
                    reply_markup: params.reply_markup
                });
            },
            
            // Media messages
            sendPhoto: (photo, params = {}) => {
                return bot.sendPhoto(params.chat_id || chatId, photo, {
                    caption: params.caption,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            sendVideo: (video, params = {}) => {
                return bot.sendVideo(params.chat_id || chatId, video, {
                    caption: params.caption,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            sendAudio: (audio, params = {}) => {
                return bot.sendAudio(params.chat_id || chatId, audio, {
                    caption: params.caption,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            sendDocument: (document, params = {}) => {
                return bot.sendDocument(params.chat_id || chatId, document, {
                    caption: params.caption,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            sendAnimation: (animation, params = {}) => {
                return bot.sendAnimation(params.chat_id || chatId, animation, {
                    caption: params.caption,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            sendSticker: (sticker, params = {}) => {
                return bot.sendSticker(params.chat_id || chatId, sticker, params);
            },
            
            sendDice: (params = {}) => {
                return bot.sendDice(params.chat_id || chatId, {
                    emoji: params.emoji || '🎲'
                });
            },
            
            // Message management
            editMessageText: (text, params = {}) => {
                return bot.editMessageText(text, {
                    chat_id: params.chat_id || chatId,
                    message_id: params.message_id || msg.message_id,
                    parse_mode: params.parse_mode,
                    reply_markup: params.reply_markup
                });
            },
            
            deleteMessage: (params = {}) => {
                return bot.deleteMessage(
                    params.chat_id || chatId,
                    params.message_id || msg.message_id
                );
            },
            
            // Chat actions
            sendChatAction: (action, params = {}) => {
                return bot.sendChatAction(params.chat_id || chatId, action);
            }
        },
        
        // ===== HTTP REQUESTS =====
        HTTP: {
            get: async (url, options = {}) => {
                try {
                    const response = await axios.get(url, {
                        headers: options.headers || {},
                        timeout: 10000
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP GET failed: ${error.message}`);
                }
            },
            
            post: async (url, data = {}, options = {}) => {
                try {
                    const response = await axios.post(url, data, {
                        headers: options.headers || {},
                        timeout: 10000
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP POST failed: ${error.message}`);
                }
            }
        },
        
        // ===== UTILITY FUNCTIONS =====
        parseInt: (value) => parseInt(value),
        parseFloat: (value) => parseFloat(value),
        JSON: {
            parse: (text) => JSON.parse(text),
            stringify: (obj) => JSON.stringify(obj)
        },
        
        // Utility function for waiting
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        // ===== COMMAND CONTROL =====
        ReturnCommand: class ReturnCommand extends Error {
            constructor(message = "Command returned") {
                super(message);
                this.name = "ReturnCommand";
            }
        }
    };

    try {
        // Check if code contains async operations and wrap accordingly
        const hasAsyncOperations = code.includes('await ') || code.includes('.then(') || code.includes('async ');
        
        if (hasAsyncOperations) {
            // Wrap in async function for await support
            const asyncWrappedCode = `
                return (async function() {
                    const { 
                        message, u, chat, KEY, User, Bot, getUser, getChat, waitForAnswer, 
                        bot, HTTP, parseInt, parseFloat, JSON, wait, ReturnCommand,
                        userAnswer, originalMessage
                    } = this;
                    
                    try {
                        ${code}
                    } catch (error) {
                        if (error.name === "ReturnCommand") {
                            return null;
                        }
                        throw error;
                    }
                }).call(this);
            `;
            
            const func = new Function(asyncWrappedCode);
            const result = await func.call(safeFunctions);
            return result;
        } else {
            // Sync code execution
            const syncWrappedCode = `
                const { 
                    message, u, chat, KEY, User, Bot, getUser, getChat, waitForAnswer, 
                    bot, HTTP, parseInt, parseFloat, JSON, wait, ReturnCommand,
                    userAnswer, originalMessage
                } = this;
                
                try {
                    ${code}
                } catch (error) {
                    if (error.name === "ReturnCommand") {
                        return null;
                    }
                    throw error;
                }
            `;
            
            const func = new Function(syncWrappedCode);
            const result = func.call(safeFunctions);
            return result;
        }
        
    } catch (error) {
        if (error.name === "ReturnCommand") {
            return null;
        }
        throw error;
    }
}

// Format command code - remove problematic characters and fix syntax
function formatCommandCode(code) {
    if (!code) return '';
    
    // Remove any problematic Unicode characters and normalize
    let formatted = code
        .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-printable characters
        .replace(/[\u2018\u2019]/g, "'")     // Replace smart quotes
        .replace(/[\u201C\u201D]/g, '"')     // Replace smart double quotes
        .replace(/\$\s*{\s*([^}]+)\s*}/g, '${$1}')
        .replace(/(\w+)\s*\(\s*/g, '$1(')
        .replace(/\s*\)/g, ')')
        .replace(/\s*{/g, '{')
        .replace(/}\s*/g, '}')
        .replace(/\s*;/g, ';')
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    
    return formatted;
}

// Handle bot updates from webhook
async function handleBotUpdate(token, update) {
    try {
        let bot = activeBots.get(token);
        if (!bot) {
            console.log(`🔄 Bot not active, initializing: ${token.substring(0, 15)}...`);
            await initializeBot(token);
            bot = activeBots.get(token);
        }
        
        if (bot) {
            await bot.processUpdate(update);
        } else {
            console.error(`❌ Failed to initialize bot for update: ${token.substring(0, 15)}...`);
        }
    } catch (error) {
        console.error('❌ Handle bot update error:', error);
    }
}

// Update command cache
async function updateCommandCache(token) {
    try {
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        if (error) throw error;

        botCommands.set(token, commands || []);
        console.log(`✅ Command cache updated for ${token.substring(0, 15)}...: ${commands?.length || 0} commands`);
        
        return commands;
    } catch (error) {
        console.error('❌ Update command cache error:', error);
        return null;
    }
}

// Get bot instance
function getBotInstance(token) {
    return activeBots.get(token);
}

// Remove bot from active bots
function removeBot(token) {
    const bot = activeBots.get(token);
    if (bot) {
        bot.stopPolling();
    }
    activeBots.delete(token);
    botCommands.delete(token);
    console.log(`🗑️ Removed bot from active: ${token.substring(0, 15)}...`);
}

// Clean up waiting answers periodically
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, data] of waitingForAnswer.entries()) {
        if (now - data.timestamp > timeout) {
            waitingForAnswer.delete(key);
            console.log(`🧹 Cleaned up expired wait for answer: ${key}`);
        }
    }
}, 60000); // Run every minute

// Initialize on startup
setTimeout(() => {
    initializeAllBots();
}, 3000);

module.exports = {
    initializeAllBots,
    initializeBot,
    handleBotUpdate,
    updateCommandCache,
    getBotInstance,
    removeBot,
    executeCommand,
    saveUserData,
    getUserData,
    saveBotData,
    getBotData,
    activeBots,
    botCommands
};