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

// Add new command
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description, waitForAnswer, answerHandler } = req.body;

        console.log('🔄 Adding new command:', { name, pattern, botToken: botToken?.substring(0, 10) + '...' });

        if (!botToken || !name || !pattern || !code) {
            return res.status(400).json({ error: 'Bot token, name, pattern and code are required' });
        }

        // Check for duplicate command patterns
        const patterns = pattern.split(',').map(p => p.trim());
        
        for (const singlePattern of patterns) {
            const { data: existingCommand } = await supabase
                .from('commands')
                .select('id')
                .eq('bot_token', botToken)
                .eq('pattern', singlePattern)
                .single();

            if (existingCommand) {
                return res.status(400).json({ 
                    error: `Command pattern "${singlePattern}" already exists for this bot` 
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
            commands
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

        // Check for duplicate command patterns (excluding current command)
        const patterns = pattern.split(',').map(p => p.trim());
        
        for (const singlePattern of patterns) {
            const { data: existingCommand } = await supabase
                .from('commands')
                .select('id')
                .eq('bot_token', botToken)
                .eq('pattern', singlePattern)
                .neq('id', commandId)
                .single();

            if (existingCommand) {
                return res.status(400).json({ 
                    error: `Another command with pattern "${singlePattern}" already exists` 
                });
            }
        }

        // Update command
        const { data: command, error: updateError } = await supabase
            .from('commands')
            .update({
                name: name.trim(),
                pattern: pattern,
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

// Test command execution
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

        // Create test message
        const testMessage = {
            chat: { id: adminSettings.admin_chat_id },
            from: {
                id: adminSettings.admin_chat_id,
                first_name: 'Test User',
                username: 'testuser'
            },
            message_id: Math.floor(Math.random() * 1000000),
            text: command.pattern.split(',')[0] // Use first pattern for testing
        };

        // Execute command using the correct function
        await executeCommandTest(bot, command, testMessage);

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

// Helper function to execute command for testing
async function executeCommandTest(bot, command, msg) {
    try {
        const result = await executeCommandCode(bot, command.code, {
            msg,
            chatId: msg.chat.id,
            userId: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            isTest: true
        });

        return result;
    } catch (error) {
        console.error(`❌ Command "${command.name}" execution error:`, error);
        
        const errorMessage = `
❌ *Command Execution Error*

*Command:* ${command.name}
*Pattern:* ${command.pattern}

*Error:* \`${error.message}\`

Please check your command code and try again.
        `.trim();

        try {
            await bot.sendMessage(msg.chat.id, errorMessage, {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.message_id
            });
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
}

// Execute command code safely (same as in bot-manager)
async function executeCommandCode(bot, code, context) {
    const { msg, chatId, userId, username, first_name, isTest } = context;
    
    const safeFunctions = {
        sendMessage: (text, options = {}) => {
            return bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        },
        
        sendPhoto: (photo, options = {}) => {
            return bot.sendPhoto(chatId, photo, options);
        },
        
        sendDocument: (doc, options = {}) => {
            return bot.sendDocument(chatId, doc, options);
        },
        
        getUser: () => ({ 
            id: userId, 
            username: username || 'No username', 
            first_name: first_name || 'User'
        }),
        
        getMessage: () => msg,
        
        getChatId: () => chatId,
        
        HTTP: {
            get: async (options) => {
                try {
                    const response = await axios.get(options.url, {
                        headers: options.headers || {}
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP GET failed: ${error.message}`);
                }
            },
            
            post: async (options) => {
                try {
                    const response = await axios.post(options.url, options.data || {}, {
                        headers: options.headers || {}
                    });
                    return response.data;
                } catch (error) {
                    throw new Error(`HTTP POST failed: ${error.message}`);
                }
            }
        },
        
        isTest: () => isTest || false,
        
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        log: (message) => console.log(`[Command Log]: ${message}`)
    };

    try {
        const wrappedCode = `
            return (async function() {
                const { 
                    sendMessage, 
                    sendPhoto, 
                    sendDocument,
                    getUser, 
                    getMessage, 
                    getChatId,
                    HTTP,
                    isTest, 
                    wait,
                    log
                } = this;
                
                ${code}
            }).call(this);
        `;

        const func = new Function(wrappedCode);
        const result = await func.call(safeFunctions);
        
        return result;
    } catch (error) {
        console.error('❌ Command code execution error:', error);
        throw new Error(`Command execution failed: ${error.message}`);
    }
}

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