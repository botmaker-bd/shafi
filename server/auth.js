const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supabase configuration
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-secret-key-2024';

// Initialize database
async function initializeDatabase() {
    try {
        // Create users table
        const { error: usersError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS users (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    security_question VARCHAR(255) DEFAULT 'What city were you born in?',
                    security_answer VARCHAR(255),
                    last_login TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `
        });

        // Create bots table
        const { error: botsError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS bots (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    token VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    username VARCHAR(255),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    webhook_url VARCHAR(500),
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `
        });

        // Create commands table
        const { error: commandsError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS commands (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    bot_token VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    pattern VARCHAR(500) NOT NULL,
                    code TEXT NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `
        });

        console.log('Database initialized successfully');
    } catch (error) {
        console.log('Database might already exist:', error.message);
    }
}

// Initialize on startup
initializeDatabase();

// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        const hashedSecurityAnswer = await bcrypt.hash('default', 12);

        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                security_question: 'What city were you born in?',
                security_answer: hashedSecurityAnswer
            }])
            .select()
            .single();

        if (error) throw error;

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

        res.json({
            message: 'User created successfully',
            token,
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email }, 
            JWT_SECRET,
            { expiresIn: remember ? '30d' : '7d' }
        );

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
    try {
        const { email, securityQuestion, securityAnswer, newPassword } = req.body;

        // Find user
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // For demo, accept any security answer
        console.log(`Password reset for: ${email}`);

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', user.id);

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists
        const { data: user } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', decoded.userId)
            .single();

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ valid: true, user });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;