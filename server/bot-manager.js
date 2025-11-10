const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active bot instances
const activeBots = new Map();

// Initialize all bots on server start
async function initializeAllBots() {
    try {
        console.log('Initializing all bots...');
        const { data: bots, error } = await supabase
            .from('bots')
            .select('token')
            .eq('is_active', true);

        if (error) throw error;

        for (const bot of bots) {
            await initializeBot(bot.token);
        }
        console.log(`Initialized ${bots.length} bots`);
    } catch (error) {
        console.error('Initialize all bots error:', error);
    }
}

// Initialize a single bot
async function initializeBot(token) {
    try {
        console.log(`Initializing bot with token: ${token.substring(0, 10)}...`);

        // Get commands for this bot
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        if (error) throw error;

        // Create bot instance
        const bot = new TelegramBot(token);
        
        // Clear existing listeners
        bot.clearTextListeners();
        
        // Setup command handlers for each command
        commands.forEach(command => {
            console.log(`Setting up command: ${command.name} with pattern: ${command.pattern}`);
            
            // Use exact text matching instead of regex for simple commands
            if (command.pattern.startsWith('/')) {
                bot.onText(new RegExp(`^${command.pattern}$`), async (msg, match) => {
                    console.log(`Command received: ${command.pattern} from user: ${msg.from.id}`);
                    await handleCommand(bot, command, msg, match);
                });
            } else {
                // Fallback to regex for complex patterns
                bot.onText(new RegExp(command.pattern), async (msg, match) => {
                    console.log(`Pattern matched: ${command.pattern} from user: ${msg.from.id}`);
                    await handleCommand(bot, command, msg, match);
                });
            }
        });

        // Handle callback queries
        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, callbackQuery);
        });

        // Handle errors
        bot.on('error', (error) => {
            console.error('Bot error:', error);
        });

        // Store bot instance
        activeBots.set(token, bot);
        
        console.log(`Bot initialized successfully with ${commands.length} commands`);
        
    } catch (error) {
        console.error('Initialize bot error:', error);
    }
}

// Handle command execution
async function handleCommand(bot, command, msg, match) {
    let responseSent = false;
    
    try {
        const chatId = msg.chat.id;
        const user = msg.from;
        
        console.log(`Executing command: "${command.name}" for user: ${user.first_name} (${user.id})`);

        // Execute command code with error handling
        const result = await executeCommandCode(command.code, {
            bot,
            msg,
            match,
            chatId,
            userId: user.id,
            username: user.username,
            first_name: user.first_name
        });

        responseSent = true;
        console.log(`Command "${command.name}" executed successfully`);

    } catch (error) {
        console.error(`Error in command "${command.name}":`, error);
        
        if (!responseSent) {
            try {
                // Send error message to user
                const errorMessage = `
❌ *Command Error*

*Command:* ${command.name}
*Description:* ${command.description || 'No description available'}

*Error Details:*
\`\`\`
${error.message}
\`\`\`

Please contact the bot administrator if this issue persists.
                `.trim();

                await bot.sendMessage(msg.chat.id, errorMessage, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: msg.message_id
                });
            } catch (sendError) {
                console.error('Failed to send error message:', sendError);
            }
        }
    }
}

// Execute command code safely
async function executeCommandCode(code, context) {
    const { bot, msg, match, chatId, userId, username, first_name } = context;
    
    // Create safe execution environment
    const safeFunctions = {
        // Message sending functions
        sendMessage: (text, options = {}) => {
            console.log('Sending message to chat:', chatId);
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
            username, 
            first_name,
            last_name: msg.from.last_name 
        }),
        
        getMatch: () => match,
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
        console.error('Code execution error:', error);
        throw error;
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    try {
        await bot.answerCallbackQuery(callbackQuery.id);
        // Add your callback query logic here
    } catch (error) {
        console.error('Callback query error:', error);
    }
}

// Handle bot updates from webhook
async function handleBotUpdate(token, update) {
    try {
        console.log('Webhook update received for token:', token.substring(0, 10));
        
        let bot = activeBots.get(token);
        if (!bot) {
            console.log('Bot not active, initializing...');
            await initializeBot(token);
            bot = activeBots.get(token);
        }
        
        if (bot) {
            await bot.processUpdate(update);
        } else {
            console.error('Failed to initialize bot for token:', token.substring(0, 10));
        }
    } catch (error) {
        console.error('Handle bot update error:', error);
    }
}

// API Routes

// Add bot endpoint
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        console.log('Adding new bot:', name);

        // Validate bot token
        const bot = new TelegramBot(token, { polling: false });
        const botInfo = await bot.getMe();

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
        await bot.setWebHook(`https://bot-maker-jcch.onrender.com/bot?token=${token}`);
        console.log('Webhook set for bot:', botInfo.username);

        // Initialize bot
        await initializeBot(token);

        res.json({
            success: true,
            message: 'Bot added successfully',
            bot: botData
        });

    } catch (error) {
        console.error('Add bot error:', error);
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
        console.error('Get bots error:', error);
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
        console.error('Remove bot error:', error);
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
            await initializeBot(bot.token);
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
        console.error('Reload bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to reload bot' 
        });
    }
});

// Initialize all bots when server starts
initializeAllBots();

module.exports = {
    router,
    handleBotUpdate,
    initializeBot
};