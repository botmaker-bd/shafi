const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-pro-secret-key-2024-safe';

// Forgot password - step 1: request reset
router.post('/forgot', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email is required' 
            });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, security_question')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
            // Don't reveal if email exists or not
            return res.json({ 
                success: true, 
                message: 'If the email exists, you will receive security question'
            });
        }

        res.json({
            success: true,
            userId: user.id,
            securityQuestion: user.security_question,
            message: 'Please answer your security question'
        });

    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// Forgot password - step 2: verify security answer
router.post('/verify-answer', async (req, res) => {
    try {
        const { userId, securityAnswer } = req.body;

        if (!userId || !securityAnswer) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID and security answer are required' 
            });
        }

        // Get user security answer
        const { data: user, error } = await supabase
            .from('users')
            .select('security_answer')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid request' 
            });
        }

        // Verify security answer
        const validAnswer = await bcrypt.compare(securityAnswer.trim(), user.security_answer);
        if (!validAnswer) {
            return res.status(400).json({ 
                success: false,
                error: 'Incorrect security answer' 
            });
        }

        // Generate reset token
        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        // Save reset token
        await supabase
            .from('users')
            .update({
                reset_token: resetToken,
                reset_expires: resetExpires.toISOString()
            })
            .eq('id', userId);

        res.json({
            success: true,
            resetToken: resetToken,
            message: 'Security answer verified. You can now reset your password.'
        });

    } catch (error) {
        console.error('❌ Verify answer error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// Forgot password - step 3: reset password
router.post('/reset', async (req, res) => {
    try {
        const { resetToken, newPassword, userId } = req.body;

        if (!resetToken || !newPassword || !userId) {
            return res.status(400).json({ 
                success: false,
                error: 'All fields are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must be at least 6 characters' 
            });
        }

        // Verify reset token
        const { data: user, error } = await supabase
            .from('users')
            .select('reset_token, reset_expires')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid reset token' 
            });
        }

        if (user.reset_token !== resetToken) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid reset token' 
            });
        }

        if (new Date() > new Date(user.reset_expires)) {
            return res.status(400).json({ 
                success: false,
                error: 'Reset token has expired' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await supabase
            .from('users')
            .update({
                password: hashedPassword,
                reset_token: null,
                reset_expires: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        res.json({
            success: true,
            message: 'Password reset successfully! You can now login with your new password.'
        });

    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

// Check reset token validity
router.post('/check-reset-token', async (req, res) => {
    try {
        const { resetToken, userId } = req.body;

        if (!resetToken || !userId) {
            return res.status(400).json({ 
                success: false,
                error: 'Reset token and user ID are required' 
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('reset_token, reset_expires')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid reset token' 
            });
        }

        const isValid = user.reset_token === resetToken && new Date() < new Date(user.reset_expires);

        res.json({
            success: true,
            valid: isValid,
            message: isValid ? 'Token is valid' : 'Token is invalid or expired'
        });

    } catch (error) {
        console.error('❌ Check reset token error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error' 
        });
    }
});

module.exports = router;