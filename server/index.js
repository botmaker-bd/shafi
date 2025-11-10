require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel specific - static files serving
app.use(express.static(path.join(__dirname, '../client')));

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
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Bot Maker Pro API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Webhook endpoint
app.post('/api/webhook/:token', async (req, res) => {
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

// Serve SPA - All other routes go to client
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Export for Vercel
module.exports = app;