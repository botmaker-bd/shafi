const express = require('express');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');

const router = express.Router();

// Get commands for bot
router.get('/bot/:botToken', async (req, res) => {
    try {
        const { botToken } = req.params;

        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', botToken)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ 
            success: true,
            commands: commands || [] 
        });

    } catch (error) {
        console.error('Get commands error:', error);
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});

// Get single command
router.get('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            return res.status(404).json({ error: 'Command not found' });
        }

        res.json({ 
            success: true,
            command 
        });

    } catch (error) {
        console.error('Get command error:', error);
        res.status(500).json({ error: 'Failed to fetch command' });
    }
});

// Add new command
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description, waitForAnswer, answerHandler } = req.body;

        if (!botToken || !name || !pattern || !code) {
            return res.status(400).json({ error: 'Bot token, name, pattern and code are required' });
        }

        // Check for duplicate command pattern
        const { data: existingCommand } = await supabase
            .from('commands')
            .select('id')
            .eq('bot_token', botToken)
            .eq('pattern', pattern)
            .single();

        if (existingCommand) {
            return res.status(400).json({ error: 'A command with this pattern already exists' });
        }

        // Insert command
        const { data: command, error } = await supabase
            .from('commands')
            .insert([{
                bot_token: botToken,
                name: name.trim(),
                pattern: pattern.trim(),
                code: code.trim(),
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                is_active: true
            }])
            .select('*')
            .single();

        if (error) throw error;

        // Update command cache
        await botManager.updateCommandCache(botToken);

        res.json({
            success: true,
            message: 'Command created successfully!',
            command
        });

    } catch (error) {
        console.error('Add command error:', error);
        res.status(500).json({ error: 'Failed to create command' });
    }
});

// Update command
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { name, pattern, code, description, waitForAnswer, answerHandler, botToken } = req.body;

        if (!name || !pattern || !code) {
            return res.status(400).json({ error: 'Name, pattern and code are required' });
        }

        // Check for duplicate command pattern (excluding current command)
        const { data: existingCommand } = await supabase
            .from('commands')
            .select('id')
            .eq('bot_token', botToken)
            .eq('pattern', pattern)
            .neq('id', commandId)
            .single();

        if (existingCommand) {
            return res.status(400).json({ error: 'Another command with this pattern already exists' });
        }

        // Update command
        const { data: command, error } = await supabase
            .from('commands')
            .update({
                name: name.trim(),
                pattern: pattern.trim(),
                code: code.trim(),
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select('*')
            .single();

        if (error) throw error;

        // Update command cache
        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        res.json({
            success: true,
            message: 'Command updated successfully!',
            command
        });

    } catch (error) {
        console.error('Update command error:', error);
        res.status(500).json({ error: 'Failed to update command' });
    }
});

// Delete command
router.delete('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        // Get command details for cache update
        const { data: command } = await supabase
            .from('commands')
            .select('bot_token')
            .eq('id', commandId)
            .single();

        // Delete command
        await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

        // Update command cache
        if (command?.bot_token) {
            await botManager.updateCommandCache(command.bot_token);
        }

        res.json({ 
            success: true, 
            message: 'Command deleted successfully' 
        });

    } catch (error) {
        console.error('Delete command error:', error);
        res.status(500).json({ error: 'Failed to delete command' });
    }
});

// Test command execution
router.post('/:commandId/test', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { botToken } = req.body;

        if (!botToken) {
            return res.status(400).json({ error: 'Bot token is required for testing' });
        }

        // Get command details
        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            return res.status(404).json({ error: 'Command not found' });
        }

        // Get bot instance
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ error: 'Bot is not active. Please check if bot is properly initialized.' });
        }

        // Get admin chat ID for testing
        const { data: adminSettings } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        if (!adminSettings?.admin_chat_id) {
            return res.status(400).json({ error: 'Admin chat ID not set. Please set admin settings first.' });
        }

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: command.pattern
        };

        // Execute command
        await botManager.executeCommand(bot, command, testMessage, true);

        res.json({
            success: true,
            message: 'Command test executed successfully! Check your admin Telegram account for results.'
        });

    } catch (error) {
        console.error('Test command error:', error);
        res.status(500).json({ error: 'Failed to test command: ' + error.message });
    }
});

// Toggle command status
router.patch('/:commandId/toggle', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { isActive, botToken } = req.body;

        // Update command status
        const { data: command, error } = await supabase
            .from('commands')
            .update({
                is_active: isActive,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select('*')
            .single();

        if (error) throw error;

        // Update command cache
        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        res.json({
            success: true,
            message: `Command ${isActive ? 'activated' : 'deactivated'} successfully!`,
            command
        });

    } catch (error) {
        console.error('Toggle command error:', error);
        res.status(500).json({ error: 'Failed to toggle command status' });
    }
});

module.exports = router;