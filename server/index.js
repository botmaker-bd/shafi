require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';
const IS_VERCEL = process.env.VERCEL === 'true';

console.log('🌐 Server Configuration:');
console.log(`📍 Port: ${PORT}`);
console.log(`🌐 Base URL: ${BASE_URL}`);
console.log(`🔗 Mode: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}`);
console.log(`🚀 Platform: ${IS_VERCEL ? 'Vercel' : 'Render'}`);

// Enhanced CORS configuration for Vercel & Render
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://bot-maker-bd.onrender.com',
            'https://telegram-bot-platform.vercel.app',
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080'
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🚫 CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware with increased limits
app.use(bodyParser.json({ 
    limit: '50mb'
}));
app.use(bodyParser.urlencoded({ 
    extended: true, 
    limit: '50mb' 
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/', generalLimiter);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client'), {
    index: false,
    extensions: ['html', 'htm']
}));

// API Routes - Vercel compatible
try {
    const authRoutes = require('./routes/auth');
    const botRoutes = require('./routes/bots');
    const commandRoutes = require('./routes/commands');
    const adminRoutes = require('./routes/admin');
    const passwordRoutes = require('./routes/password');
    const webhookRoutes = require('./routes/webhook');
    const templateRoutes = require('./routes/templates');

    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/password', passwordRoutes);
    app.use('/api/webhook', webhookRoutes);
    app.use('/api/templates', templateRoutes);
    
    console.log('✅ All routes loaded successfully');
} catch (error) {
    console.error('❌ Route loading failed:', error);
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const healthInfo = {
            status: 'OK',
            message: 'Bot Platform API is running smoothly',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            platform: IS_VERCEL ? 'Vercel' : 'Render',
            baseUrl: BASE_URL,
            features: {
                python: !IS_VERCEL,
                webhook: USE_WEBHOOK,
                multi_bot: true
            }
        };

        res.json(healthInfo);
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Webhook endpoint for Telegram
if (USE_WEBHOOK) {
    app.post('/api/webhook/:token', async (req, res) => {
        try {
            const { token } = req.params;
            const update = req.body;
            
            console.log('🔄 Webhook received for bot:', token.substring(0, 10) + '...');
            
            // Lazy load bot manager to avoid Vercel cold start issues
            const botManager = require('./core/bot-manager');
            await botManager.handleBotUpdate(token, update);
            
            res.status(200).send('OK');
        } catch (error) {
            console.error('❌ Webhook error:', error);
            res.status(200).send('OK');
        }
    });
}

// API info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Telegram Bot Platform',
        version: '2.0.0',
        description: 'Universal Telegram Bot Platform - Vercel/Render Compatible',
        platform: IS_VERCEL ? 'Vercel' : 'Render',
        endpoints: {
            auth: '/api/auth',
            bots: '/api/bots',
            commands: '/api/commands',
            admin: '/api/admin',
            webhook: '/api/webhook',
            templates: '/api/templates'
        },
        features: {
            python_support: !IS_VERCEL,
            webhook_mode: USE_WEBHOOK,
            multi_bot: true,
            real_time_commands: true
        }
    });
});

// Serve SPA - All other routes go to client
app.get('*', (req, res) => {
    // Don't serve API routes as HTML
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Serve the main HTML file for all other routes (SPA)
    const filePath = path.join(__dirname, '../client', req.path);
    
    // Check if file exists
    const fs = require('fs');
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        res.sendFile(filePath);
    } else {
        // Fallback to index.html for SPA routing
        res.sendFile(path.join(__dirname, '../client/index.html'));
    }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl
    });
});

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Global Error Handler:', error);
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    if (!IS_VERCEL) process.exit(1);
});

// Vercel-specific: Export the app for serverless functions
if (IS_VERCEL) {
    console.log('🚀 Starting in Vercel serverless mode');
    module.exports = app;
} else {
    // Traditional server startup for Render
    console.log('🚀 Starting in Render server mode');
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log('\n🚀 Server started successfully!');
        console.log(`📍 Port: ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Base URL: ${BASE_URL}`);
        console.log(`🕒 Started at: ${new Date().toISOString()}`);
        
        if (USE_WEBHOOK) {
            console.log(`🤖 Webhook URL: ${BASE_URL}/api/webhook/{BOT_TOKEN}`);
        } else {
            console.log(`🔄 Running in Polling mode`);
        }
        
        console.log('----------------------------------------\n');
        
        // Initialize bots after server starts with delay
        setTimeout(async () => {
            try {
                const botManager = require('./core/bot-manager');
                await botManager.initializeAllBots();
                console.log('✅ All bots initialized successfully');
            } catch (error) {
                console.error('❌ Bot initialization failed:', error);
            }
        }, 3000);
    });

    // Graceful shutdown for Render
    const gracefulShutdown = (signal) => {
        console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
        
        server.close(() => {
            console.log('✅ HTTP server closed');
            
            // Clean up bot connections
            try {
                const botManager = require('./core/bot-manager');
                if (botManager.activeBots) {
                    botManager.activeBots.forEach((bot, token) => {
                        console.log(`🛑 Stopping bot: ${token.substring(0, 15)}...`);
                        botManager.removeBot(token);
                    });
                }
            } catch (error) {
                console.error('Error during bot cleanup:', error);
            }
            
            console.log('✅ Cleanup completed');
            process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
            console.error('❌ Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}