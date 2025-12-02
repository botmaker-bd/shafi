const express = require('express');
const router = express.Router();
const botManager = require('../core/bot-manager');

// Handle Telegram Webhooks
router.post('/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const update = req.body;

        // ভ্যালিডেশন: টোকেন বা আপডেট না থাকলে ইগনোর করুন
        if (!token || !update) {
            return res.status(400).send('Invalid request');
        }

        // BotManager কে আপডেট প্রসেস করতে বলুন
        // (আগের ভার্সনে হয়তো ফাংশনটির নাম ভিন্ন ছিল, এখন এটি handleBotUpdate)
        await botManager.handleBotUpdate(token, update);

        // টেলিগ্রামকে সবসময় 200 OK পাঠাতে হবে, নাহলে তারা বারবার রি-ট্রাই করবে
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook route error:', error.message);
        // এরর হলেও 200 পাঠাতে হবে যাতে টেলিগ্রাম লুপে না পড়ে
        res.sendStatus(200);
    }
});

module.exports = router;