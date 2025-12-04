// server/routes/bots.js - COMPLETE FIXED VERSION
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');
const router = express.Router();

// Middleware to extract user ID from JWT
const getUserIdFromToken = (req) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return null;
        
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-pro-secret-key-2024-safe';
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.userId;
    } catch (error) {
        console.error('❌ Token decode error:', error);
        return null;
    }
};

// Add new bot - FIXED VERSION
router.post('/add', async (req, res) => {
    try {
        const { token, name } = req.body;
        
        // ✅ FIX: Get user ID from JWT token
        const userId = getUserIdFromToken(req);
        
        console.log('🔄 Adding new bot for user:', userId, 'Token:', token?.substring(0, 15) + '...');

        if (!token || !userId) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token and authentication required' 
            });
        }

        // Validate bot token
        const testBot = new TelegramBot(token, { 
            polling: false,
            request: {
                timeout: 10000
            }
        });
        
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
            console.error('❌ Check existing bot error:', checkError);
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
            const baseUrl = process.env.BASE_URL || 'https://bot-maker-bd.onrender.com';
            webhookUrl = `${baseUrl}/api/webhook/${token}`;
            
            console.log('🔗 Setting webhook:', webhookUrl);
            
            try {
                // First delete existing webhook
                await testBot.deleteWebHook();
                
                // Set new webhook with detailed configuration
                await testBot.setWebHook(webhookUrl, {
                    max_connections: 40,
                    allowed_updates: [
                        'message', 'edited_message', 'channel_post', 'edited_channel_post',
                        'inline_query', 'chosen_inline_result', 'callback_query',
                        'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
                        'my_chat_member', 'chat_member', 'chat_join_request'
                    ],
                    drop_pending_updates: true
                });
                
                console.log('✅ Webhook set successfully');
                
                // Verify webhook was set
                const webhookInfo = await testBot.getWebHookInfo();
                console.log('📊 Webhook info:', {
                    url: webhookInfo.url,
                    has_custom_certificate: webhookInfo.has_custom_certificate,
                    pending_update_count: webhookInfo.pending_update_count
                });
                
            } catch (webhookError) {
                console.error('❌ Webhook set error:', webhookError);
                return res.status(400).json({ 
                    success: false,
                    error: `Failed to set webhook: ${webhookError.message}` 
                });
            }
        }

        // Save to database - WITHOUT bot_id field
        const { data: botData, error: dbError } = await supabase
            .from('bots')
            .insert([{
                token: token,
                name: name || botInfo.first_name,
                username: botInfo.username,
                user_id: userId,
                webhook_url: webhookUrl,
                is_active: true
                // ❌ bot_id: botInfo.id.toString() - REMOVED
            }])
            .select('*')
            .single();

        if (dbError) {
            console.error('❌ Database error saving bot:', dbError);
            throw dbError;
        }

        // Initialize bot in our system
        try {
            await botManager.initializeBot(token);
            console.log('✅ Bot initialized in system');
        } catch (initError) {
            console.error('❌ Bot initialization error:', initError);
            // Don't fail the request, just log the error
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
            webhookUrl: webhookUrl,
            mode: USE_WEBHOOK ? 'webhook' : 'polling'
        });

    } catch (error) {
        console.error('❌ Add bot error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add bot. Please try again.' 
        });
    }
});

