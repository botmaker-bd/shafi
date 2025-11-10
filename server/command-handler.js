const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

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
            commands 
        });

    } catch (error) {
        console.error('Get commands error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch commands' 
        });
    }
});

// Get single command by ID
router.get('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        const { data: command, error } = await supabase
            .from('commands')
            .select('*')
            .eq('id', commandId)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            command
        });

    } catch (error) {
        console.error('Get command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch command' 
        });
    }
});

// Add command
router.post('/', async (req, res) => {
    try {
        const { botToken, name, pattern, code, description } = req.body;

        const { data: command, error } = await supabase
            .from('commands')
            .insert([{
                bot_token: botToken,
                name,
                pattern,
                code,
                description,
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Command added successfully',
            command
        });

    } catch (error) {
        console.error('Add command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add command' 
        });
    }
});

// Update command
router.put('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;
        const { code, pattern, description, name } = req.body;

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
            success: true,
            message: 'Command updated successfully',
            command
        });

    } catch (error) {
        console.error('Update command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update command' 
        });
    }
});

// Delete command
router.delete('/:commandId', async (req, res) => {
    try {
        const { commandId } = req.params;

        await supabase
            .from('commands')
            .delete()
            .eq('id', commandId);

        res.json({ 
            success: true,
            message: 'Command deleted successfully' 
        });

    } catch (error) {
        console.error('Delete command error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete command' 
        });
    }
});

module.exports = router;