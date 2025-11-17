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
                .ilike('command_patterns', `%${pattern}%`)
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
                .ilike('command_patterns', `%${pattern}%`)
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

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser',
                language_code: 'en'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testInput || command.command_patterns.split(',')[0].trim(),
            date: Math.floor(Date.now() / 1000)
        };

        console.log(`🧪 Testing command with REAL chat ID: ${adminSettings.admin_chat_id}`);

        // Execute command
        const result = await botManager.executeCommand(bot, command, testMessage, testInput);

        res.json({
            success: true,
            message: 'Command executed successfully! Check your Telegram bot for the message.',
            testInput: testInput,
            chatId: adminSettings.admin_chat_id,
            result: result
        });

    } catch (error) {
        console.error('❌ Test command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test command: ' + error.message
        });
    }
});

// ✅ FIXED: Temporary command test
router.post('/test-temp/command', async (req, res) => {
    try {
        const { code, botToken, testInput } = req.body;

        console.log('🧪 Testing temporary command');

        if (!botToken || !code) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token and code are required' 
            });
        }

        // ✅ Get ACTUAL admin chat ID
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

        // ✅ Create temporary command object
        const tempCommand = {
            id: 'temp_test_command_' + Date.now(),
            command_patterns: '/test',
            code: code,
            bot_token: botToken,
            is_active: true,
            wait_for_answer: false
        };

        // ✅ Use REAL admin chat ID for testing
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser',
                language_code: 'en'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: testInput || '/test',
            date: Math.floor(Date.now() / 1000)
        };

        console.log(`🧪 Testing temporary command with REAL chat ID: ${adminSettings.admin_chat_id}`);

        // ✅ Execute command and verify delivery
        const result = await botManager.executeCommand(bot, tempCommand, testMessage, testInput);

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
            interactive: [
                {
                    id: 'ask_name',
                    name: 'Ask User Name',
                    patterns: '/ask,name',
                    code: `// Ask user name with waitForAnswer
try {
    const name = await waitForAnswer("What's your name?");
    bot.sendMessage(\`Hello \${name}! Nice to meet you! 😊\`);
    
    const age = await ask("How old are you?");
    bot.sendMessage(\`Great! \${age} years old is a wonderful age! 🎉\`);
    
} catch (error) {
    bot.sendMessage("Sorry, there was an error: " + error.message);
}`
                }
            ],
            python: [
                {
                    id: 'python_calc',
                    name: 'Python Calculator',
                    patterns: '/calc,calculate,math',
                    code: `// Python calculator
try {
    const result = runPython(\`
num1 = 25
num2 = 15
result = num1 + num2
print(f"Calculation: {num1} + {num2} = {result}")
\`);

    bot.sendMessage(\`🐍 Python Result:\\n\\n\${result}\`);
} catch (error) {
    bot.sendMessage(\`❌ Python Error: \${error.message}\`);
}`
                }
            ],
            data: [
                {
                    id: 'save_data',
                    name: 'Save User Data',
                    patterns: '/save,mydata',
                    code: `// Save user data example
const user = getUser();

// Save user data
User.saveData('last_activity', new Date().toISOString());
User.saveData('usage_count', (User.getData('usage_count') || 0) + 1);

// Save bot data
Bot.saveData('total_users', (Bot.getData('total_users') || 0) + 1);

const message = \`✅ Data saved successfully!

📊 Your Usage: \${User.getData('usage_count')} times
👥 Total Users: \${Bot.getData('total_users')}\`;

bot.sendMessage(message);`
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

// ✅ NEW: Test waitForAnswer functionality
router.post('/test/wait-for-answer', async (req, res) => {
    try {
        const { botToken, testInput } = req.body;

        console.log('🧪 Testing waitForAnswer functionality');

        if (!botToken) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot token is required' 
            });
        }

        // ✅ Get ACTUAL admin chat ID
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

        // ✅ Get bot instance
        const bot = botManager.getBotInstance(botToken);
        if (!bot) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot is not active' 
            });
        }

        // ✅ Create test command with waitForAnswer
        const testCommand = {
            id: 'wait_test_' + Date.now(),
            command_patterns: '/wait_test',
            code: `
// Test waitForAnswer functionality
try {
    // Method 1: Using waitForAnswer
    const name = await waitForAnswer("👋 What's your name?");
    
    // Method 2: Using ask
    const age = await ask("🎂 How old are you?");
    
    // Method 3: Using Bot.waitForAnswer
    const city = await Bot.waitForAnswer("🏙️ Which city do you live in?");
    
    const summary = \`✅ Summary:
👤 Name: \${name}
🎂 Age: \${age}
🏙️ City: \${city}\`;
    
    Bot.sendMessage(summary);
    
} catch (error) {
    Bot.sendMessage("❌ Error: " + error.message);
}
            `,
            bot_token: botToken,
            is_active: true,
            wait_for_answer: false
        };

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser',
                language_code: 'en'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: '/wait_test',
            date: Math.floor(Date.now() / 1000)
        };

        console.log(`🧪 Testing waitForAnswer with chat ID: ${adminSettings.admin_chat_id}`);

        // Execute command
        const result = await botManager.executeCommand(bot, testCommand, testMessage, '/wait_test');

        res.json({
            success: true,
            message: 'WaitForAnswer test started! Check your Telegram bot and respond to the questions.',
            chatId: adminSettings.admin_chat_id,
            result: result
        });

    } catch (error) {
        console.error('❌ WaitForAnswer test error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to test waitForAnswer: ' + error.message
        });
    }
});

module.exports = router;