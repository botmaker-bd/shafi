const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-pro-secret-key-2024';

// Security questions
const SECURITY_QUESTIONS = [
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your first pet?",
    "What was your favorite school teacher's name?",
    "What was the model of your first car?"
];

// Get security questions
router.get('/security-questions', (req, res) => {
    res.json({ questions: SECURITY_QUESTIONS });
});

// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { email, password, securityQuestion, securityAnswer } = req.body;

        if (!email || !password || !securityQuestion || !securityAnswer) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Hash password and security answer
        const hashedPassword = await bcrypt.hash(password, 12);
        const hashedSecurityAnswer = await bcrypt.hash(securityAnswer.trim(), 12);

        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                security_question: securityQuestion,
                security_answer: hashedSecurityAnswer,
                is_admin: false
            }])
            .select('id, email, created_at')
            .single();

        if (error) throw error;

        // Generate token
        const token = jwt.sign({ 
            userId: user.id, 
            email: user.email 
        }, JWT_SECRET, { expiresIn: '7d' });

        // Create session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await supabase
            .from('user_sessions')
            .insert([{
                user_id: user.id,
                token: sessionId,
                expires_at: expiresAt.toISOString()
            }]);

        res.json({
            success: true,
            message: 'Account created successfully!',
            token,
            sessionId,
            user: { 
                id: user.id, 
                email: user.email,
                isAdmin: false
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error during signup' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;

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

        // Generate token with appropriate expiry
        const tokenExpiry = remember ? '30d' : '7d';
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            }, 
            JWT_SECRET,
            { expiresIn: tokenExpiry }
        );

        // Create session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + (remember ? 30 : 7) * 24 * 60 * 60 * 1000);

        await supabase
            .from('user_sessions')
            .insert([{
                user_id: user.id,
                token: sessionId,
                expires_at: expiresAt.toISOString()
            }]);

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            sessionId,
            user: { 
                id: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists and is active
        const { data: user } = await supabase
            .from('users')
            .select('id, email, is_admin')
            .eq('id', decoded.userId)
            .single();

        if (!user) {
            return res.status(401).json({ error: 'User account not found' });
        }

        res.json({ 
            valid: true, 
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.is_admin
            }
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (sessionId) {
            await supabase
                .from('user_sessions')
                .delete()
                .eq('token', sessionId);
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, userId } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // Get user current password
        const { data: user } = await supabase
            .from('users')
            .select('password')
            .eq('id', userId)
            .single();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validCurrentPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validCurrentPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await supabase
            .from('users')
            .update({ 
                password: hashedNewPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;