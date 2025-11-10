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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../client')));

// Import routes
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

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Bot Maker Pro API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Webhook endpoint for Telegram bots
app.post('/webhook/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        console.log('🔄 Webhook received for bot:', token.substring(0, 15) + '...');
        
        // Import bot manager
        const botManager = require('./core/bot-manager');
        
        // Handle update
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
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Bot Maker Pro Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;