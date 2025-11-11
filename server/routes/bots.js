const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');

const router = express.Router();

// const express = require('express');
// const TelegramBot = require('node-telegram-bot-api');
// const supabase = require('../config/supabase');
// const botManager = require('../core/bot-manager');

// const router = express.Router();

router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        if (!token || !userId) {
            return res.status(400).json({ error: 'Bot token and user ID are required' });
        }

        // Validate bot token
        const testBot = new TelegramBot(token, { polling: false });
        let botInfo;
        try {
            botInfo = await testBot.getMe();
        } catch (error) {
            return res.status(400).json({ error: 'Invalid bot token' });
        }

        // Check if bot already exists for this user
        const { data: existingBot } = await supabase
            .from('bots')
            .select('id')
            .eq('token', token)
            .eq('user_id', userId)
            .single();

        if (existingBot) {
            return res.status(400).json({ error: 'This bot is already added to your account' });
        }

        // 🔥 Set webhook to our server
        const baseUrl = process.env.BASE_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + (process.env.PORT || 3000)}`;
        const webhookUrl = `${baseUrl}/api/webhook/${token}`;
        
        console.log('🔗 Setting webhook:', webhookUrl);
        
        try {
            await testBot.setWebHook(webhookUrl);
            console.log(`✅ Webhook set successfully: ${webhookUrl}`);
        } catch (webhookError) {
            console.error('❌ Webhook set error:', webhookError);
            return res.status(400).json({ error: 'Failed to set webhook. Please check your bot token.' });
        }

        // Save to database
        const { data: botData, error } = await supabase
            .from('bots')
            .insert([{
                token,
                name: name || botInfo.first_name,
                username: botInfo.username,
                user_id: userId,
                webhook_url: webhookUrl,
                is_active: true
            }])
            .select('*')
            .single();

        if (error) throw error;

        // Initialize bot in our system
        await botManager.initializeBot(token);

        res.json({
            success: true,
            message: 'Bot added successfully!',
            bot: botData,
            webhookUrl: webhookUrl
        });

    } catch (error) {
        console.error('Add bot error:', error);
        res.status(500).json({ error: 'Failed to add bot. Please try again.' });
    }
});

// ... other routes remain same

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
            bots: bots || [] 
        });

    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
    }
});

router.get('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;

        const { data: bot, error } = await supabase
            .from('bots')
            .select('*')
            .eq('id', botId)
            .single();

        if (error || !bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        res.json({ 
            success: true,
            bot 
        });

    } catch (error) {
        console.error('Get bot error:', error);
        res.status(500).json({ error: 'Failed to fetch bot details' });
    }
});

router.delete('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;

        const { data: bot } = await supabase
            .from('bots')
            .select('token')
            .eq('id', botId)
            .single();

        if (bot) {
            try {
                const telegramBot = new TelegramBot(bot.token, { polling: false });
                await telegramBot.deleteWebHook();
            } catch (webhookError) {
                console.error('Webhook delete error:', webhookError);
            }

            botManager.removeBot(bot.token);
        }

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
        res.status(500).json({ error: 'Failed to remove bot' });
    }
});

router.post('/test', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Bot token is required' });
        }

        const testBot = new TelegramBot(token, { polling: false });
        const botInfo = await testBot.getMe();

        res.json({
            success: true,
            message: 'Bot connection successful!',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username
            }
        });

    } catch (error) {
        console.error('Test bot error:', error);
        res.status(500).json({ error: 'Failed to connect to bot. Please check your bot token.' });
    }
});

router.post('/:botId/test', async (req, res) => {
    try {
        const { botId } = req.params;

        const { data: bot } = await supabase
            .from('bots')
            .select('token, name')
            .eq('id', botId)
            .single();

        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const testBot = new TelegramBot(bot.token, { polling: false });
        const botInfo = await testBot.getMe();

        res.json({
            success: true,
            message: 'Bot connection successful!',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username
            }
        });

    } catch (error) {
        console.error('Test bot error:', error);
        res.status(500).json({ error: 'Failed to connect to bot. Please check your bot token.' });
    }
});

module.exports = router;