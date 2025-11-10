const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active bot instances and their commands
const activeBots = new Map();
const botCommands = new Map();

// Initialize all bots on server start
async function initializeAllBots() {
    try {
        console.log('🔄 Initializing all bots...');
        const { data: bots, error } = await supabase
            .from('bots')
            .select('token, name')
            .eq('is_active', true);

        if (error) throw error;

        let initializedCount = 0;
        for (const bot of bots) {
            try {
                await initializeBot(bot.token);
                initializedCount++;
            } catch (botError) {
                console.error(`❌ Failed to initialize bot ${bot.name}:`, botError.message);
            }
        }
        console.log(`✅ Successfully initialized ${initializedCount}/${bots.length} bots`);
    } catch (error) {
        console.error('❌ Initialize all bots error:', error);
    }
}

// Initialize a single bot
async function initializeBot(token) {
    try {
        console.log(`🔄 Initializing bot: ${token.substring(0, 10)}...`);

        // Get commands for this bot
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        if (error) {
            console.error('❌ Error fetching commands:', error);
            throw error;
        }

        console.log(`📝 Found ${commands.length} commands for bot`);

        // Create bot instance
        const bot = new TelegramBot(token);
        
        // Clear existing listeners
        bot.clearTextListeners();
        
        // Store commands for this bot
        botCommands.set(token, commands);
        
        // Setup message handler for ALL messages
        bot.on('message', async (msg) => {
            await handleMessage(bot, token, msg);
        });

        // Handle callback queries
        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, callbackQuery);
        });

        // Handle errors
        bot.on('error', (error) => {
            console.error('❌ Bot error:', error);
        });

        // Store bot instance
        activeBots.set(token, bot);
        
        console.log(`✅ Bot initialized successfully with ${commands.length} commands`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Initialize bot error:', error);
        throw error;
    }
}