// Get user's bots - FIXED VERSION
router.get('/user/:userId?', async (req, res) => {
    try {
        // ✅ FIX: Get user ID from params or JWT
        let userId = req.params.userId;
        if (!userId) {
            userId = getUserIdFromToken(req);
        }
        
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'User ID required' 
            });
        }

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
                    commands_count: cmdError ? 0 : commands?.length || 0,
                    webhook_status: bot.webhook_url ? '✅ Connected' : '❌ Not Set'
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
            commands_count: cmdError ? 0 : commands?.length || 0
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
            .select('token, name, user_id')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // ✅ FIX: Check if user owns this bot
        const userId = getUserIdFromToken(req);
        if (bot.user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                error: 'You are not authorized to delete this bot' 
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

        const testBot = new TelegramBot(token, { 
            polling: false,
            request: {
                timeout: 10000
            }
        });
        
        const botInfo = await testBot.getMe();

        // Also check if webhook can be set
        const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        let webhookTest = { success: false };
        
        if (USE_WEBHOOK) {
            try {
                const baseUrl = process.env.BASE_URL || 'https://bot-maker-bd.onrender.com';
                const webhookUrl = `${baseUrl}/api/webhook/${token}`;
                
                await testBot.deleteWebHook();
                await testBot.setWebHook(webhookUrl, {
                    max_connections: 40,
                    drop_pending_updates: true
                });
                
                webhookTest = {
                    success: true,
                    url: webhookUrl,
                    message: 'Webhook test successful'
                };
            } catch (webhookError) {
                webhookTest = {
                    success: false,
                    error: webhookError.message,
                    message: 'Webhook test failed but bot is valid'
                };
            }
        }

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
            },
            webhookTest: webhookTest,
            mode: USE_WEBHOOK ? 'webhook' : 'polling'
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

        // ✅ FIX: Check user authorization
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        const { data: bot, error: fetchError } = await supabase
            .from('bots')
            .select('token, name, user_id')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Check if user owns this bot
        if (bot.user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                error: 'You are not authorized to test this bot' 
            });
        }

        const testBot = new TelegramBot(bot.token, { 
            polling: false,
            request: {
                timeout: 10000
            }
        });
        
        const botInfo = await testBot.getMe();

        res.json({
            success: true,
            message: 'Bot connection successful!',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username
            },
            webhookStatus: bot.webhook_url ? '✅ Set' : '❌ Not Set'
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

        // ✅ FIX: Check user authorization
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        // Check if user owns this bot
        const { data: existingBot, error: checkError } = await supabase
            .from('bots')
            .select('user_id')
            .eq('id', botId)
            .single();

        if (checkError || !existingBot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        if (existingBot.user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                error: 'You are not authorized to update this bot' 
            });
        }

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

        // If bot was activated, reinitialize it
        if (is_active === true && bot.token) {
            try {
                await botManager.initializeBot(bot.token);
                console.log('✅ Reactivated bot in system');
            } catch (initError) {
                console.error('❌ Bot reactivation error:', initError);
            }
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

// Get bot webhook info
router.get('/:botId/webhook', async (req, res) => {
    try {
        const { botId } = req.params;

        console.log('🔄 Getting webhook info for bot:', botId);

        // ✅ FIX: Check user authorization
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        const { data: bot, error: fetchError } = await supabase
            .from('bots')
            .select('token, name, webhook_url, user_id')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Check if user owns this bot
        if (bot.user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                error: 'You are not authorized to access this bot' 
            });
        }

        let webhookInfo = null;
        
        if (bot.token) {
            try {
                const telegramBot = new TelegramBot(bot.token, { polling: false });
                webhookInfo = await telegramBot.getWebHookInfo();
            } catch (webhookError) {
                console.error('❌ Get webhook info error:', webhookError);
                webhookInfo = { error: webhookError.message };
            }
        }

        res.json({
            success: true,
            bot: {
                name: bot.name,
                webhook_url: bot.webhook_url
            },
            webhookInfo: webhookInfo
        });

    } catch (error) {
        console.error('❌ Get webhook info error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get webhook info' 
        });
    }
});

// Set webhook for bot
router.post('/:botId/set-webhook', async (req, res) => {
    try {
        const { botId } = req.params;

        console.log('🔄 Setting webhook for bot:', botId);

        // ✅ FIX: Check user authorization
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        const { data: bot, error: fetchError } = await supabase
            .from('bots')
            .select('token, name, user_id')
            .eq('id', botId)
            .single();

        if (fetchError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Check if user owns this bot
        if (bot.user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                error: 'You are not authorized to update this bot' 
            });
        }

        const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
        if (!USE_WEBHOOK) {
            return res.status(400).json({ 
                success: false,
                error: 'Webhook mode is not enabled' 
            });
        }

        const baseUrl = process.env.BASE_URL || 'https://bot-maker-bd.onrender.com';
        const webhookUrl = `${baseUrl}/api/webhook/${bot.token}`;
        
        console.log('🔗 Setting webhook:', webhookUrl);
        
        const telegramBot = new TelegramBot(bot.token, { polling: false });
        
        try {
            // First delete existing webhook
            await telegramBot.deleteWebHook();
            
            // Set new webhook
            await telegramBot.setWebHook(webhookUrl, {
                max_connections: 40,
                allowed_updates: [
                    'message', 'edited_message', 'channel_post', 'edited_channel_post',
                    'inline_query', 'chosen_inline_result', 'callback_query',
                    'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
                    'my_chat_member', 'chat_member', 'chat_join_request'
                ],
                drop_pending_updates: true
            });
            
            console.log('✅ Webhook set successfully');
            
            // Update database
            const { error: updateError } = await supabase
                .from('bots')
                .update({
                    webhook_url: webhookUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', botId);

            if (updateError) {
                throw updateError;
            }

            // Reinitialize bot in system
            try {
                await botManager.initializeBot(bot.token);
                console.log('✅ Bot reinitialized with webhook');
            } catch (initError) {
                console.error('❌ Bot reinitialization error:', initError);
            }

            res.json({
                success: true,
                message: 'Webhook set successfully!',
                webhookUrl: webhookUrl
            });

        } catch (webhookError) {
            console.error('❌ Webhook set error:', webhookError);
            res.status(400).json({ 
                success: false,
                error: `Failed to set webhook: ${webhookError.message}` 
            });
        }

    } catch (error) {
        console.error('❌ Set webhook error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to set webhook' 
        });
    }
});

module.exports = router;