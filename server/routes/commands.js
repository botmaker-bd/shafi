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
        const { botToken, commandPatterns, code, description, waitForAnswer, answerHandler } = req.body;

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
                description: description?.trim() || null,
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
        const { commandPatterns, code, description, waitForAnswer, answerHandler, botToken } = req.body;

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
                description: description?.trim() || null,
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

        // Use provided test input or first command pattern
        const patterns = command.command_patterns.split(',').map(p => p.trim());
        const testText = testInput || patterns[0];

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

        console.log(`🔧 Starting command test execution for command ID: ${commandId}`);
        
        try {
            // Execute command using the bot manager
            const result = await botManager.executeCommand(bot, command, testMessage, testText);
            
            console.log('✅ Command test executed successfully:', commandId);

            res.json({
                success: true,
                message: 'Command test executed successfully! Check your admin Telegram account for results.',
                testInput: testText,
                result: result || 'Command executed successfully'
            });
        } catch (executionError) {
            console.error('❌ Command execution failed:', executionError);
            res.status(500).json({ 
                success: false,
                error: 'Command execution failed: ' + executionError.message
            });
        }

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

        // Use provided test input or first command pattern
        const patterns = command.command_patterns.split(',').map(p => p.trim());
        const testText = testInput || patterns[0];

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
        const result = await botManager.executeCommand(bot, command, testMessage, testText);

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

// Test command with input simulation
router.post('/test-input', async (req, res) => {
    try {
        const { commandId, testInput, botToken } = req.body;

        if (!commandId || !testInput || !botToken) {
            return res.status(400).json({ 
                success: false,
                error: 'Command ID, test input and bot token are required' 
            });
        }

        // Get command details
        const { data: command, error: commandError } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (commandError || !command) {
            return res.status(404).json({ 
                success: false,
                error: 'Command not found' 
            });
        }

        // Get bot info
        const { data: bot, error: botError } = await supabase
            .from('bots')
            .select('*')
            .eq('token', botToken)
            .single();

        if (botError || !bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }

        // Simulate Telegram message
        const simulatedMessage = {
            message_id: Math.floor(Math.random() * 10000),
            from: {
                id: 123456789,
                is_bot: false,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                language_code: 'en'
            },
            chat: {
                id: 123456789,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                type: 'private'
            },
            date: Math.floor(Date.now() / 1000),
            text: testInput
        };

        // Execute command code with simulated context
        const executionResult = await executeCommandCode(
            command.code,
            simulatedMessage,
            botToken
        );

        res.json({
            success: true,
            telegramResponse: executionResult.telegramResponse,
            executionDetails: executionResult.details,
            botReply: executionResult.botReply,
            rawResult: executionResult.rawResult
        });

    } catch (error) {
        console.error('❌ Test command error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test command',
            details: error.message
        });
    }
});

// Command execution function
async function executeCommandCode(code, message, botToken) {
    try {
        const botManager = require('../core/bot-manager');
        const bot = botManager.getBotInstance(botToken);
        
        if (!bot) {
            throw new Error('Bot not initialized');
        }

        // Create execution context
        const context = {
            getUser: () => message.from,
            getChatId: () => message.chat.id,
            getMessageText: () => message.text,
            User: {
                saveData: (key, value) => {
                    console.log(`[DEBUG] User.saveData('${key}', ${JSON.stringify(value)})`);
                    return Promise.resolve();
                },
                getData: (key) => {
                    console.log(`[DEBUG] User.getData('${key}')`);
                    return Promise.resolve(null);
                }
            },
            HTTP: {
                get: async (url) => {
                    console.log(`[DEBUG] HTTP.get('${url}')`);
                    return JSON.stringify({ data: 'Mock API response' });
                },
                post: async (url, data) => {
                    console.log(`[DEBUG] HTTP.post('${url}', ${JSON.stringify(data)})`);
                    return JSON.stringify({ success: true });
                }
            },
            bot: {
                sendMessage: (chatId, text, options = {}) => {
                    console.log(`[DEBUG] bot.sendMessage(${chatId}, "${text}")`);
                    return {
                        message_id: Math.floor(Math.random() * 10000),
                        from: { id: bot.id, is_bot: true, first_name: 'Test Bot' },
                        chat: message.chat,
                        date: Math.floor(Date.now() / 1000),
                        text: text,
                        ...options
                    };
                },
                sendPhoto: (chatId, photo, options = {}) => {
                    console.log(`[DEBUG] bot.sendPhoto(${chatId}, "${photo}")`);
                    return { success: true, method: 'sendPhoto' };
                }
            }
        };

        // Wrap the code in a function and execute
        const wrappedCode = `
            try {
                ${code}
                return { success: true, executed: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        `;

        const executeFunction = new Function(
            'getUser', 'getChatId', 'getMessageText', 'User', 'HTTP', 'bot', 'waitForAnswer',
            wrappedCode
        );

        const result = await executeFunction(
            context.getUser,
            context.getChatId,
            context.getMessageText,
            context.User,
            context.HTTP,
            context.bot,
            () => Promise.resolve('Mock user response')
        );

        // Collect all bot responses
        const botReplies = [
            `🤖 Bot executed command: ${message.text}`,
            `💬 Response: Command processed successfully`,
            `📊 Status: ${result.success ? 'Success' : 'Error'}`,
            result.error ? `❌ Error: ${result.error}` : `✅ Execution completed`
        ];

        return {
            telegramResponse: `📨 Message sent to Telegram:\n└── "${message.text}"`,
            details: `🔍 Execution Details:\n├── Command: ${message.text}\n├── User: ${message.from.first_name}\n├── Chat ID: ${message.chat.id}\n└── Timestamp: ${new Date().toLocaleString()}`,
            botReply: botReplies.join('\n'),
            rawResult: result
        };

    } catch (error) {
        return {
            telegramResponse: `📨 Message sent to Telegram:\n└── "${message.text}"`,
            details: `🔍 Execution Details:\n├── Command: ${message.text}\n├── Status: Failed\n└── Error: ${error.message}`,
            botReply: `❌ Execution Failed:\n${error.message}`,
            rawResult: { success: false, error: error.message }
        };
    }
}

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

module.exports = router;