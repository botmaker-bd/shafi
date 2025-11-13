const express = require('express');
const supabase = require('../config/supabase');
const botManager = require('../core/bot-manager');

const router = express.Router();

// Get commands for bot
router.get('/bot/:botToken', async (req, res) => {
    try {
        const { botToken } = req.params;

        console.log('🔄 Fetching commands for bot:', botToken.substring(0, 15) + '...');

        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', botToken)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Get commands error:', error);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to fetch commands' 
            });
        }

        // Group commands by name for the frontend
        const groupedCommands = {};
        commands.forEach(command => {
            if (!groupedCommands[command.name]) {
                groupedCommands[command.name] = [];
            }
            groupedCommands[command.name].push(command);
        });

        res.json({ 
            success: true,
            commands: commands || [],
            groupedCommands: groupedCommands
        });

    } catch (error) {
        console.error('❌ Get commands error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch commands' 
        });
    }
});

// Get single command
router.get('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        console.log('🔄 Fetching command:', commandId);

        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        res.json({ 
            success: true,
            command 
        });

    } catch (error) {
        console.error('❌ Get command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch command' 
        });
    }
});

// Add new command
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command:', { 
            name, 
            pattern: pattern?.substring(0, 50) + '...',
            botToken: botToken?.substring(0, 10) + '...' 
        });

        if (!botToken || !name || !pattern || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token, name, pattern and code are required' 
            });
        }

        // Parse multiple patterns
        const patterns = pattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'At least one command pattern is required' 
            });
        }

        // Check for duplicate command patterns
        for (const singlePattern of patterns) {
            const { data: existingCommand, error: checkError } = await supabase
                .from('commands')
                .select('id, name')
                .eq('bot_token', botToken)
                .eq('pattern', singlePattern)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingCommand) {
                return res.status(400).json({ 
                    success: false,
                    error: `Command pattern "${singlePattern}" already exists in command "${existingCommand.name}"` 
                });
            }
        }

        // Insert command for each pattern
        const commandPromises = patterns.map(singlePattern => 
            supabase
                .from('commands')
                .insert([{
                    bot_token: botToken,
                    name: name.trim(),
                    pattern: singlePattern,
                    code: code.trim(),
                    description: description?.trim() || '',
                    wait_for_answer: waitForAnswer || false,
                    answer_handler: answerHandler?.trim() || null,
                    is_active: true
                }])
                .select('*')
                .single()
        );

        const results = await Promise.all(commandPromises);
        const commands = results.map(result => result.data).filter(cmd => cmd);

        if (commands.length === 0) {
            throw new Error('Failed to create any commands');
        }

        // Update command cache
        await botManager.updateCommandCache(botToken);

        console.log('✅ Commands created successfully:', commands.length);

        res.json({
            success: true,
            message: `Commands created successfully! (${commands.length} patterns)`,
            commands: commands
        });

    } catch (error) {
        console.error('❌ Add command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create command: ' + error.message 
        });
    }
});

// Update command
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { name, pattern, code, description, waitForAnswer, answerHandler, botToken } = req.body;

        console.log('🔄 Updating command:', { commandId, name, pattern: pattern?.substring(0, 50) + '...' });

        if (!name || !pattern || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Name, pattern and code are required' 
            });
        }

        // Parse multiple patterns
        const patterns = pattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'At least one command pattern is required' 
            });
        }

        // Check for duplicate command patterns (excluding current command)
        for (const singlePattern of patterns) {
            const { data: existingCommand, error: checkError } = await supabase
                .from('commands')
                .select('id, name')
                .eq('bot_token', botToken)
                .eq('pattern', singlePattern)
                .neq('id', commandId)
                .neq('name', name.trim()) // Allow same pattern for same command name
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingCommand) {
                return res.status(400).json({ 
                    success: false,
                    error: `Another command "${existingCommand.name}" already uses pattern "${singlePattern}"` 
                });
            }
        }

        // For simplicity, we'll update the first pattern and delete others
        // Then create new commands for additional patterns
        const mainPattern = patterns[0];
        const additionalPatterns = patterns.slice(1);

        // Update main command
        const { data: command, error: updateError } = await supabase
            .from('commands')
            .update({
                name: name.trim(),
                pattern: mainPattern,
                code: code.trim(),
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select('*')
            .single();

        if (updateError) {
            console.error('❌ Update command error:', updateError);
            throw updateError;
        }

        // Delete other commands with same name for this bot (cleanup)
        const { error: deleteError } = await supabase
            .from('commands')
            .delete()
            .eq('bot_token', botToken)
            .eq('name', name.trim())
            .neq('id', commandId);

        if (deleteError) {
            console.error('❌ Delete old commands error:', deleteError);
        }

        // Create additional commands for extra patterns
        if (additionalPatterns.length > 0) {
            const additionalPromises = additionalPatterns.map(pattern => 
                supabase
                    .from('commands')
                    .insert([{
                        bot_token: botToken,
                        name: name.trim(),
                        pattern: pattern,
                        code: code.trim(),
                        description: description?.trim() || '',
                        wait_for_answer: waitForAnswer || false,
                        answer_handler: answerHandler?.trim() || null,
                        is_active: true
                    }])
            );

            await Promise.all(additionalPromises);
        }

        // Update command cache
        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        console.log('✅ Command updated successfully:', commandId);

        res.json({
            success: true,
            message: `Command updated successfully! (${patterns.length} patterns)`,
            command: command
        });

    } catch (error) {
        console.error('❌ Update command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update command: ' + error.message 
        });
    }
});

