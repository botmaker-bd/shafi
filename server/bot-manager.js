const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

const activeBots = new Map();

// Add bot endpoint
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

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

        // Initialize bot
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

// Initialize bot
async function initializeBot(token) {
    try {
        // Get commands
        const { data: commands } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        const bot = new TelegramBot(token);
        
        // Setup command handlers
        commands?.forEach(command => {
            bot.onText(new RegExp(command.pattern), async (msg, match) => {
                await handleCommand(bot, command, msg, match);
            });
        });

        // Handle callbacks
        bot.on('callback_query', async (callbackQuery) => {
            await handleCallbackQuery(bot, callbackQuery);
        });

        activeBots.set(token, bot);
        
    } catch (error) {
        console.error('Initialize bot error:', error);
    }
}

// Handle commands
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
        await bot.sendMessage(msg.chat.id, 'Error executing command');
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    try {
        await bot.answerCallbackQuery(callbackQuery.id);
        // Add callback logic here
    } catch (error) {
        console.error('Callback query error:', error);
    }
}

// Execute command code safely
async function executeCommandCode(code, context) {
    try {
        const { bot, msg, match, chatId, userId, username } = context;
        
        const safeFunctions = {
            sendMessage: (text, options = {}) => bot.sendMessage(chatId, text, options),
            sendPhoto: (photo, options = {}) => bot.sendPhoto(chatId, photo, options),
            sendDocument: (doc, options = {}) => bot.sendDocument(chatId, doc, options),
            getUser: () => ({ id: userId, username }),
            getMatch: () => match,
            getMessage: () => msg
        };

        const wrappedCode = `
            return (async function() {
                ${code}
            })();
        `;

        const func = new Function(...Object.keys(safeFunctions), wrappedCode);
        const result = await func(...Object.values(safeFunctions));
        return result;

    } catch (error) {
        console.error('Code execution error:', error);
        return 'Error: ' + error.message;
    }
}

// Handle bot updates from webhook
async function handleBotUpdate(token, update) {
    try {
        let bot = activeBots.get(token);
        if (!bot) {
            await initializeBot(token);
            bot = activeBots.get(token);
        }
        if (bot) {
            await bot.processUpdate(update);
        }
    } catch (error) {
        console.error('Handle bot update error:', error);
    }
}

module.exports = {
    router,
    handleBotUpdate,
    initializeBot
};