// Handle all messages
async function handleMessage(bot, token, msg) {
    try {
        // Ignore non-text messages
        if (!msg.text) {
            console.log('📨 Non-text message received, ignoring');
            return;
        }

        const chatId = msg.chat.id;
        const user = msg.from;
        const messageText = msg.text.trim();
        
        console.log(`📩 Message from ${user.first_name} (${user.id}): "${messageText}"`);

        // Get commands for this bot
        const commands = botCommands.get(token) || [];
        
        // Find matching command
        const matchedCommand = commands.find(cmd => {
            // Simple exact match for commands starting with /
            if (messageText.startsWith('/')) {
                return messageText === cmd.pattern;
            }
            // Regex match for other patterns
            try {
                const regex = new RegExp(cmd.pattern);
                return regex.test(messageText);
            } catch (e) {
                return false;
            }
        });

        if (matchedCommand) {
            console.log(`🎯 Command matched: "${matchedCommand.name}"`);
            await executeCommand(bot, matchedCommand, msg);
        } else {
            console.log('❌ No command matched');
            // Send "command not found" message
            await sendCommandNotFound(bot, chatId, msg.message_id);
        }

    } catch (error) {
        console.error('❌ Handle message error:', error);
        try {
            await bot.sendMessage(msg.chat.id, '❌ Sorry, there was an error processing your message. Please try again.');
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

// Execute command
async function executeCommand(bot, command, msg) {
    let responseSent = false;
    
    try {
        const chatId = msg.chat.id;
        const user = msg.from;
        
        console.log(`🚀 Executing command: "${command.name}"`);

        // Execute command code
        await executeCommandCode(bot, command.code, {
            msg,
            chatId,
            userId: user.id,
            username: user.username,
            first_name: user.first_name
        });

        responseSent = true;
        console.log(`✅ Command "${command.name}" executed successfully`);

    } catch (error) {
        console.error(`❌ Error in command "${command.name}":`, error);
        
        if (!responseSent) {
            await sendCommandError(bot, msg, command, error);
        }
    }
}

// Send "command not found" message
async function sendCommandNotFound(bot, chatId, replyToMessageId) {
    try {
        const helpMessage = `
❌ *Command Not Found*

Sorry, I don't recognize that command. 

Here are the available commands:
• /start - Welcome message
• /help - Get help

Use /help to see all available commands.
        `.trim();

        await bot.sendMessage(chatId, helpMessage, {
            parse_mode: 'Markdown',
            reply_to_message_id: replyToMessageId
        });
    } catch (error) {
        console.error('❌ Failed to send command not found message:', error);
    }
}

// Send command error message
async function sendCommandError(bot, msg, command, error) {
    try {
        const errorMessage = `
❌ *Command Error*

*Command:* ${command.name}
*Description:* ${command.description || 'No description available'}

*Error Details:*
\`\`\`
${error.message.substring(0, 500)}
\`\`\`

Please contact the bot administrator if this issue persists.
        `.trim();

        await bot.sendMessage(msg.chat.id, errorMessage, {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
    }
}

// Execute command code safely
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name } = context;
    
    // Create safe execution environment
    const safeFunctions = {
        // Message sending functions
        sendMessage: (text, options = {}) => {
            console.log('📤 Sending message to chat:', chatId);
            return bot.sendMessage(chatId, text, { 
                parse_mode: 'Markdown',
                ...options 
            });
        },
        
        sendPhoto: (photo, options = {}) => {
            return bot.sendPhoto(chatId, photo, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        
        sendDocument: (doc, options = {}) => {
            return bot.sendDocument(chatId, doc, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        
        // User information functions
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User',
            last_name: msg.from.last_name || ''
        }),
        
        getMessage: () => msg,
        getChatId: () => chatId,
        
        // Utility functions
        replyToMessage: (text, options = {}) => {
            return bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.message_id,
                ...options
            });
        }
    };

    try {
        // Wrap the code in async function with proper error handling
        const wrappedCode = `
            try {
                ${code}
            } catch (error) {
                console.error('User code error:', error);
                throw new Error('Command execution failed: ' + error.message);
            }
        `;

        // Create the function with safe context
        const func = new Function(...Object.keys(safeFunctions), wrappedCode);
        
        // Execute the function
        const result = await func(...Object.values(safeFunctions));
        
        return result;
        
    } catch (error) {
        console.error('❌ Code execution error:', error);
        throw error;
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    try {
        console.log('🔄 Callback query received:', callbackQuery.data);
        await bot.answerCallbackQuery(callbackQuery.id);
        
        // You can add callback-specific logic here
        if (callbackQuery.data === 'help') {
            await bot.sendMessage(callbackQuery.message.chat.id, '📚 *Help Section*\n\nAvailable commands:\n/start - Welcome message\n/help - This help message', {
                parse_mode: 'Markdown'
            });
        }
        
    } catch (error) {
        console.error('❌ Callback query error:', error);
    }
}

// Handle bot updates from webhook
async function handleBotUpdate(token, update) {
    try {
        console.log('🔔 Processing webhook update for token:', token.substring(0, 10));
        
        let bot = activeBots.get(token);
        if (!bot) {
            console.log('🔄 Bot not active, initializing...');
            await initializeBot(token);
            bot = activeBots.get(token);
        }
        
        if (bot) {
            await bot.processUpdate(update);
            console.log('✅ Webhook update processed successfully');
        } else {
            console.error('❌ Failed to initialize bot for webhook');
        }
    } catch (error) {
        console.error('❌ Handle bot update error:', error);
    }
}

// Reload commands for a bot
async function reloadBotCommands(token) {
    try {
        console.log('🔄 Reloading commands for bot:', token.substring(0, 10));
        
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        if (error) throw error;

        // Update commands in memory
        botCommands.set(token, commands);
        
        console.log(`✅ Reloaded ${commands.length} commands for bot`);
        return commands;
        
    } catch (error) {
        console.error('❌ Reload bot commands error:', error);
        throw error;
    }
}

// API Routes

// Add bot endpoint
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        console.log('🔄 Adding new bot:', name);

        // Validate bot token
        const testBot = new TelegramBot(token, { polling: false });
        const botInfo = await testBot.getMe();

        // Store bot in database
        const { data: botData, error } = await supabase
            .from('bots')
            .insert([{
                token,
                name: name || botInfo.first_name,
                username: botInfo.username,
                user_id: userId,
                webhook_url: `https://bot-maker-jcch.onrender.com/bot?token=${token}`,
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        // Set webhook
        await testBot.setWebHook(`https://bot-maker-jcch.onrender.com/bot?token=${token}`);
        console.log('✅ Webhook set for bot:', botInfo.username);

        // Initialize bot
        await initializeBot(token);

        res.json({
            success: true,
            message: 'Bot added successfully',
            bot: botData
        });

    } catch (error) {
        console.error('❌ Add bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add bot: ' + error.message 
        });
    }
});

// Get user's bots
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: bots, error } = await supabase
            .from('bots')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ 
            success: true,
            bots 
        });

    } catch (error) {
        console.error('❌ Get bots error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch bots' 
        });
    }
});

// Remove bot
router.delete('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;

        // Get bot token
        const { data: bot } = await supabase
            .from('bots')
            .select('token')
            .eq('id', botId)
            .single();

        if (bot) {
            // Delete webhook
            const telegramBot = new TelegramBot(bot.token, { polling: false });
            await telegramBot.deleteWebHook();
            activeBots.delete(bot.token);
            botCommands.delete(bot.token);
        }

        // Remove from database
        await supabase
            .from('bots')
            .delete()
            .eq('id', botId);

        res.json({ 
            success: true,
            message: 'Bot removed successfully' 
        });

    } catch (error) {
        console.error('❌ Remove bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to remove bot' 
        });
    }
});

// Reload bot commands
router.post('/:botId/reload', async (req, res) => {
    try {
        const { botId } = req.params;

        // Get bot token
        const { data: bot } = await supabase
            .from('bots')
            .select('token')
            .eq('id', botId)
            .single();

        if (bot) {
            await reloadBotCommands(bot.token);
            res.json({ 
                success: true,
                message: 'Bot commands reloaded successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

    } catch (error) {
        console.error('❌ Reload bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to reload bot' 
        });
    }
});

// Initialize all bots when server starts
setTimeout(() => {
    initializeAllBots();
}, 2000);

module.exports = {
    router,
    handleBotUpdate,
    initializeBot,
    reloadBotCommands
};