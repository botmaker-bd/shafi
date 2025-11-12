const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const supabase = require('../config/supabase');

// Store active bots and their commands
const activeBots = new Map();
const botCommands = new Map();
const waitingForAnswer = new Map();
const userDataStore = new Map();
const botDataStore = new Map();

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
            polling: false,
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
            
            if (waitData.resolve) {
                waitData.resolve(text);
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
        
        const result = await executeCommandCode(bot, formattedCode, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            isTest,
            botToken: command.bot_token
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

// Enhanced command code execution with official API
// Enhanced command execution with complete TBC style functions
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name, isTest, botToken, waitForAnswer } = context;
    
    // User data storage (simulated)
    const userDataStore = new Map();
    const botDataStore = new Map();
    
    const getUserDataKey = (key) => `${botToken}_${userId}_${key}`;
    const getBotDataKey = (key) => `${botToken}_${key}`;

    // Enhanced available functions for command code
    const safeFunctions = {
        // ===== MESSAGE PROPERTIES =====
        message: msg,
        
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
            saveData: (key, value) => {
                const dataKey = getUserDataKey(key);
                userDataStore.set(dataKey, value);
                return value;
            },
            
            getData: (key) => {
                const dataKey = getUserDataKey(key);
                return userDataStore.get(dataKey) || null;
            },
            
            deleteData: (key) => {
                const dataKey = getUserDataKey(key);
                return userDataStore.delete(dataKey);
            }
        },
        
        Bot: {
            saveData: (key, value) => {
                const dataKey = getBotDataKey(key);
                botDataStore.set(dataKey, value);
                return value;
            },
            
            getData: (key) => {
                const dataKey = getBotDataKey(key);
                return botDataStore.get(dataKey) || null;
            },
            
            deleteData: (key) => {
                const dataKey = getBotDataKey(key);
                return botDataStore.delete(dataKey);
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
            return waitForAnswer(timeout);
        },
        
        // ===== BOT ACTIONS (Official API Style) =====
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
        
        // ===== COMMAND CONTROL =====
        ReturnCommand: class ReturnCommand extends Error {
            constructor(message = "Command returned") {
                super(message);
                this.name = "ReturnCommand";
            }
        },
        
        runCommand: (commandPattern, params = {}) => {
            console.log(`Would run command: ${commandPattern}`, params);
            throw new Error('runCommand not implemented in this version');
        },
        
        // ===== BUNCHIFY UTILITY =====
        bunchify: (obj) => {
            if (obj && typeof obj === 'object') {
                return new Proxy(obj, {
                    get: (target, prop) => {
                        if (prop in target) {
                            const value = target[prop];
                            if (typeof value === 'object' && value !== null) {
                                return safeFunctions.bunchify(value);
                            }
                            return value;
                        }
                        return undefined;
                    }
                });
            }
            return obj;
        },
        
        // ===== ALIAS FUNCTIONS FOR COMPATIBILITY =====
        // TBC Style compatibility
        sendMessage: (text, params = {}) => {
            return bot.sendMessage(params.chat_id || chatId, text, {
                parse_mode: params.parse_mode,
                reply_markup: params.reply_markup
            });
        },
        
        sendPhoto: (photo, params = {}) => {
            return bot.sendPhoto(params.chat_id || chatId, photo, {
                caption: params.caption,
                parse_mode: params.parse_mode
            });
        },
        
        deleteMessage: (params = {}) => {
            return bot.deleteMessage(
                params.chat_id || chatId,
                params.message_id || msg.message_id
            );
        }
    };

    try {
        // Enhanced wrapped code with all functions
        const wrappedCode = `
            return (async function() {
                const { 
                    // Message properties
                    message,
                    u,
                    chat,
                    KEY,
                    
                    // User data
                    User,
                    Bot,
                    
                    // User information
                    getUser,
                    getChat,
                    
                    // Wait for answer
                    waitForAnswer,
                    
                    // Bot actions
                    bot,
                    
                    // HTTP requests
                    HTTP,
                    
                    // Utility functions
                    parseInt,
                    parseFloat,
                    JSON,
                    ReturnCommand,
                    runCommand,
                    bunchify,
                    
                    // Alias functions
                    sendMessage,
                    sendPhoto,
                    deleteMessage
                } = this;
                
                ${code}
            }).call(this);
        `;

        const func = new Function(wrappedCode);
        const result = await func.call(safeFunctions);
        
        return result;
    } catch (error) {
        if (error.name === "ReturnCommand") {
            return null;
        }
        throw error;
    }
}

// Format command code
function formatCommandCode(code) {
    if (!code) return '';
    
    let formatted = code
        .replace(/\$\s*{\s*([^}]+)\s*}/g, '${$1}')
        .replace(/(\w+)\s*\(\s*/g, '$1(')
        .replace(/\s*\)/g, ')')
        .replace(/\s*;/g, ';')
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, '\n')
        .replace(/\/\/.*$/gm, '')
        .replace(/return\s+\(/g, 'return (');
    
    return formatted.trim();
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
    activeBots.delete(token);
    botCommands.delete(token);
    console.log(`🗑️ Removed bot from active: ${token.substring(0, 15)}...`);
}

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
    activeBots,
    botCommands
};