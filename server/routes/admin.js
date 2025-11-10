const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// Get admin settings
router.get('/settings', async (req, res) => {
    try {
        const { data: settings, error } = await supabase
            .from('admin_settings')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({
            success: true,
            settings: settings || { admin_chat_id: null }
        });

    } catch (error) {
        console.error('Get admin settings error:', error);
        res.status(500).json({ error: 'Failed to fetch admin settings' });
    }
});

// Update admin settings
router.post('/settings', async (req, res) => {
    try {
        const { adminChatId, userId } = req.body;

        if (!adminChatId) {
            return res.status(400).json({ error: 'Admin chat ID is required' });
        }

        // Check if settings exist
        const { data: existingSettings } = await supabase
            .from('admin_settings')
            .select('id')
            .single();

        let result;
        if (existingSettings) {
            // Update existing
            result = await supabase
                .from('admin_settings')
                .update({
                    admin_chat_id: adminChatId,
                    admin_user_id: userId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSettings.id)
                .select('*')
                .single();
        } else {
            // Insert new
            result = await supabase
                .from('admin_settings')
                .insert([{
                    admin_chat_id: adminChatId,
                    admin_user_id: userId
                }])
                .select('*')
                .single();
        }

        if (result.error) throw result.error;

        res.json({
            success: true,
            message: 'Admin settings updated successfully!',
            settings: result.data
        });

    } catch (error) {
        console.error('Update admin settings error:', error);
        res.status(500).json({ error: 'Failed to update admin settings' });
    }
});

// Get admin statistics
router.get('/stats', async (req, res) => {
    try {
        // Get total users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id');

        // Get total bots
        const { data: bots, error: botsError } = await supabase
            .from('bots')
            .select('id');

        // Get total commands
        const { data: commands, error: commandsError } = await supabase
            .from('commands')
            .select('id');

        // Get active bots
        const { data: activeBots, error: activeBotsError } = await supabase
            .from('bots')
            .select('id')
            .eq('is_active', true);

        if (usersError || botsError || commandsError || activeBotsError) {
            throw new Error('Failed to fetch statistics');
        }

        res.json({
            success: true,
            stats: {
                totalUsers: users?.length || 0,
                totalBots: bots?.length || 0,
                totalCommands: commands?.length || 0,
                activeBots: activeBots?.length || 0
            }
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;