// Global error handlers - Server যেন না crash হয়
process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION - Server continues running:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../client')));

// Import routes with error handling
try {
    const authRoutes = require('./routes/auth');
    const botRoutes = require('./routes/bots');
    const commandRoutes = require('./routes/commands');
    const adminRoutes = require('./routes/admin');
    const passwordRoutes = require('./routes/password');

    // Use routes
    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/password', passwordRoutes);
    
    console.log('✅ All routes loaded successfully');
} catch (error) {
    console.error('❌ Route loading error:', error);
}

// Health check - Always respond even if no bots
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Bot Maker Pro API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        bots: 'No active bots - Server running normally'
    });
});

// Webhook endpoint with error handling
app.post('/webhook/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log('🔄 Webhook received for bot:', token.substring(0, 15) + '...');
        
        const botManager = require('./core/bot-manager');
        await botManager.handleBotUpdate(token, update);
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Serve SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Global error handler:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong'
    });
});

// Start server with robust error handling
const startServer = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`🚀 Bot Maker Pro Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🕒 Server started at: ${new Date().toISOString()}`);
            console.log('✅ Server is ready to accept requests');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        // Don't exit - wait and retry
        setTimeout(() => {
            console.log('🔄 Retrying server start...');
            startServer();
        }, 5000);
    }
};

// Start the server
startServer();

module.exports = app;