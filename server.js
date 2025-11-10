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
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// Import routes
const authRoutes = require('./api/auth');
const botRoutes = require('./api/bots');
const commandRoutes = require('./api/commands');
const adminRoutes = require('./api/admin');
const passwordRoutes = require('./api/password');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/password', passwordRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Bot Maker Pro API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Webhook endpoint for Telegram bots
app.post('/api/webhook/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const update = req.body;

    console.log('🔄 Webhook received for bot:', token.substring(0, 15) + '...');

    const botManager = require('./lib/bot-manager');
    await botManager.handleBotUpdate(token, update);

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

// Serve SPA - all other routes go to client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Global error handler:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Bot Maker Pro Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
  });
}

module.exports = app;