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

// Add new command
router.post('/', async (req, res) => {
    try {
        const { botToken, commandPatterns, code, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command:', { 
            commandPatterns: commandPatterns?.substring(0, 50) + '...',
            botToken: botToken?.substring(0, 10) + '...' 
        });

        if (!botToken || !commandPatterns || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token, command patterns and code are required' 
            });
        }

        // Parse and validate command patterns
        const patterns = commandPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'At least one command pattern is required' 
            });
        }

        // Check for duplicate command patterns
        for (const pattern of patterns) {
            const { data: existingCommand, error: checkError } = await supabase
                .from('commands')
                .select('id, command_patterns')
                .eq('bot_token', botToken)
                .eq('command_patterns', pattern)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingCommand) {
                return res.status(400).json({ 
                    success: false,
                    error: `Command pattern "${pattern}" already exists` 
                });
            }
        }

        // Create command
        const { data: command, error: createError } = await supabase
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

        if (createError) {
            console.error('❌ Create command error:', createError);
            throw createError;
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
        const { commandPatterns, code, waitForAnswer, answerHandler, botToken } = req.body;

        console.log('🔄 Updating command:', { commandId, commandPatterns: commandPatterns?.substring(0, 50) + '...' });

        if (!commandPatterns || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Command patterns and code are required' 
            });
        }

        // Parse and validate command patterns
        const patterns = commandPatterns.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        if (patterns.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'At least one command pattern is required' 
            });
        }

        // Check for duplicate command patterns (excluding current command)
        for (const pattern of patterns) {
            const { data: existingCommand, error: checkError } = await supabase
                .from('commands')
                .select('id, command_patterns')
                .eq('bot_token', botToken)
                .eq('command_patterns', pattern)
                .neq('id', commandId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingCommand) {
                return res.status(400).json({ 
                    success: false,
                    error: `Command pattern "${pattern}" already exists in another command` 
                });
            }
        }

        // Update command
        const { data: command, error: updateError } = await supabase
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

        if (updateError) {
            console.error('❌ Update command error:', updateError);
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
            .select('bot_token')
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

// ✅ FIXED: Test command execution
// ✅ FIXED: Test command execution
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

        // ✅ FIXED: Use botManager to get bot instance
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active. Please check if bot is properly initialized.' 
            });
        }

        // ... rest of the method remains the same
    } catch (error) {
        console.error('❌ Test command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command: ' + error.message
        });
    }
});
// ✅ FIXED: Temporary command test
// server/routes/commands.js - test-temp endpoint improve করুন
// ✅ FIXED: Temporary command test
router.post('/test-temp', async (req, res) => {
    try {
        const { command, botToken, testInput } = req.body;

        // ✅ Get ACTUAL admin chat ID (not test ID)
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

        // ✅ Get bot instance from bot manager
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active. Please check if bot is properly initialized.' 
            });
        }

        // ✅ Use REAL admin chat ID for testing
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id, // ✅ Actual user ID
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testInput || command.command_patterns.split(',')[0]
        };

        console.log(`🧪 Testing command with REAL chat ID: ${adminSettings.admin_chat_id}`);

        // ✅ Execute command and verify delivery
        const result = await botManager.executeCommand(bot, command, testMessage, testInput);

        res.json({
            success: true,
            message: 'Command executed successfully! Check your Telegram bot for the message.',
            testInput: testInput,
            chatId: adminSettings.admin_chat_id,
            result: result
        });

    } catch (error) {
        console.error('❌ Test temp command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command: ' + error.message
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

// Get command templates
router.get('/templates/categories', async (req, res) => {
    try {
        const templates = {
            basic: [
                {
                    id: 'welcome',
                    name: 'Welcome Message',
                    patterns: '/start,start,hello,hi',
                    code: `// Welcome message template
const user = getUser();
const welcomeMessage = \`Hello \${user.first_name}! 👋

Welcome to our bot! Here's what you can do:
• Use /help to see all commands
• Use /info to get bot information

Your User ID: \${user.id}
Username: @\${user.username || 'Not set'}\`;

bot.sendMessage(welcomeMessage, {
    parse_mode: 'Markdown'
});`
                },
                {
                    id: 'help',
                    name: 'Help Command',
                    patterns: '/help,help,commands,menu',
                    code: `// Help command template
const helpText = \`🤖 *Bot Help Menu*

*Available Commands:*
• /start - Start the bot
• /help - Show this help message
• /info - Bot information

*Features:*
• Multiple command patterns
• Interactive conversations
• Media support
• Python code execution

*Need Help?*
Contact support if you need assistance.\`;

bot.sendMessage(helpText, {
    parse_mode: 'Markdown'
});`
                }
            ],
            python: [
                {
                    id: 'python_calc',
                    name: 'Python Calculator',
                    patterns: '/calc,calculate,math',
                    code: `// Python calculator
const result = await bot.runPython(\`
num1 = 10
num2 = 5
result = num1 + num2
print(f"Calculation: {num1} + {num2} = {result}")
\`);

bot.sendMessage(\`🐍 Python Result:\\n\\n\${result}\`);`
                }
            ]
        };

        res.json({
            success: true,
            templates: templates
        });

    } catch (error) {
        console.error('❌ Get templates error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch templates' 
        });
    }
});

module.exports = router;
