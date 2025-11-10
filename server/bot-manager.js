const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active bots and their commands
const activeBots = new Map();
const botCommands = new Map();

// Initialize all bots
async function initializeAllBots() {
    try {
        console.log('🔄 Initializing bots...');
        const { data: bots } = await supabase
            .from('bots')
            .select('token')
            .eq('is_active', true);

        for (const bot of bots) {
            await initializeBot(bot.token);
        }
        console.log(`✅ Initialized ${bots.length} bots`);
    } catch (error) {
        console.error('❌ Initialize bots error:', error);
    }
}

// Initialize a bot
async function initializeBot(token) {
    try {
        // Get commands
        const { data: commands } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', token)
            .eq('is_active', true);

        // Create bot instance
        const bot = new TelegramBot(token);
        
        // Store commands
        botCommands.set(token, commands);
        
        // Setup message handler
        bot.on('message', async (msg) => {
            await handleMessage(bot, token, msg);
        });

        // Store bot
        activeBots.set(token, bot);
        
        console.log(`✅ Bot initialized with ${commands.length} commands`);
        
    } catch (error) {
        console.error('❌ Initialize bot error:', error);
    }
}

// Handle incoming messages
async function handleMessage(bot, token, msg) {
    try {
        if (!msg.text) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const commands = botCommands.get(token) || [];

        console.log(`📩 Message: "${text}" from ${msg.from.first_name}`);

        // Find matching command
        let matchedCommand = null;
        for (const cmd of commands) {
            if (text === cmd.pattern) {
                matchedCommand = cmd;
                break;
            }
        }

        if (matchedCommand) {
            console.log(`🎯 Executing: ${matchedCommand.name}`);
            await executeCommand(bot, matchedCommand, msg);
        } else {
            console.log('❌ No command matched');
            await bot.sendMessage(chatId, 
                '❌ Command not found. Use /start to begin.',
                { reply_to_message_id: msg.message_id }
            );
        }

    } catch (error) {
        console.error('❌ Handle message error:', error);
    }
}

// Execute command
async function executeCommand(bot, command, msg) {
    try {
        const result = await executeCommandCode(bot, command.code, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name
        });

        return result;

    } catch (error) {
        console.error(`❌ Command "${command.name}" error:`, error);
        
        const errorMessage = `
❌ *Command Error*

*Command:* ${command.name}
*Description:* ${command.description || 'No description'}

*Error:* ${error.message}

Please try again later.
        `.trim();

        await bot.sendMessage(msg.chat.id, errorMessage, {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    }
}

// Execute command code
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name } = context;
    
    const safeFunctions = {
        sendMessage: (text, options = {}) => {
            return bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        sendPhoto: (photo, options = {}) => bot.sendPhoto(chatId, photo, options),
        sendDocument: (doc, options = {}) => bot.sendDocument(chatId, doc, options),
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User'
        }),
        getMessage: () => msg,
        getChatId: () => chatId
    };

    const wrappedCode = `
        try {
            ${code}
        } catch (error) {
            throw new Error('Execution failed: ' + error.message);
        }
    `;

    const func = new Function(...Object.keys(safeFunctions), wrappedCode);
    return await func(...Object.values(safeFunctions));
}

// Handle bot updates
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
        console.error('❌ Handle bot update error:', error);
    }
}

// API Routes

// Add bot
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        // Validate bot
        const testBot = new TelegramBot(token, { polling: false });
        const botInfo = await testBot.getMe();

        // Save to database
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

// Initialize on start
setTimeout(() => {
    initializeAllBots();
}, 1000);

module.exports = {
    router,
    handleBotUpdate
};