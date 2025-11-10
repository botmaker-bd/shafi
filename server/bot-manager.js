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

        console.log('Adding new bot for user:', userId);

        // Validate bot token
        const bot = new TelegramBot(token, { polling: false });
        const botInfo = await bot.getMe();
        
        console.log('Bot info received:', botInfo.username);

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

        console.log('Bot stored in database:', botData.id);

        // Set webhook
        await bot.setWebHook(`https://bot-maker-jcch.onrender.com/bot?token=${token}`);
        console.log('Webhook set successfully');

        // Initialize bot
        await initializeBot(token);
        console.log('Bot initialized successfully');

        res.json({
            message: 'Bot added successfully',
            bot: botData
        });

    } catch (error) {
        console.error('Add bot error:', error);
        res.status(500).json({ error: 'Failed to add bot: ' + error.message });
    }
});

// Get user's bots
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('Fetching bots for user:', userId);

        const { data: bots, error } = await supabase
            .from('bots')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('Bots found:', bots.length);
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

        console.log('Removing bot:', botId);

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
            console.log('Webhook deleted and bot removed from active bots');
        }

        // Remove from database
        await supabase
            .from('bots')
            .delete()
            .eq('id', botId);

        console.log('Bot removed from database');
        res.json({ message: 'Bot removed successfully' });

    } catch (error) {
        console.error('Remove bot error:', error);
        res.status(500).json({ error: 'Failed to remove bot' });
    }
});

// Initialize bot with commands
async function initializeBot(token) {
    try {
        console.log('Initializing bot with token:', token.substring(0, 10) + '...');

        // Get commands from database
        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching commands:', error);
            return;
        }

        console.log('Commands found for bot:', commands?.length || 0);

        const bot = new TelegramBot(token);
        
        // Setup command handlers
        commands?.forEach(command => {
            console.log(`Setting up command: ${command.name} with pattern: ${command.pattern}`);
            
            bot.onText(new RegExp(command.pattern), async (msg, match) => {
                console.log(`Command triggered: ${command.name} by user: ${msg.from.id}`);
                await handleCommand(bot, command, msg, match);
            });
        });

        // Handle callback queries
        bot.on('callback_query', async (callbackQuery) => {
            console.log('Callback query received:', callbackQuery.data);
            await handleCallbackQuery(bot, callbackQuery);
        });

        // Handle all messages (fallback)
        bot.on('message', async (msg) => {
            console.log('Message received:', msg.text?.substring(0, 50));
            // You can add default message handling here
        });

        activeBots.set(token, bot);
        console.log('Bot initialized and added to active bots');
        
    } catch (error) {
        console.error('Initialize bot error:', error);
    }
}

// Handle commands
// Handle commands - UPDATED
async function handleCommand(bot, command, msg, match) {
    try {
        const chatId = msg.chat.id;
        console.log(`Executing command: ${command.name} for chat: ${chatId}`);
        
        // Execute command code
        const result = await executeCommandCode(command.code, {
            bot,
            msg,
            match,
            chatId,
            userId: msg.from.id,
            username: msg.from.username
        });

        console.log('Command execution result:', result);

    } catch (error) {
        console.error('Command execution error:', error);
        try {
            await bot.sendMessage(msg.chat.id, '❌ Error executing command. Please try again.');
        } catch (sendError) {
            console.error('Failed to send error message:', sendError);
        }
    }
}

// Execute command code safely - UPDATED
async function executeCommandCode(code, context) {
    try {
        const { bot, msg, match, chatId, userId, username } = context;
        
        // Create safe execution environment
        const safeFunctions = {
            sendMessage: (text, options = {}) => {
                console.log('Sending message to chat:', chatId);
                return bot.sendMessage(chatId, text, options);
            },
            sendPhoto: (photo, options = {}) => bot.sendPhoto(chatId, photo, options),
            sendDocument: (doc, options = {}) => bot.sendDocument(chatId, doc, options),
            getUser: () => ({ id: userId, username, first_name: msg.from.first_name }),
            getMatch: () => match,
            getMessage: () => msg
        };

        // Wrap the code in async function
        const wrappedCode = `
            try {
                ${code}
            } catch(error) {
                console.error('Code execution error:', error);
                return 'Error: ' + error.message;
            }
        `;

        // Create and execute the function
        const func = new Function(...Object.keys(safeFunctions), wrappedCode);
        const result = await func(...Object.values(safeFunctions));
        
        return result;

    } catch (error) {
        console.error('Code execution wrapper error:', error);
        throw error;
    }
}

// Handle callback queries
async function handleCallbackQuery(bot, callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        console.log('Processing callback query:', data);
        
        // Handle different callback actions
        switch(data) {
            case 'show_help':
                await bot.sendMessage(chatId, "📚 *Help Guide*\n\nAvailable commands:\n/start - Welcome message\n/help - Help information", {parse_mode: "Markdown"});
                break;
                
            case 'show_about':
                await bot.sendMessage(chatId, "ℹ️ *About This Bot*\n\nCreated with Bot Maker platform.", {parse_mode: "Markdown"});
                break;
                
            case 'show_features':
                await bot.sendMessage(chatId, "🔧 *Features*\n\n• Automated messaging\n• Easy command setup\n• User-friendly interface", {parse_mode: "Markdown"});
                break;
                
            case 'show_contact':
                await bot.sendMessage(chatId, "📞 *Contact*\n\nEmail: support@example.com", {parse_mode: "Markdown"});
                break;
                
            default:
                console.log('Unknown callback data:', data);
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
        console.log('Callback query processed');

    } catch (error) {
        console.error('Callback query error:', error);
    }
}

// Execute command code safely - FIXED VERSION

// Handle bot updates from webhook
async function handleBotUpdate(token, update) {
    try {
        console.log('Webhook update received for token:', token.substring(0, 10) + '...');
        
        let bot = activeBots.get(token);
        if (!bot) {
            console.log('Bot not active, initializing...');
            await initializeBot(token);
            bot = activeBots.get(token);
        }
        
        if (bot) {
            console.log('Processing update with bot...');
            await bot.processUpdate(update);
        } else {
            console.error('Bot still not available after initialization');
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