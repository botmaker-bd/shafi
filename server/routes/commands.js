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

// Add new command with mainCommand and multipleCommand
router.post('/', async (req, res) => {
    try {
        const { botToken, name, mainCommand, multipleCommand, code, description, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command:', { 
            name, 
            mainCommand,
            multipleCommand: multipleCommand?.substring(0, 50) + '...',
            botToken: botToken?.substring(0, 10) + '...' 
        });

        if (!botToken || !name || !mainCommand || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token, name, mainCommand and code are required' 
            });
        }

        // Validate mainCommand format
        if (mainCommand.includes(',')) {
            return res.status(400).json({ 
                success: false,
                error: 'mainCommand cannot contain commas. Use multipleCommand for additional patterns.' 
            });
        }

        // Clean multipleCommand (remove empty patterns)
        let cleanedMultipleCommand = null;
        if (multipleCommand && multipleCommand.trim()) {
            const patterns = multipleCommand.split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            if (patterns.length > 0) {
                cleanedMultipleCommand = patterns.join(',');
            }
        }

        // Insert command
        const { data: command, error: insertError } = await supabase
            .from('commands')
            .insert([{
                bot_token: botToken,
                name: name.trim(),
                mainCommand: mainCommand.trim(),
                multipleCommand: cleanedMultipleCommand,
                code: code.trim(),
                description: description?.trim() || '',
                wait_for_answer: waitForAnswer || false,
                answer_handler: answerHandler?.trim() || null,
                is_active: true
            }])
            .select('*')
            .single();

        if (insertError) {
            console.error('❌ Add command error:', insertError);
            
            // Handle duplicate mainCommand error
            if (insertError.code === '23505') {
                return res.status(400).json({ 
                    success: false,
                    error: `Command pattern "${mainCommand}" already exists for this bot` 
                });
            }
            
            // Handle validation trigger errors
            if (insertError.code === 'P0001') {
                return res.status(400).json({ 
                    success: false,
                    error: insertError.message 
                });
            }
            
            throw insertError;
        }

        // Update command cache
        await botManager.updateCommandCache(botToken);

        console.log('✅ Command created successfully:', command.id);

        res.json({
            success: true,
            message: 'Command created successfully!',
            command: command
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
        const { name, mainCommand, multipleCommand, code, description, waitForAnswer, answerHandler, botToken } = req.body;

        console.log('🔄 Updating command:', { 
            commandId, 
            name, 
            mainCommand,
            multipleCommand: multipleCommand?.substring(0, 50) + '...'
        });

        if (!name || !mainCommand || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Name, mainCommand and code are required' 
            });
        }

        // Validate mainCommand format
        if (mainCommand.includes(',')) {
            return res.status(400).json({ 
                success: false,
                error: 'mainCommand cannot contain commas. Use multipleCommand for additional patterns.' 
            });
        }

        // Clean multipleCommand (remove empty patterns)
        let cleanedMultipleCommand = null;
        if (multipleCommand && multipleCommand.trim()) {
            const patterns = multipleCommand.split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            if (patterns.length > 0) {
                cleanedMultipleCommand = patterns.join(',');
            }
        }

        // Update command
        const { data: command, error: updateError } = await supabase
            .from('commands')
            .update({
                name: name.trim(),
                mainCommand: mainCommand.trim(),
                multipleCommand: cleanedMultipleCommand,
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
            
            // Handle duplicate mainCommand error
            if (updateError.code === '23505') {
                return res.status(400).json({ 
                    success: false,
                    error: `Command pattern "${mainCommand}" already exists in another command` 
                });
            }
            
            // Handle validation trigger errors
            if (updateError.code === 'P0001') {
                return res.status(400).json({ 
                    success: false,
                    error: updateError.message 
                });
            }
            
            throw updateError;
        }

        if (!command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        // Update command cache
        if (botToken) {
            await botManager.updateCommandCache(botToken);
        }

        console.log('✅ Command updated successfully:', commandId);

        res.json({
            success: true,
            message: 'Command updated successfully!',
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

        // Delete command
        const { error: deleteError } = await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

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
            message: 'Command deleted successfully' 
        });

    } catch (error) {
        console.error('❌ Delete command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete command: ' + error.message 
        });
    }
});

// Validate command patterns (check for duplicates)
router.post('/validate-patterns', async (req, res) => {
    try {
        const { botToken, mainCommand, multipleCommand, excludeCommandId } = req.body;

        if (!botToken || !mainCommand) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token and mainCommand are required' 
            });
        }

        const validationResults = {
            mainCommand: { valid: true, message: '' },
            multipleCommand: { valid: true, patterns: [] }
        };

        // Check mainCommand
        const { data: mainCommandExists, error: mainError } = await supabase
            .rpc('command_pattern_exists', {
                p_bot_token: botToken,
                p_pattern: mainCommand,
                p_exclude_command_id: excludeCommandId
            });

        if (mainError) {
            throw mainError;
        }

        if (mainCommandExists) {
            validationResults.mainCommand = {
                valid: false,
                message: `Command pattern "${mainCommand}" already exists`
            };
        }

        // Check multipleCommand patterns
        if (multipleCommand && multipleCommand.trim()) {
            const patterns = multipleCommand.split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);

            for (const pattern of patterns) {
                const { data: patternExists, error: patternError } = await supabase
                    .rpc('command_pattern_exists', {
                        p_bot_token: botToken,
                        p_pattern: pattern,
                        p_exclude_command_id: excludeCommandId
                    });

                if (patternError) {
                    throw patternError;
                }

                validationResults.multipleCommand.patterns.push({
                    pattern: pattern,
                    valid: !patternExists,
                    message: patternExists ? `Pattern "${pattern}" already exists` : 'Available'
                });
            }

            // Check if all multipleCommand patterns are valid
            validationResults.multipleCommand.valid = 
                validationResults.multipleCommand.patterns.every(p => p.valid);
        }

        const allValid = validationResults.mainCommand.valid && 
                         validationResults.multipleCommand.valid;

        res.json({
            success: true,
            valid: allValid,
            validation: validationResults
        });

    } catch (error) {
        console.error('❌ Validate patterns error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to validate patterns: ' + error.message 
        });
    }
});

// Get all command patterns for a bot
router.get('/patterns/:botToken', async (req, res) => {
    try {
        const { botToken } = req.params;

        const { data: patterns, error } = await supabase
            .rpc('get_bot_command_patterns', {
                p_bot_token: botToken
            });

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            patterns: patterns || []
        });

    } catch (error) {
        console.error('❌ Get patterns error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch command patterns' 
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

        // Use provided test input or mainCommand
        const testText = testInput || command.mainCommand;

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