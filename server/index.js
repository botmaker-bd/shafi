require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://bot-maker-jcch.onrender.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Import routes
const authRoutes = require('./auth');
const botRoutes = require('./bot-manager');
const commandRoutes = require('./command-handler');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/commands', commandRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Bot Maker API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Webhook endpoint for Telegram bots
app.post('/bot/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log(`Webhook received for token: ${token.substring(0, 10)}...`);
        
        // Import and handle update
        const botManager = require('./bot-manager');
        if (botManager.handleBotUpdate) {
            await botManager.handleBotUpdate(token, update);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Serve SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Bot Maker Server Started!
📍 Port: ${PORT}
📍 Environment: ${process.env.NODE_ENV || 'development'}
📍 URL: ${process.env.RENDER_URL || `http://localhost:${PORT}`}
    `);
});

module.exports = app;