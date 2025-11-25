const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-pro-secret-key-2024-safe-vercel-render';

const SECURITY_QUESTIONS = [
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your first pet?",
    "What was your favorite school teacher's name?",
    "What was the model of your first car?"
];

// Get security questions
router.get('/security-questions', (req, res) => {
    res.json({ 
        success: true,
        questions: SECURITY_QUESTIONS 
    });
});

// Signup endpoint - FIXED
router.post('/signup', async (req, res) => {
    try {
        const { email, password, securityQuestion, securityAnswer } = req.body;

        console.log('🔄 Signup attempt for:', email);

        // Validation
        if (!email || !password || !securityQuestion || !securityAnswer) {
            return res.status(400).json({ 
                success: false,
                error: 'All fields are required' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must be at least 6 characters' 
            });
        }

        if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid security question' 
            });
        }

        // Check if user already exists - FIXED QUERY
        const { data: existingUser, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase().trim());

        if (userCheckError) {
            console.error('❌ Database error checking user:', userCheckError);
            throw userCheckError;
        }

        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ 
                success: false,
                error: 'User already exists with this email' 
            });
        }

        // Hash password and security answer
        const hashedPassword = await bcrypt.hash(password, 12);
        const hashedSecurityAnswer = await bcrypt.hash(securityAnswer.trim(), 12);

        // Create user - FIXED INSERT
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert({
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                security_question: securityQuestion,
                security_answer: hashedSecurityAnswer,
                is_admin: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) {
            console.error('❌ Database error creating user:', createError);
            
            // Handle specific Supabase errors
            if (createError.code === '23505') {
                return res.status(400).json({ 
                    success: false,
                    error: 'User already exists with this email' 
                });
            }
            
            throw createError;
        }

        // Generate token
        const token = jwt.sign({ 
            userId: user.id, 
            email: user.email 
        }, JWT_SECRET, { expiresIn: '7d' });

        console.log('✅ User created successfully:', user.email);

        res.json({
            success: true,
            message: 'Account created successfully!',
            token: token,
            user: { 
                id: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            }
        });

    } catch (error) {
        console.error('❌ Signup error:', error);
        
        let errorMessage = 'Internal server error during signup';
        
        if (error.code === '23505') {
            errorMessage = 'User already exists with this email';
        } else if (error.message.includes('database')) {
            errorMessage = 'Database connection error';
        }

        res.status(500).json({ 
            success: false,
            error: errorMessage 
        });
    }
});

// Login endpoint - FIXED
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔄 Login attempt for:', email);

        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Email and password are required' 
            });
        }

        // Find user - FIXED QUERY
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .limit(1);

        if (userError) {
            console.error('❌ Database error:', userError);
            throw userError;
        }

        if (!users || users.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        const user = users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ Invalid password for:', email);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        // Generate token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            }, 
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update last login
        await supabase
            .from('users')
            .update({ 
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        console.log('✅ Login successful for:', user.email);

        res.json({
            success: true,
            message: 'Login successful!',
            token: token,
            user: { 
                id: user.id, 
                email: user.email,
                isAdmin: user.is_admin 
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error during login' 
        });
    }
});

// Verify token endpoint - FIXED
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication token required' 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, is_admin')
            .eq('id', decoded.userId)
            .limit(1);

        if (error || !users || users.length === 0) {
            return res.status(401).json({ 
                success: false,
                error: 'User account not found' 
            });
        }

        const user = users[0];

        res.json({ 
            success: true,
            valid: true, 
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.is_admin
            }
        });
    } catch (error) {
        console.error('❌ Token verification error:', error);
        res.status(401).json({ 
            success: false,
            error: 'Invalid or expired token' 
        });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        // In stateless JWT, we don't need to do much on logout
        // Client should remove the token locally
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Logout failed' 
        });
    }
});

// Change password endpoint - FIXED
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, userId } = req.body;

        if (!currentPassword || !newPassword || !userId) {
            return res.status(400).json({ 
                success: false,
                error: 'Current password, new password and user ID are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                error: 'New password must be at least 6 characters' 
            });
        }

        // Get user current password - FIXED QUERY
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('password')
            .eq('id', userId)
            .limit(1);

        if (userError || !users || users.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        const user = users[0];

        // Verify current password
        const validCurrentPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validCurrentPassword) {
            return res.status(400).json({ 
                success: false,
                error: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        // Update password - FIXED UPDATE
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                password: hashedNewPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            throw updateError;
        }

        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });

    } catch (error) {
        console.error('❌ Change password error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to change password' 
        });
    }
});

// Get user profile - FIXED
router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication token required' 
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, is_admin, created_at, last_login')
            .eq('id', decoded.userId)
            .limit(1);

        if (error || !users || users.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        const user = users[0];

        res.json({ 
            success: true,
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.is_admin,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });
    } catch (error) {
        console.error('❌ Get profile error:', error);
        res.status(401).json({ 
            success: false,
            error: 'Invalid token' 
        });
    }
});

// Check if email exists
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email is required' 
            });
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .limit(1);

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            exists: users && users.length > 0
        });

    } catch (error) {
        console.error('❌ Check email error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check email' 
        });
    }
});

module.exports = router;