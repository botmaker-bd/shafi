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
            settings: settings || { 
                admin_chat_id: null,
                admin_user_id: null
            }
        });

    } catch (error) {
        console.error('❌ Get admin settings error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch admin settings' 
        });
    }
});

// Update admin settings
router.post('/settings', async (req, res) => {
    try {
        const { adminChatId, userId, enableTesting, enableLogging } = req.body;

        if (!adminChatId) {
            return res.status(400).json({ 
                success: false,
                error: 'Admin chat ID is required' 
            });
        }

        // Check if settings already exist
        const { data: existingSettings, error: fetchError } = await supabase
            .from('admin_settings')
            .select('id')
            .single();

        let result;
        if (existingSettings) {
            // Update existing settings
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
            // Create new settings
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
        console.error('❌ Update admin settings error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update admin settings' 
        });
    }
});

// Get system statistics
router.get('/stats', async (req, res) => {
    try {
        // Get counts from database
        const [
            usersCount,
            botsCount,
            commandsCount,
            activeBotsCount
        ] = await Promise.all([
            // Users count
            supabase.from('users').select('id', { count: 'exact' }),
            // Bots count
            supabase.from('bots').select('id', { count: 'exact' }),
            // Commands count
            supabase.from('commands').select('id', { count: 'exact' }),
            // Active bots count
            supabase.from('bots').select('id', { count: 'exact' }).eq('is_active', true)
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: usersCount.count || 0,
                totalBots: botsCount.count || 0,
                totalCommands: commandsCount.count || 0,
                activeBots: activeBotsCount.count || 0,
                todayMessages: 0, // You can implement message tracking later
                systemUptime: process.uptime()
            }
        });

    } catch (error) {
        console.error('❌ Get admin stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch statistics' 
        });
    }
});

// Get system info
router.get('/system-info', async (req, res) => {
    try {
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            serverTime: new Date().toISOString()
        };

        res.json({
            success: true,
            systemInfo: systemInfo
        });

    } catch (error) {
        console.error('❌ Get system info error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch system information' 
        });
    }
});

// Get error logs
router.get('/error-logs', async (req, res) => {
    try {
        const { data: errors, error } = await supabase
            .from('universal_data')
            .select('*')
            .eq('data_type', 'error_log')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const parsedErrors = (errors || []).map(error => {
            try {
                const errorData = JSON.parse(error.data_value);
                return {
                    id: error.id,
                    timestamp: error.created_at,
                    ...errorData
                };
            } catch (parseError) {
                return {
                    id: error.id,
                    timestamp: error.created_at,
                    message: 'Failed to parse error data',
                    rawData: error.data_value
                };
            }
        });

        res.json({
            success: true,
            errors: parsedErrors
        });

    } catch (error) {
        console.error('❌ Get error logs error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch error logs' 
        });
    }
});

// Clear error logs
router.delete('/error-logs', async (req, res) => {
    try {
        const { error } = await supabase
            .from('universal_data')
            .delete()
            .eq('data_type', 'error_log');

        if (error) throw error;

        res.json({
            success: true,
            message: 'Error logs cleared successfully'
        });

    } catch (error) {
        console.error('❌ Clear error logs error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to clear error logs' 
        });
    }
});

module.exports = router;