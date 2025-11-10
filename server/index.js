require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const authRoutes = require('./auth');
const botRoutes = require('./bot-manager');
const commandRoutes = require('./command-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.RENDER_URL, 'https://bot-maker-jcch.onrender.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/commands', commandRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: '1.0.0'
    });
});

// Webhook endpoint for Telegram bots
app.post('/bot/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log(`Webhook received for token: ${token.substring(0, 10)}...`);
        
        // Handle Telegram update
        const { handleBotUpdate } = require('./bot-manager');
        await handleBotUpdate(token, update);
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Serve client files for all other routes (SPA support)
app.get('*', (req, res) => {
    // Don't serve HTML for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message 
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Bot Maker Server Started!
📍 Environment: ${process.env.NODE_ENV || 'development'}
📍 Port: ${PORT}
📍 URL: ${process.env.RENDER_URL || `http://localhost:${PORT}`}
📍 Time: ${new Date().toISOString()}
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

module.exports = app;