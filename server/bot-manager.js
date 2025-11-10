const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'sb_secret_lXIB5ns2oYlInT7n7HrBhA_0UIIQYcs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active bot instances
const activeBots = new Map();

// Add new bot
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        // Validate bot token
        const bot = new TelegramBot(token, { polling: false });
        const botInfo = await bot.getMe();

        // Store bot in database
        const { data: botData, error } = await supabase
            .from('bots')
            .insert([
                {
                    token,
                    name: name || botInfo.first_name,
                    username: botInfo.username,
                    user_id: userId,
                    webhook_url: `${process.env.RENDER_URL}/bot?token=${token}`,
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        // Set webhook
        await bot.setWebHook(`${process.env.RENDER_URL}/bot?token=${token}`);

        // Initialize bot handler
        await initializeBot(token);

        res.json({
            message: 'Bot added successfully',
            bot: botData
        });
    } catch (error) {
        console.error('Add bot error:', error);
        res.status(500).json({ error: 'Failed to add bot' });
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

        res.json({ bots });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
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

            // Remove from active bots
            activeBots.delete(bot.token);
        }

        // Remove from database
        await supabase
            .from('bots')
            .delete()
            .eq('id', botId);

        res.json({ message: 'Bot removed successfully' });
    } catch (error) {
        console.error('Remove bot error:', error);
        res.status(500).json({ error: 'Failed to remove bot' });
    }
});

// Initialize bot handler
async function initializeBot(token) {
    try {
        // Get bot commands from database
        const { data: commands } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        // Create bot instance
        const bot = new TelegramBot(token);
        
        // Set up command handlers
        commands.forEach(command => {
            bot.onText(new RegExp(command.pattern), async (msg, match) => {
                await handleCommand(bot, command, msg, match);
            });
        });

        // Handle callback queries
        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, callbackQuery);
        });

        // Store bot instance
        activeBots.set(token, bot);
        
    } catch (error) {
        console.error('Initialize bot error:', error);
    }
}

// Handle Telegram updates from webhook
async function handleBotUpdate(token, update) {
    try {
        const bot = activeBots.get(token);
        if (bot) {
            await bot.processUpdate(update);
        } else {
            // Initialize bot if not already active
            await initializeBot(token);
            const newBot = activeBots.get(token);
            if (newBot) {
                await newBot.processUpdate(update);
            }
        }
    } catch (error) {
        console.error('Handle bot update error:', error);
    }
}

// Handle command execution
async function handleCommand(bot, command, msg, match) {
    try {
        const chatId = msg.chat.id;
        
        // Execute command code
        const result = await executeCommandCode(command.code, {
            bot,
            msg,
            match,
            chatId,
            userId: msg.from.id,
            username: msg.from.username
        });

        if (result) {
            await bot.sendMessage(chatId, result);
        }
    } catch (error) {
        console.error('Command execution error:', error);
        await bot.sendMessage(msg.chat.id, 'An error occurred while processing your command.');
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    try {
        // Implement callback query handling
        await bot.answerCallbackQuery(callbackQuery.id);
        // Add your callback query logic here
    } catch (error) {
        console.error('Callback query error:', error);
    }
}

// Execute command code in a safe environment
async function executeCommandCode(code, context) {
    try {
        // Create a safe execution environment
        const { bot, msg, match, chatId, userId, username } = context;
        
        // Define safe functions that can be used in command code
        const safeFunctions = {
            sendMessage: (text, options = {}) => bot.sendMessage(chatId, text, options),
            sendPhoto: (photo, options = {}) => bot.sendPhoto(chatId, photo, options),
            sendDocument: (doc, options = {}) => bot.sendDocument(chatId, doc, options),
            getUser: () => ({ id: userId, username }),
            getMatch: () => match,
            getMessage: () => msg
        };

        // Wrap the code in an async function
        const wrappedCode = `
            return (async function() {
                ${code}
            })();
        `;

        // Create function with safe context
        const func = new Function(
            ...Object.keys(safeFunctions),
            wrappedCode
        );

        // Execute with safe functions
        const result = await func(...Object.values(safeFunctions));
        return result;

    } catch (error) {
        console.error('Code execution error:', error);
        return 'Error executing command: ' + error.message;
    }
}

module.exports = {
    router,
    handleBotUpdate,
    initializeBot
};