// Delete command
router.delete('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        console.log('🔄 Deleting command:', commandId);

        // Get command details for cache update
        const { data: command, error: fetchError } = await supabase
            .from('commands')
            .select('bot_token, name')
            .eq('id', commandId)
            .single();

        if (fetchError || !command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        // Delete all commands with same name (multiple patterns)
        const { error: deleteError } = await supabase
            .from('commands')
            .delete()
            .eq('name', command.name)
            .eq('bot_token', command.bot_token);

        if (deleteError) {
            console.error('❌ Delete command error:', deleteError);
            throw deleteError;
        }

        // Update command cache
        if (command.bot_token) {
            await botManager.updateCommandCache(command.bot_token);
        }

        console.log('✅ Command deleted successfully:', commandId);

        res.json({ 
            success: true, 
            message: 'Command and all its patterns deleted successfully' 
        });

    } catch (error) {
        console.error('❌ Delete command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete command: ' + error.message 
        });
    }
});

// Test command execution
router.post('/:commandId/test', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { botToken, testInput } = req.body;

        console.log('🔄 Testing command:', { commandId, botToken: botToken?.substring(0, 10) + '...' });

        if (!botToken) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token is required for testing' 
            });
        }

        // Get command details
        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error || !command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        // Get bot instance
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active. Please check if bot is properly initialized.' 
            });
        }

        // Get admin chat ID for testing
        const { data: adminSettings, error: adminError } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        if (adminError || !adminSettings?.admin_chat_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Admin chat ID not set. Please set admin settings first.' 
            });
        }

        // Use provided test input or command pattern
        const testText = testInput || command.pattern.split(',')[0].trim();

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testText
        };

        // Execute command using the bot manager
        const result = await botManager.executeCommand(bot, command, testMessage, true);

        console.log('✅ Command test executed successfully:', commandId);

        res.json({
            success: true,
            message: 'Command test executed successfully! Check your admin Telegram account for results.',
            testInput: testText,
            result: result || 'Command executed without return value'
        });

    } catch (error) {
        console.error('❌ Test command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command: ' + error.message,
            details: error.stack
        });
    }
});

// Temporary command test
router.post('/test-temp', async (req, res) => {
    try {
        const { command, botToken, testInput } = req.body;

        if (!command || !botToken) {
            return res.status(400).json({ 
                success: false,
                error: 'Command and bot token are required' 
            });
        }

        // Get bot instance
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active. Please check if bot is properly initialized.' 
            });
        }

        // Get admin chat ID for testing
        const { data: adminSettings, error: adminError } = await supabase
            .from('admin_settings')
            .select('admin_chat_id')
            .single();

        if (adminError || !adminSettings?.admin_chat_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Admin chat ID not set. Please set admin settings first.' 
            });
        }

        // Use provided test input or command pattern
        const testText = testInput || command.pattern.split(',')[0].trim();

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testText
        };

        // Execute command using the bot manager
        const result = await botManager.executeCommand(bot, command, testMessage, true);

        res.json({
            success: true,
            message: 'Temporary command test executed successfully! Check your admin Telegram account for results.',
            testInput: testText,
            result: result || 'Command executed without return value'
        });

    } catch (error) {
        console.error('❌ Test temp command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command: ' + error.message,
            details: error.stack
        });
    }
});

// Toggle command status
router.patch('/:commandId/toggle', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { isActive, botToken } = req.body;

        console.log('🔄 Toggling command status:', { commandId, isActive });

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
            command: command
        });

    } catch (error) {
        console.error('❌ Toggle command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to toggle command status' 
        });
    }
});

// Get command statistics
router.get('/stats/:botToken', async (req, res) => {
    try {
        const { botToken } = req.params;

        const { data: commands, error } = await supabase
            .from('commands')
            .select('id, is_active')
            .eq('bot_token', botToken);

        if (error) throw error;

        const totalCommands = commands.length;
        const activeCommands = commands.filter(cmd => cmd.is_active).length;

        res.json({
            success: true,
            stats: {
                total: totalCommands,
                active: activeCommands,
                inactive: totalCommands - activeCommands
            }
        });

    } catch (error) {
        console.error('❌ Get command stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch command statistics' 
        });
    }
});

module.exports = router;