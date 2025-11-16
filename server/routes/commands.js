// server/routes/commands.js
const express = require('express');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');

const router = express.Router();

// ✅ ADD NEW COMMAND
router.post('/', async (req, res) => {
    try {
        const { botToken, commandPatterns, code, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command for bot:', botToken.substring(0, 10) + '...');

        if (!botToken || !commandPatterns || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token, command patterns and code are required' 
            });
        }

        // Create command
        const { data: command, error } = await supabase
            .from('commands')
            .insert([{
                bot_token: botToken,
                command_patterns: commandPatterns.trim(),
                code: code.trim(),
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
            command: command
        });

    } catch (error) {
        console.error('❌ Add command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create command' 
        });
    }
});

// ✅ GET COMMANDS FOR BOT
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
        console.error('❌ Get commands error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch commands' 
        });
    }
});

// ✅ TEST COMMAND
router.post('/test-temp', async (req, res) => {
    try {
        const { command, botToken, testInput } = req.body;

        // Get admin chat ID for testing
        const { data: adminSettings, error: adminError } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        if (adminError || !adminSettings?.admin_chat_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Admin chat ID not set' 
            });
        }

        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active' 
            });
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
            text: testInput || command.command_patterns.split(',')[0]
        };

        // Execute command
        const result = await botManager.executeCommand(bot, command, testMessage, testInput);

        res.json({
            success: true,
            message: 'Command executed successfully!',
            testInput: testInput,
            chatId: adminSettings.admin_chat_id,
            result: result
        });

    } catch (error) {
        console.error('❌ Test command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command' 
        });
    }
});

// ✅ OTHER CRUD OPERATIONS (UPDATE, DELETE, TOGGLE)
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { commandPatterns, code, waitForAnswer, answerHandler, botToken } = req.body;

        const { data: command, error } = await supabase
            .from('commands')
            .update({
                command_patterns: commandPatterns.trim(),
                code: code.trim(),
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select('*')
            .single();

        if (error) throw error;

        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        res.json({
            success: true,
            message: 'Command updated successfully!',
            command: command
        });

    } catch (error) {
        console.error('❌ Update command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update command' 
        });
    }
});

router.delete('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        const { data: command, error: fetchError } = await supabase
            .from('commands')
            .select('bot_token')
            .eq('id', commandId)
            .single();

        if (fetchError || !command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        const { error: deleteError } = await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

        if (deleteError) throw deleteError;

        if (command.bot_token) {
            await botManager.updateCommandCache(command.bot_token);
        }

        res.json({ 
            success: true, 
            message: 'Command deleted successfully' 
        });

    } catch (error) {
        console.error('❌ Delete command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete command' 
        });
    }
});

module.exports = router;