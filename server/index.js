// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION:', reason);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Render-specific middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static files - Render compatible path
app.use(express.static(path.join(__dirname, '../client')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Import routes with better error handling
const loadRoutes = () => {
  try {
    const authRoutes = require('./routes/auth');
    const botRoutes = require('./routes/bots');
    const commandRoutes = require('./routes/commands');
    const adminRoutes = require('./routes/admin');
    const passwordRoutes = require('./routes/password');

    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/password', passwordRoutes);
    
    console.log('✅ All routes loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Route loading failed:', error);
    return false;
  }
};

// Load routes
loadRoutes();

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

// Webhook endpoint
app.post('/api/webhook/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔄 Webhook received for bot:', token.substring(0, 10) + '...');
    
    const botManager = require('./core/bot-manager');
    await botManager.handleBotUpdate(token, req.body);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Serve SPA - All other routes go to client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server started successfully!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log(`🔗 Health check: https://bot-maker-bd.onrender.com/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;