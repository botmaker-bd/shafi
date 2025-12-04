const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');

const router = express.Router();

// Add new bot
router.post('/add', async (req, res) => {
    try {
        const { token, name, userId } = req.body;

        console.log('🔄 Adding new bot for user:', userId);

        if (!token || !userId) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token and user ID are required' 
            });
        }

        // Validate bot token
        const testBot = new TelegramBot(token, { polling: false });
        let botInfo;
        try {
            botInfo = await testBot.getMe();
            console.log('✅ Bot token validated:', botInfo.username);
        } catch (error) {
            console.error('❌ Invalid bot token:', error.message);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid bot token. Please check your token and try again.' 
            });
        }

        // Check if bot already exists for this user
        const { data: existingBot, error: checkError } = await supabase
            .from('bots')
            .select('id, name')
            .eq('token', token)
            .eq('user_id', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingBot) {
            return res.status(400).json({ 
                success: false,
                error: `This bot is already added to your account as "${existingBot.name}"` 
            });
        }

        // Set webhook if using webhook mode
        const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        let webhookUrl = null;

        if (USE_WEBHOOK) {
            const baseUrl = process.env.BASE_URL;
            webhookUrl = `${baseUrl}/api/webhook/${token}`;
            
            console.log('🔗 Setting webhook:', webhookUrl);
            
            try {
                await testBot.setWebHook(webhookUrl);
                console.log('✅ Webhook set successfully');
            } catch (webhookError) {
                console.error('❌ Webhook set error:', webhookError);
                return res.status(400).json({ 
                    success: false,
                    error: 'Failed to set webhook. Please check your bot token.' 
                });
            }
        }

        // Save to database
        const { data: botData, error: dbError } = await supabase
            .from('bots')
            .insert([{
                token: token,
                name: name || botInfo.first_name,
                username: botInfo.username,
                user_id: userId,
                webhook_url: webhookUrl,
                is_active: true
            }])
            .select('*')
            .single();

        if (dbError) {
            console.error('❌ Database error:', dbError);
            throw dbError;
        }

        // Initialize bot in our system
        try {
            await botManager.initializeBot(token);
            console.log('✅ Bot initialized in system');
        } catch (initError) {
            console.error('❌ Bot initialization error:', initError);
            // Continue anyway, bot might initialize on next restart
        }

        res.json({
            success: true,
            message: 'Bot added successfully!',
            bot: botData,
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username
            },
            webhookUrl: webhookUrl
        });

    } catch (error) {
        console.error('❌ Add bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add bot. Please try again.' 
        });
    }
});

// Get user's bots
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('🔄 Fetching bots for user:', userId);

        const { data: bots, error } = await supabase
            .from('bots')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Database error:', error);
            throw error;
        }

        // Get command counts for each bot
        const botsWithStats = await Promise.all(
            (bots || []).map(async (bot) => {
                const { data: commands, error: cmdError } = await supabase
                    .from('commands')
                    .select('id', { count: 'exact' })
                    .eq('bot_token', bot.token)
                    .eq('is_active', true);

                return {
                    ...bot,
                    commands_count: cmdError ? 0 : commands.length
                };
            })
        );

        res.json({ 
            success: true,
            bots: botsWithStats 
        });

    } catch (error) {
        console.error('❌ Get bots error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch bots' 
        });
    }
});

// Get single bot
router.get('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;

        console.log('🔄 Fetching bot:', botId);

        const { data: bot, error } = await supabase
            .from('bots')
            .select('*')
            .eq('id', botId)
            .single();

        if (error || !bot) {
            console.error('❌ Bot not found:', botId);
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Get command count
        const { data: commands, error: cmdError } = await supabase
            .from('commands')
            .select('id', { count: 'exact' })
            .eq('bot_token', bot.token)
            .eq('is_active', true);

        const botWithStats = {
            ...bot,
            commands_count: cmdError ? 0 : commands.length
        };

        res.json({ 
            success: true,
            bot: botWithStats 
        });

    } catch (error) {
        console.error('❌ Get bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch bot details' 
        });
    }
});

// Delete bot
router.delete('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;

        console.log('🔄 Deleting bot:', botId);

        // Get bot details first
        const { data: bot, error: fetchError } = await supabase
            .from('bots')
            .select('token, name')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Remove webhook and stop bot
        if (bot.token) {
            try {
                const telegramBot = new TelegramBot(bot.token, { polling: false });
                await telegramBot.deleteWebHook();
                console.log('✅ Webhook deleted');
            } catch (webhookError) {
                console.error('❌ Webhook delete error:', webhookError);
            }

            // Remove from bot manager
            botManager.removeBot(bot.token);
        }

        // Delete from database (cascade will delete commands)
        const { error: deleteError } = await supabase
            .from('bots')
            .delete()
            .eq('id', botId);

        if (deleteError) {
            throw deleteError;
        }

        console.log('✅ Bot deleted successfully:', bot.name);

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

// Test bot token
router.post('/test', async (req, res) => {
    try {
        const { token } = req.body;

        console.log('🔄 Testing bot token');

        if (!token) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token is required' 
            });
        }

        const testBot = new TelegramBot(token, { polling: false });
        const botInfo = await testBot.getMe();

        res.json({
            success: true,
            message: 'Bot connection successful!',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username,
                can_join_groups: botInfo.can_join_groups,
                can_read_all_group_messages: botInfo.can_read_all_group_messages,
                supports_inline_queries: botInfo.supports_inline_queries
            }
        });

    } catch (error) {
        console.error('❌ Test bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to connect to bot. Please check your bot token.' 
        });
    }
});

// Test specific bot
router.post('/:botId/test', async (req, res) => {
    try {
        const { botId } = req.params;

        console.log('🔄 Testing bot:', botId);

        const { data: bot, error: fetchError } = await supabase
            .from('bots')
            .select('token, name')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
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
        console.error('❌ Test bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to connect to bot. Please check your bot configuration.' 
        });
    }
});

// Update bot
router.put('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const { name, is_active } = req.body;

        console.log('🔄 Updating bot:', botId);

        const { data: bot, error: updateError } = await supabase
            .from('bots')
            .update({
                name: name,
                is_active: is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', botId)
            .select('*')
            .single();

        if (updateError) {
            throw updateError;
        }

        // If bot was deactivated, remove it from active bots
        if (is_active === false && bot.token) {
            botManager.removeBot(bot.token);
        }

        res.json({
            success: true,
            message: 'Bot updated successfully!',
            bot: bot
        });

    } catch (error) {
        console.error('❌ Update bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update bot' 
        });
    }
});

module.exports = router;