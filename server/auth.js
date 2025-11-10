const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supabase configuration - YOUR ACTUAL CREDENTIALS
const supabaseUrl = 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-secret-key-2024';

// Debug middleware to log requests
router.use((req, res, next) => {
    console.log(`Auth API: ${req.method} ${req.path}`);
    next();
});

// Signup endpoint - FIXED VERSION
router.post('/signup', async (req, res) => {
    console.log('Signup request received:', req.body);
    
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ 
                success: false,
                error: 'Email and password are required' 
            });
        }

        if (password.length < 6) {
            console.log('Password too short');
            return res.status(400).json({ 
                success: false,
                error: 'Password must be at least 6 characters long' 
            });
        }

        // Check if user already exists
        console.log('Checking if user exists...');
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (findError && findError.code !== 'PGRST116') {
            console.log('Error checking user:', findError);
            throw findError;
        }

        if (existingUser) {
            console.log('User already exists');
            return res.status(400).json({ 
                success: false,
                error: 'User already exists with this email' 
            });
        }

        // Hash password
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 12);
        const hashedSecurityAnswer = await bcrypt.hash('default', 12);

        // Create user
        console.log('Creating user...');
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert([{
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                security_question: 'What city were you born in?',
                security_answer: hashedSecurityAnswer,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (createError) {
            console.log('Error creating user:', createError);
            return res.status(500).json({ 
                success: false,
                error: 'Failed to create user account: ' + createError.message 
            });
        }

        console.log('User created successfully:', user.id);

        // Generate JWT token
        const token = jwt.sign({ 
            userId: user.id, 
            email: user.email 
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'User created successfully',
            token,
            user: { 
                id: user.id, 
                email: user.email 
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Login endpoint - FIXED VERSION
router.post('/login', async (req, res) => {
    console.log('Login request received:', req.body);
    
    try {
        const { email, password, remember } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Email and password are required' 
            });
        }

        // Find user
        console.log('Finding user...');
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error) {
            console.log('User not found:', error);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        if (!user) {
            console.log('User not found');
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        // Check password
        console.log('Checking password...');
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password');
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
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
                last_login: new Date().toISOString() 
            })
            .eq('id', user.id);

        console.log('Login successful for user:', user.email);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { 
                id: user.id, 
                email: user.email 
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error: ' + error.message 
        });
    }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
    try {
        const { email, securityQuestion, securityAnswer, newPassword } = req.body;

        console.log('Reset password request for:', email);

        // Validate input
        if (!email || !securityQuestion || !securityAnswer || !newPassword) {
            return res.status(400).json({ 
                success: false,
                error: 'All fields are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                error: 'New password must be at least 6 characters long' 
            });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(400).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        // For demo purposes, accept any security answer
        console.log(`Password reset for: ${email}, Question: ${securityQuestion}`);

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
            success: false,
            error: 'Failed to reset password: ' + error.message 
        });
    }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Token required' 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user still exists
        const { data: user } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', decoded.userId)
            .single();

        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            valid: true, 
            user 
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ 
            success: false,
            error: 'Invalid token' 
        });
    }
});

// Test endpoint to check database connection
router.get('/test-db', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        if (error) {
            throw error;
        }

        res.json({ 
            success: true,
            message: 'Database connection successful',
            data 
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Database connection failed: ' + error.message 
        });
    }
});

module.exports = router;