const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./middleware/auth-middleware');

const router = express.Router();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_secret_lXIB5ns2oYlInT7n7HrBhA_0UIIQYcs';
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create users table if not exists
        const { error: usersError } = await supabase.rpc('create_users_table_if_not_exists');
        
        // Create bots table if not exists
        const { error: botsError } = await supabase.rpc('create_bots_table_if_not_exists');
        
        // Create commands table if not exists
        const { error: commandsError } = await supabase.rpc('create_commands_table_if_not_exists');
        
        console.log('Database initialization completed');
    } catch (error) {
        console.log('Database tables already exist or cannot be created via RPC');
    }
}

// Initialize database on startup
initializeDatabase();

// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Check if user already exists
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        if (findError && findError.code !== 'PGRST116') {
            throw findError;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert([
                {
                    email: email.toLowerCase().trim(),
                    password: hashedPassword,
                    security_question: 'What city were you born in?', // Default question
                    security_answer: await bcrypt.hash('default', 12), // Default answer
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (createError) {
            console.error('Signup database error:', createError);
            return res.status(500).json({ error: 'Failed to create user account' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email 
            }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'User created successfully',
            token,
            user: { 
                id: user.id, 
                email: user.email,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            error: 'Internal server error. Please try again later.' 
        });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email 
            }, 
            JWT_SECRET,
            { expiresIn: remember ? '30d' : '7d' }
        );

        // Update last login time
        await supabase
            .from('users')
            .update({ 
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { 
                id: user.id, 
                email: user.email,
                created_at: user.created_at,
                last_login: user.last_login
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Internal server error. Please try again later.' 
        });
    }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
    try {
        const { email, securityQuestion, securityAnswer, newPassword } = req.body;

        // Validate input
        if (!email || !securityQuestion || !securityAnswer || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // In a real application, you would verify the security question and answer
        // For this demo, we'll accept any answer as correct
        console.log(`Password reset for: ${email}, Question: ${securityQuestion}, Answer: ${securityAnswer}`);

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                password: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (updateError) {
            throw updateError;
        }

        res.json({ 
            success: true,
            message: 'Password reset successfully' 
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            error: 'Failed to reset password. Please try again later.' 
        });
    }
});

// Verify token endpoint
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        // Check if user still exists
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', req.user.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ error: 'Token verification failed' });
    }
});

// Get user profile endpoint
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, created_at, last_login, updated_at')
            .eq('id', req.user.userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Update user profile endpoint
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { email, securityQuestion, securityAnswer } = req.body;

        const updates = { updated_at: new Date().toISOString() };

        if (email) updates.email = email.toLowerCase().trim();
        if (securityQuestion) updates.security_question = securityQuestion;
        if (securityAnswer) {
            updates.security_answer = await bcrypt.hash(securityAnswer, 12);
        }

        const { data: user, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.user.userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                security_question: user.security_question
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Change password endpoint
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get user with password
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await supabase
            .from('users')
            .update({ 
                password: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.userId);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;