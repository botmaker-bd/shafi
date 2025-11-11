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
                // Skip initialization for demo tokens
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
        
        // If no bots to initialize, show message
        if (bots.length === 0) {
            console.log('💡 No active bots found. Add bots via the web interface.');
        }
    } catch (error) {
        console.error('❌ Initialize all bots error:', error);
    }
}

// Initialize a single bot
async function initializeBot(token) {
    try {
        // Get commands from database
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Create bot instance
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

        // Test bot token
        await bot.getMe();

        // Store commands
        botCommands.set(token, commands || []);
        
        // Setup message handler
        bot.on('message', async (msg) => {
            await handleMessage(bot, token, msg);
        });

        // Setup callback query handler for buttons
        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, token, callbackQuery);
        });

        // Store bot instance
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
        const messageId = msg.message_id;

        console.log(`📩 Message from ${msg.from.first_name}: "${text}"`);

        // Check if waiting for answer
        const waitKey = `${token}_${userId}`;
        if (waitingForAnswer.has(waitKey)) {
            await handleAnswer(bot, token, msg);
            return;
        }

        const commands = botCommands.get(token) || [];
        let matchedCommand = null;

        // Find matching command
        for (const cmd of commands) {
            if (text === cmd.pattern || text.startsWith(cmd.pattern + ' ')) {
                matchedCommand = cmd;
                break;
            }
        }

        if (matchedCommand) {
            console.log(`🎯 Executing command: ${matchedCommand.name}`);
            
            if (matchedCommand.wait_for_answer) {
                // Store context for answer handling
                waitingForAnswer.set(waitKey, {
                    command: matchedCommand,
                    context: { chatId, userId, messageId }
                });
                
                await executeCommand(bot, matchedCommand, msg);
            } else {
                // Execute normal command
                await executeCommand(bot, matchedCommand, msg);
            }
        } else {
            console.log('❌ No command matched');
            await bot.sendMessage(chatId, 
                '❌ Command not found. Use /start to see available commands.',
                { reply_to_message_id: messageId }
            );
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

// Handle answer for wait_for_answer commands
async function handleAnswer(bot, token, msg) {
    const waitKey = `${token}_${msg.from.id}`;
    const waitData = waitingForAnswer.get(waitKey);
    
    if (!waitData) return;

    try {
        const { command, context } = waitData;
        const answerText = msg.text;
        
        // Remove from waiting list
        waitingForAnswer.delete(waitKey);
        
        // Execute answer handler if exists
        if (command.answer_handler) {
            await executeAnswerHandler(bot, command, msg, answerText, context);
        } else {
            // Default answer handling
            await bot.sendMessage(context.chatId, 
                `✅ Thank you for your answer: "${answerText}"`,
                { reply_to_message_id: msg.message_id }
            );
        }
    } catch (error) {
        console.error('❌ Handle answer error:', error);
        await bot.sendMessage(msg.chat.id, 
            '❌ Error processing your answer.',
            { reply_to_message_id: msg.message_id }
        );
    }
}

// Handle callback queries (for buttons)
async function handleCallbackQuery(bot, token, callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;

        console.log(`🔘 Callback query: ${data}`);

        // Handle test command callback
        if (data.startsWith('test_')) {
            const commandId = data.split('_')[1];
            await handleTestCommand(bot, token, commandId, chatId, messageId);
        }

        // Answer callback query to remove loading state
        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('❌ Handle callback query error:', error);
    }
}

// Handle test command execution
async function handleTestCommand(bot, token, commandId, chatId, messageId) {
    try {
        // Get command details
        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            await bot.sendMessage(chatId, '❌ Command not found');
            return;
        }

        // Get admin chat ID
        const { data: adminSettings } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        const testChatId = adminSettings?.admin_chat_id || chatId;

        // Create mock message object
        const mockMsg = {
            chat: { id: testChatId },
            from: { 
                id: testChatId, 
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: messageId,
            text: command.pattern
        };

        // Execute command
        await executeCommand(bot, command, mockMsg, true);

    } catch (error) {
        console.error('❌ Test command error:', error);
        await bot.sendMessage(chatId, '❌ Failed to test command');
    }
}

// Execute command with proper code formatting
async function executeCommand(bot, command, msg, isTest = false) {
    try {
        // Format code before execution to fix formatting issues
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
        
        const errorMessage = `
❌ *Command Execution Error*

*Command:* ${command.name}
*Pattern:* ${command.pattern}

*Error:* \`${error.message}\`

Please check your command code and try again.
        `.trim();

        try {
            await bot.sendMessage(msg.chat.id, errorMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.message_id
            });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
        
        throw error; // Re-throw for test endpoints
    }
}

// Format command code to fix common formatting issues
function formatCommandCode(code) {
    if (!code) return '';
    
    let formatted = code;
    
    // Fix: Remove extra spaces in template literals
    formatted = formatted.replace(/\$\s*{\s*([^}]+)\s*}/g, '${$1}');
    
    // Fix: Ensure proper spacing for function calls
    formatted = formatted.replace(/(\w+)\s*\(\s*/g, '$1(');
    formatted = formatted.replace(/\s*\)/g, ')');
    
    // Fix: Remove spaces before semicolons
    formatted = formatted.replace(/\s*;/g, ';');
    
    // Fix: Ensure proper line breaks
    formatted = formatted.replace(/\r\n/g, '\n');
    formatted = formatted.replace(/\n+/g, '\n');
    
    // Fix: Remove comments that break code
    formatted = formatted.replace(/\/\/.*$/gm, '');
    
    // Fix: Ensure return statements are proper
    formatted = formatted.replace(/return\s+\(/g, 'return (');
    
    return formatted.trim();
}

