require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Import routes
const authRoutes = require('./auth');
const botManager = require('./bot-manager');
const commandRoutes = require('./command-handler');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botManager.router);
app.use('/api/commands', commandRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Bot Maker API is running',
        timestamp: new Date().toISOString()
    });
});

// Webhook endpoint for Telegram bots
app.post('/bot/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log('🔄 Webhook received for bot');
        
        // Handle update
        await botManager.handleBotUpdate(token, update);
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Serve SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;