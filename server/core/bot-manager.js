const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');

// Store active bots and their commands
const activeBots = new Map();
const botCommands = new Map();
const waitingForAnswer = new Map();

// IMPROVED: Initialize all bots - No crash if no bots or invalid tokens
async function initializeAllBots() {
    try {
        console.log('🔄 Checking for active bots...');
        const { data: bots, error } = await supabase
            .from('bots')
            .select('token, name, id')
            .eq('is_active', true);

        if (error) {
            console.error('❌ Database error fetching bots:', error);
            console.log('✅ Server continues without bots');
            return;
        }

        if (!bots || bots.length === 0) {
            console.log('ℹ️ No active bots found - Users can add bots later');
            console.log('✅ Server running normally without bots');
            return;
        }

        console.log(`🔄 Found ${bots.length} active bots, initializing...`);

        let initializedCount = 0;
        let failedCount = 0;

        for (const bot of bots) {
            try {
                const success = await initializeBot(bot.token);
                if (success) {
                    initializedCount++;
                    console.log(`✅ Bot initialized: ${bot.name}`);
                } else {
                    failedCount++;
                    console.log(`❌ Failed to initialize bot: ${bot.name}`);
                }
            } catch (botError) {
                failedCount++;
                console.error(`❌ Error initializing bot ${bot.name}:`, botError.message);
            }
            
            // Small delay between bot initializations
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Bot initialization complete: ${initializedCount} successful, ${failedCount} failed`);
        console.log('🚀 Server is fully operational');
        
    } catch (error) {
        console.error('❌ Bot initialization error:', error);
        console.log('✅ Server continues running despite bot errors');
    }
}

// IMPROVED: Initialize a single bot - Never throw errors
async function initializeBot(token) {
    try {
        if (!token || token.length < 10) {
            console.error('❌ Invalid bot token format');
            return false;
        }

        console.log(`🔄 Initializing bot: ${token.substring(0, 15)}...`);

        // Get commands from database
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Database error fetching commands:', error);
            // Continue without commands
        }

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

        // Test bot token with timeout and error handling
        try {
            const botInfo = await Promise.race([
                bot.getMe(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Bot token test timeout')), 10000)
                )
            ]);

            if (!botInfo) {
                console.error('❌ Failed to get bot info');
                return false;
            }
            
            console.log(`✅ Bot token valid: ${botInfo.first_name} (@${botInfo.username})`);
        } catch (tokenError) {
            console.error(`❌ Invalid bot token: ${tokenError.message}`);
            return false;
        }

        // Store commands
        botCommands.set(token, commands || []);
        
        // Setup message handler
        bot.on('message', async (msg) => {
            try {
                await handleMessage(bot, token, msg);
            } catch (error) {
                console.error('❌ Message handler error:', error);
            }
        });

        // Setup callback query handler for buttons
        bot.on('callback_query', async (callbackQuery) => {
            try {
                await handleCallbackQuery(bot, token, callbackQuery);
            } catch (error) {
                console.error('❌ Callback query error:', error);
            }
        });

        // Store bot instance
        activeBots.set(token, bot);
        
        console.log(`✅ Bot initialized successfully with ${commands?.length || 0} commands`);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Initialize bot error:`, error.message);
        return false;
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
            await executeCommand(bot, matchedCommand, msg);
        } else if (text.startsWith('/')) {
            console.log('❌ No command matched');
            await bot.sendMessage(chatId, 
                '❌ Command not found. Use /start to see available commands.',
                { reply_to_message_id: messageId }
            );
        }
    } catch (error) {
        console.error('❌ Handle message error:', error);
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
        
        console.log(`💬 Answer received: "${answerText}" for command: ${command.name}`);
        
        // Remove from waiting list
        waitingForAnswer.delete(waitKey);
        
        // Execute answer handler if exists
        if (command.answer_handler && command.answer_handler.trim()) {
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
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, token, callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        console.log(`🔘 Callback query: ${data}`);

        if (data.startsWith('test_')) {
            const commandId = data.split('_')[1];
            await handleTestCommand(bot, token, commandId, chatId);
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        console.error('❌ Handle callback query error:', error);
    }
}

// Handle test command execution
async function handleTestCommand(bot, token, commandId, chatId) {
    try {
        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            await bot.sendMessage(chatId, '❌ Command not found');
            return;
        }

        const { data: adminSettings } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        const testChatId = adminSettings?.admin_chat_id || chatId;

        const mockMsg = {
            chat: { id: testChatId },
            from: { 
                id: testChatId, 
                first_name: 'Test User'
            },
            message_id: Date.now(),
            text: command.pattern
        };

        await executeCommand(bot, command, mockMsg, true);
    } catch (error) {
        console.error('❌ Test command error:', error);
        await bot.sendMessage(chatId, '❌ Failed to test command');
    }
}

// Execute command
async function executeCommand(bot, command, msg, isTest = false) {
    try {
        // If command has wait_for_answer, set up the waiting state
        if (command.wait_for_answer && !isTest) {
            const waitKey = `${command.bot_token}_${msg.from.id}`;
            
            waitingForAnswer.set(waitKey, {
                command,
                context: {
                    chatId: msg.chat.id,
                    userId: msg.from.id,
                    messageId: msg.message_id,
                    originalMessage: msg
                }
            });
            
            console.log(`⏳ Waiting for answer for command: ${command.name}`);
        }

        const result = await executeCommandCode(bot, command.code, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            isTest
        });

        return result;
    } catch (error) {
        console.error(`❌ Command "${command.name}" execution error:`, error);
        
        try {
            await bot.sendMessage(msg.chat.id, 
                '❌ An error occurred while executing this command.',
                { reply_to_message_id: msg.message_id }
            );
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

// Execute answer handler
async function executeAnswerHandler(bot, command, msg, answerText, context) {
    try {
        const result = await executeCommandCode(bot, command.answer_handler, {
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
        await bot.sendMessage(msg.chat.id, 
            `✅ Received: "${answerText}"`,
            { reply_to_message_id: msg.message_id }
        );
    }
}

// Execute command code safely
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name, isTest, answerText } = context;
    
    const safeFunctions = {
        sendMessage: (text, options = {}) => {
            return bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        sendPhoto: (photo, options = {}) => bot.sendPhoto(chatId, photo, options),
        sendDocument: (doc, options = {}) => bot.sendDocument(chatId, doc, options),
        sendChatAction: (action) => bot.sendChatAction(chatId, action),
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User'
        }),
        getMessage: () => msg,
        getChatId: () => chatId,
        isTest: () => isTest || false,
        getAnswer: () => answerText || '',
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        log: (message) => console.log(`[Command Log]: ${message}`)
    };

    const wrappedCode = `
        return (async function() {
            try {
                ${code}
            } catch (error) {
                throw new Error('Command execution failed: ' + error.message);
            }
        })();
    `;

    const func = new Function(...Object.keys(safeFunctions), wrappedCode);
    return await func(...Object.values(safeFunctions));
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
        console.log(`✅ Command cache updated: ${commands?.length || 0} commands`);
        
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
    console.log(`🗑️ Removed bot from active bots`);
}

// Initialize on startup - No crash guarantee
setTimeout(() => {
    initializeAllBots().catch(error => {
        console.error('❌ Bot initialization failed, but server continues:', error);
    });
}, 3000);

module.exports = {
    initializeAllBots,
    initializeBot,
    handleBotUpdate,
    updateCommandCache,
    getBotInstance,
    removeBot,
    activeBots,
    botCommands
};