// Execute answer handler
async function executeAnswerHandler(bot, command, msg, answerText, context) {
    try {
        const formattedCode = formatCommandCode(command.answer_handler);
        
        const result = await executeCommandCode(bot, formattedCode, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            answerText,
            originalContext: context
        });

        return result;
    } catch (error) {
        console.error(`❌ Answer handler execution error:`, error);
        throw error;
    }
}

// Execute command code safely with better formatting
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name, isTest, answerText, botToken } = context;
    
    // Enhanced available functions for command code
    const safeFunctions = {
        // Basic messaging
        sendMessage: (text, options = {}) => {
            return bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        
        sendPhoto: (photo, options = {}) => {
            return bot.sendPhoto(chatId, photo, options);
        },
        
        sendDocument: (doc, options = {}) => {
            return bot.sendDocument(chatId, doc, options);
        },
        
        sendVideo: (video, options = {}) => {
            return bot.sendVideo(chatId, video, options);
        },
        
        sendAudio: (audio, options = {}) => {
            return bot.sendAudio(chatId, audio, options);
        },
        
        sendSticker: (sticker, options = {}) => {
            return bot.sendSticker(chatId, sticker, options);
        },
        
        sendAnimation: (animation, options = {}) => {
            return bot.sendAnimation(chatId, animation, options);
        },
        
        sendDice: (emoji = "🎲", options = {}) => {
            return bot.sendDice(chatId, { emoji, ...options });
        },
        
        // Message management
        deleteMessage: (options = {}) => {
            const messageId = options.message_id || msg.message_id;
            return bot.deleteMessage(chatId, messageId);
        },
        
        editMessageText: (text, options = {}) => {
            const messageId = options.message_id || msg.message_id;
            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        },
        
        // Chat actions
        sendChatAction: (action) => {
            return bot.sendChatAction(chatId, action);
        },
        
        // User info
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User',
            telegramid: userId
        }),
        
        getMessage: () => msg,
        
        getChatId: () => chatId,
        
        // HTTP requests
        HTTP: {
            get: async (options) => {
                try {
                    const response = await axios.get(options.url, {
                        headers: options.headers || {}
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP GET failed: ${error.message}`);
                }
            },
            
            post: async (options) => {
                try {
                    const response = await axios.post(options.url, options.data || {}, {
                        headers: options.headers || {}
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP POST failed: ${error.message}`);
                }
            }
        },
        
        // Utility functions
        isTest: () => isTest || false,
        
        getAnswer: () => answerText || '',
        
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        log: (message) => console.log(`[Command Log]: ${message}`),
        
        // Bot token context
        getBotToken: () => botToken,
        
        // Alias functions for compatibility
        Api: {
            sendMessage: (options) => {
                return bot.sendMessage(options.chat_id || chatId, options.text, {
                    reply_markup: options.reply_markup,
                    parse_mode: options.parse_mode
                });
            },
            
            sendPhoto: (options) => {
                return bot.sendPhoto(options.chat_id || chatId, options.photo, {
                    caption: options.caption
                });
            },
            
            sendDocument: (options) => {
                return bot.sendDocument(options.chat_id || chatId, options.document, {
                    caption: options.caption
                });
            },
            
            deleteMessage: (options) => {
                return bot.deleteMessage(options.chat_id || chatId, options.message_id);
            },
            
            sendChatAction: (options) => {
                return bot.sendChatAction(options.chat_id || chatId, options.action);
            },
            
            sendDice: (options) => {
                return bot.sendDice(options.chat_id || chatId, { 
                    emoji: options.emoji || "🎲" 
                });
            }
        },
        
        // Bot functions alias
        Bot: {
            sendMessage: (text, options = {}) => {
                return bot.sendMessage(chatId, text, {
                    parse_mode: 'Markdown',
                    ...options
                });
            }
        }
    };

    try {
        // Wrap the code in an async function with proper formatting
        const wrappedCode = `
            return (async function() {
                const { 
                    sendMessage, 
                    sendPhoto, 
                    sendDocument,
                    sendVideo,
                    sendAudio,
                    sendSticker,
                    sendAnimation,
                    sendDice,
                    deleteMessage,
                    editMessageText,
                    sendChatAction,
                    getUser, 
                    getMessage, 
                    getChatId,
                    HTTP,
                    isTest, 
                    getAnswer,
                    getBotToken,
                    wait,
                    log,
                    Api,
                    Bot
                } = this;
                
                ${code}
            }).call(this);
        `;

        // Create and execute the function
        const func = new Function(wrappedCode);
        const result = await func.call(safeFunctions);
        
        return result;
    } catch (error) {
        console.error('❌ Command code execution error:', error);
        throw new Error(`Command execution failed: ${error.message}`);
    }
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