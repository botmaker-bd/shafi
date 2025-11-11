const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bot-maker-pro-secret-key-2024';

router.post('/forgot', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, security_question')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !user) {
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
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-answer', async (req, res) => {
    try {
        const { userId, securityAnswer } = req.body;

        if (!userId || !securityAnswer) {
            return res.status(400).json({ error: 'User ID and security answer are required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('security_answer')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const validAnswer = await bcrypt.compare(securityAnswer.trim(), user.security_answer);
        if (!validAnswer) {
            return res.status(400).json({ error: 'Incorrect security answer' });
        }

        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000);

        await supabase
            .from('users')
            .update({
                reset_token: resetToken,
                reset_expires: resetExpires.toISOString()
            })
            .eq('id', userId);

        res.json({
            success: true,
            resetToken,
            message: 'Security answer verified. You can now reset your password.'
        });

    } catch (error) {
        console.error('Verify answer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/reset', async (req, res) => {
    try {
        const { resetToken, newPassword, userId } = req.body;

        if (!resetToken || !newPassword || !userId) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('reset_token, reset_expires')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(400).json({ error: 'Invalid reset token' });
        }

        if (user.reset_token !== resetToken) {
            return res.status(400).json({ error: 'Invalid reset token' });
        }

        if (new Date() > new Date(user.reset_expires)) {
            return res.status(400).json({ error: 'Reset token has expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

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
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;