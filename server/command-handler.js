const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'sb_secret_lXIB5ns2oYlInT7n7HrBhA_0UIIQYcs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Command history for undo/redo
const commandHistory = new Map();

// Get commands for a bot
router.get('/bot/:botToken', async (req, res) => {
    try {
        const { botToken } = req.params;

        const { data: commands, error } = await supabase
            .from('commands')
            .select('*')
            .eq('bot_token', botToken)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ commands });
    } catch (error) {
        console.error('Get commands error:', error);
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});

// Add new command
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description } = req.body;

        // Initialize history for this command
        const historyKey = `${botToken}_${name}`;
        if (!commandHistory.has(historyKey)) {
            commandHistory.set(historyKey, []);
        }

        const { data: command, error } = await supabase
            .from('commands')
            .insert([
                {
                    bot_token: botToken,
                    name,
                    pattern,
                    code,
                    description,
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        // Add to history
        const history = commandHistory.get(historyKey);
        history.push({
            action: 'create',
            timestamp: new Date(),
            data: { ...command }
        });

        res.json({
            message: 'Command added successfully',
            command
        });
    } catch (error) {
        console.error('Add command error:', error);
        res.status(500).json({ error: 'Failed to add command' });
    }
});

// Update command
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { code, pattern, description, name } = req.body;

        // Get current command for history
        const { data: currentCommand } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        // Save to history
        const historyKey = `${currentCommand.bot_token}_${currentCommand.name}`;
        if (commandHistory.has(historyKey)) {
            const history = commandHistory.get(historyKey);
            history.push({
                action: 'update',
                timestamp: new Date(),
                data: { ...currentCommand }
            });
        }

        const { data: command, error } = await supabase
            .from('commands')
            .update({
                code,
                pattern,
                description,
                name,
                updated_at: new Date().toISOString()
            })
            .eq('id', commandId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            message: 'Command updated successfully',
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

        // Get command for history
        const { data: command } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (command) {
            // Save to history
            const historyKey = `${command.bot_token}_${command.name}`;
            if (commandHistory.has(historyKey)) {
                const history = commandHistory.get(historyKey);
                history.push({
                    action: 'delete',
                    timestamp: new Date(),
                    data: { ...command }
                });
            }
        }

        await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

        res.json({ message: 'Command deleted successfully' });
    } catch (error) {
        console.error('Delete command error:', error);
        res.status(500).json({ error: 'Failed to delete command' });
    }
});

// Undo last action
router.post('/undo', async (req, res) => {
    try {
        const { botToken, commandName } = req.body;
        const historyKey = `${botToken}_${commandName}`;

        if (!commandHistory.has(historyKey)) {
            return res.status(400).json({ error: 'No history found' });
        }

        const history = commandHistory.get(historyKey);
        if (history.length === 0) {
            return res.status(400).json({ error: 'No actions to undo' });
        }

        const lastAction = history.pop();

        // Implement undo logic based on action type
        switch (lastAction.action) {
            case 'create':
                await supabase
                    .from('commands')
                    .delete()
                    .eq('id', lastAction.data.id);
                break;
            case 'update':
                await supabase
                    .from('commands')
                    .update(lastAction.data)
                    .eq('id', lastAction.data.id);
                break;
            case 'delete':
                await supabase
                    .from('commands')
                    .insert([lastAction.data]);
                break;
        }

        res.json({ message: 'Undo successful', history: history });
    } catch (error) {
        console.error('Undo error:', error);
        res.status(500).json({ error: 'Failed to undo' });
    }
});

// Redo last undone action
router.post('/redo', async (req, res) => {
    try {
        // Implementation similar to undo but in reverse
        // You would need to maintain a redo stack
        res.json({ message: 'Redo functionality to be implemented' });
    } catch (error) {
        console.error('Redo error:', error);
        res.status(500).json({ error: 'Failed to redo' });
    }
});

module.exports = router;