const express = require('express');
const botManager = require('../core/bot-manager');
const router = express.Router();

// Webhook endpoint for Telegram
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log('🔄 Webhook received for bot:', token.substring(0, 10) + '...');
        
        await botManager.handleBotUpdate(token, update);
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(200).send('OK');
    }
});

// Webhook info endpoint
router.get('/info/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const baseUrl = process.env.BASE_URL;
        const webhookUrl = `${baseUrl}/api/webhook/${token}`;
        
        res.json({
            success: true,
            token: token.substring(0, 15) + '...',
            webhook_url: webhookUrl,
            mode: process.env.USE_WEBHOOK === 'true' ? 'webhook' : 'polling',
            status: 'active'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;