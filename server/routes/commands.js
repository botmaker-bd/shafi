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

        if (error) {
            console.error('Get commands error:', error);
            return res.status(500).json({ error: 'Failed to fetch commands' });
        }

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

// Add new command - FIXED MULTIPLE PATTERNS
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command:', { name, pattern, botToken: botToken?.substring(0, 10) + '...' });

        if (!botToken || !name || !pattern || !code) {
            return res.status(400).json({ error: 'Bot token, name, pattern and code are required' });
        }

        // Process multiple patterns
        const patterns = pattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ error: 'At least one command pattern is required' });
        }

        // Check for duplicate command patterns
        for (const singlePattern of patterns) {
            const { data: existingCommands } = await supabase
                .from('commands')
                .select('id, pattern')
                .eq('bot_token', botToken)
                .eq('is_active', true);

            if (existingCommands) {
                for (const existingCmd of existingCommands) {
                    const existingPatterns = existingCmd.pattern.split(',').map(p => p.trim());
                    if (existingPatterns.includes(singlePattern)) {
                        return res.status(400).json({ 
                            error: `Command pattern "${singlePattern}" already exists for this bot` 
                        });
                    }
                }
            }
        }

        // Format code properly
        const formattedCode = this.formatCode(code);

        // Insert command with all patterns
        const { data: command, error } = await supabase
            .from('commands')
            .insert([{
                bot_token: botToken,
                name: name.trim(),
                pattern: patterns.join(', '),
                code: formattedCode,
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                is_active: true
            }])
            .select('*')
            .single();

        if (error) {
            console.error('Create command error:', error);
            throw error;
        }

        // Update command cache
        await botManager.updateCommandCache(botToken);

        console.log('✅ Command created successfully with patterns:', patterns.length);

        res.json({
            success: true,
            message: `Command created successfully with ${patterns.length} patterns!`,
            command
        });

    } catch (error) {
        console.error('Add command error:', error);
        res.status(500).json({ error: 'Failed to create command: ' + error.message });
    }
});

// Update command
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { name, pattern, code, description, waitForAnswer, answerHandler, botToken } = req.body;

        console.log('🔄 Updating command:', { commandId, name, pattern });

        if (!name || !pattern || !code) {
            return res.status(400).json({ error: 'Name, pattern and code are required' });
        }

        // Process multiple patterns
        const patterns = pattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ error: 'At least one command pattern is required' });
        }

        // Check for duplicate command patterns (excluding current command)
        const { data: existingCommands } = await supabase
            .from('commands')
            .select('id, pattern')
            .eq('bot_token', botToken)
            .eq('is_active', true)
            .neq('id', commandId);

        if (existingCommands) {
            for (const singlePattern of patterns) {
                for (const existingCmd of existingCommands) {
                    const existingPatterns = existingCmd.pattern.split(',').map(p => p.trim());
                    if (existingPatterns.includes(singlePattern)) {
                        return res.status(400).json({ 
                            error: `Another command with pattern "${singlePattern}" already exists` 
                        });
                    }
                }
            }
        }

        // Format code properly
        const formattedCode = this.formatCode(code);
        const formattedAnswerHandler = answerHandler ? this.formatCode(answerHandler) : null;

        // Update command
        const { data: command, error: updateError } = await supabase
            .from('commands')
            .update({
                name: name.trim(),
                pattern: patterns.join(', '),
                code: formattedCode,
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: formattedAnswerHandler,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select('*')
            .single();

        if (updateError) {
            console.error('Update command error:', updateError);
            throw updateError;
        }

        // Update command cache
        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        console.log('✅ Command updated successfully:', commandId);

        res.json({
            success: true,
            message: 'Command updated successfully!',
            command
        });

    } catch (error) {
        console.error('Update command error:', error);
        res.status(500).json({ error: 'Failed to update command: ' + error.message });
    }
});

// Delete command
router.delete('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        console.log('🔄 Deleting command:', commandId);

        // Get command details for cache update
        const { data: command } = await supabase
            .from('commands')
            .select('bot_token')
            .eq('id', commandId)
            .single();

        // Delete command
        const { error: deleteError } = await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

        if (deleteError) {
            console.error('Delete command error:', deleteError);
            throw deleteError;
        }

        // Update command cache
        if (command?.bot_token) {
            await botManager.updateCommandCache(command.bot_token);
        }

        console.log('✅ Command deleted successfully:', commandId);

        res.json({ 
            success: true, 
            message: 'Command deleted successfully' 
        });

    } catch (error) {
        console.error('Delete command error:', error);
        res.status(500).json({ error: 'Failed to delete command: ' + error.message });
    }
});

// Test command execution - FIXED VERSION
router.post('/:commandId/test', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { botToken } = req.body;

        console.log('🔄 Testing command:', { commandId, botToken: botToken?.substring(0, 10) + '...' });

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

        // Use first pattern for testing
        const patterns = command.pattern.split(',').map(p => p.trim());
        const testPattern = patterns[0];

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testPattern
        };

        // Execute command
        await botManager.executeCommand(bot, command, testMessage, true);

        console.log('✅ Command test executed successfully:', commandId);

        res.json({
            success: true,
            message: 'Command test executed successfully! Check your admin Telegram account for results.'
        });

    } catch (error) {
        console.error('Test command error:', error);
        res.status(500).json({ error: 'Failed to test command: ' + error.message });
    }
});

// Test temporary command without saving - FIXED VERSION
router.post('/test-temp', async (req, res) => {
    try {
        const { command, botToken } = req.body;

        if (!command || !botToken) {
            return res.status(400).json({ error: 'Command and bot token are required' });
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

        // Use first pattern for testing
        const patterns = command.pattern.split(',').map(p => p.trim());
        const testPattern = patterns[0];

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testPattern
        };

        // Create temporary command object
        const tempCommand = {
            name: command.name,
            pattern: command.pattern,
            code: command.code,
            wait_for_answer: command.waitForAnswer || false,
            answer_handler: command.answerHandler || ''
        };

        // Execute command
        await botManager.executeCommand(bot, tempCommand, testMessage, true);

        res.json({
            success: true,
            message: 'Temporary command test executed successfully! Check your admin Telegram account for results.'
        });

    } catch (error) {
        console.error('Test temp command error:', error);
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

// Helper function to format code properly
function formatCode(code) {
    if (!code) return code;
    
    // Remove extra spaces and fix formatting
    return code
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\(\s+/g, '(') // Remove spaces after (
        .replace(/\s+\)/g, ')') // Remove spaces before )
        .replace(/\{\s+/g, '{ ') // Standardize { spacing
        .replace(/\s+\}/g, ' }') // Standardize } spacing
        .replace(/\,\s+/g, ', ') // Standardize , spacing
        .replace(/\s+\;/g, ';') // Remove spaces before ;
        .trim();
}

module.exports = router;