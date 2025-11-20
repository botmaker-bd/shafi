#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Platform detection
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const isRender = process.env.RENDER || false;

// Configuration
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

console.log('🚀 Server Starting...');
console.log('🌐 Platform Configuration:');
console.log(`📍 Platform: ${isVercel ? 'Vercel' : isRender ? 'Render' : 'Local'}`);
console.log(`📍 Port: ${PORT}`);
console.log(`🌐 Base URL: ${BASE_URL}`);
console.log(`🔗 Mode: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}`);
console.log(`🐍 Python Support: ${isVercel ? 'Limited' : 'Full'}`);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Enhanced CORS configuration
const allowedOrigins = [
    'https://bot-maker-bd.onrender.com',
    'https://bot-maker-bd.vercel.app',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080'
];

// Add Vercel domain dynamically if available
if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

app.use(cors({
    origin: function (origin, callback) {
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
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(bodyParser.urlencoded({ 
    extended: true, 
    limit: '50mb' 
}));

// Rate limiting with different rules for different endpoints
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isVercel ? 500 : 1000, // Vercel has lower limits
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 login attempts per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/', generalLimiter);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client'), {
    index: false, // Don't serve index.html for directories
    extensions: ['html', 'htm'] // Auto-add extensions
}));

// Load routes with error handling
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
    // Don't exit in production, continue without some routes
    if (process.env.NODE_ENV === 'development') {
        process.exit(1);
    }
}

// Health check endpoint with platform-specific info
app.get('/api/health', async (req, res) => {
    try {
        const healthInfo = {
            status: 'OK',
            message: 'Bot Platform API is running smoothly',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
            environment: process.env.NODE_ENV || 'development',
            mode: USE_WEBHOOK ? 'webhook' : 'polling',
            pythonSupport: !isVercel, // Vercel doesn't support Python well
            baseUrl: BASE_URL,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            }
        };

        // Try to check database connection
        try {
            const supabase = require('./config/supabase');
            const { data, error } = await supabase.from('universal_data').select('count').limit(1);
            healthInfo.database = error ? 'disconnected' : 'connected';
            if (error) healthInfo.dbError = error.message;
        } catch (dbError) {
            healthInfo.database = 'error';
            healthInfo.dbError = dbError.message;
        }

        res.json(healthInfo);
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Platform info endpoint
app.get('/api/platform', (req, res) => {
    res.json({
        platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
        features: {
            python: !isVercel,
            webhook: USE_WEBHOOK,
            database: true,
            staticFiles: true
        },
        limits: {
            memory: isVercel ? '512MB' : '1GB',
            timeout: isVercel ? '10s' : '30s'
        }
    });
});

// Webhook endpoint for Telegram (only in webhook mode)
if (USE_WEBHOOK) {
    app.post('/api/webhook/:token', async (req, res) => {
        try {
            const { token } = req.params;
            const update = req.body;
            
            console.log('🔄 Webhook received for bot:', token.substring(0, 10) + '...');
            console.log('📦 Update type:', update.message ? 'message' : update.callback_query ? 'callback' : 'other');
            
            const botManager = require('./core/bot-manager');
            await botManager.handleBotUpdate(token, update);
            
            res.status(200).send('OK');
        } catch (error) {
            console.error('❌ Webhook error:', error);
            // Still respond with 200 to prevent Telegram from retrying
            res.status(200).send('OK');
        }
    });
}

// API info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Telegram Bot Platform',
        version: '2.0.0',
        platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
        description: 'Universal Telegram Bot Platform with Python Support',
        pythonSupport: !isVercel,
        endpoints: {
            auth: '/api/auth',
            bots: '/api/bots',
            commands: '/api/commands',
            admin: '/api/admin',
            webhook: '/api/webhook',
            health: '/api/health',
            platform: '/api/platform'
        },
        features: [
            'Universal Data Storage',
            ...(isVercel ? [] : ['Python Library Support']), // Only show Python on Render
            'Webhook & Polling Modes',
            'Multi-Bot Management',
            'Real-time Command Execution'
        ]
    });
});

// Serve SPA - All other routes go to client
app.get('*', (req, res) => {
    // Don't serve API routes as HTML
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Serve the main HTML file for all other routes (SPA)
    const clientPath = path.join(__dirname, '../client/index.html');
    res.sendFile(clientPath, (err) => {
        if (err) {
            console.log('Client file not found, serving basic info');
            res.json({
                message: 'Telegram Bot Platform API',
                version: '2.0.0',
                platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
                documentation: '/api/info'
            });
        }
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local'
    });
});

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Global Error Handler:', error);
    
    // Log error to database if possible (skip on Vercel for performance)
    if (!isVercel) {
        try {
            const supabase = require('./config/supabase');
            supabase.from('universal_data').insert({
                data_type: 'error_log',
                data_key: `error_${Date.now()}`,
                data_value: JSON.stringify({
                    message: error.message,
                    stack: error.stack,
                    url: req.originalUrl,
                    method: req.method,
                    platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
                    timestamp: new Date().toISOString()
                }),
                metadata: {
                    type: 'server_error',
                    environment: process.env.NODE_ENV
                }
            }).catch(e => console.error('Failed to log error:', e));
        } catch (logError) {
            console.error('Failed to initialize error logging:', logError);
        }
    }

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        platform: isVercel ? 'Vercel' : isRender ? 'Render' : 'Local',
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    if (!isVercel) { // Vercel auto-restarts, no need to exit
        process.exit(1);
    }
});

// Bot initialization function
const initializeBots = async () => {
    try {
        const botManager = require('./core/bot-manager');
        
        // Vercel এ Python bots skip করতে
        const options = isVercel ? { skipPython: true } : {};
        
        console.log(`🤖 Initializing bots on ${isVercel ? 'Vercel' : 'Render'}...`);
        await botManager.initializeAllBots(options);
        
        console.log('✅ All bots initialized successfully');
        console.log(`🐍 Python Support: ${isVercel ? 'Disabled on Vercel' : 'Enabled'}`);
    } catch (error) {
        console.error('❌ Bot initialization failed:', error);
        // Don't crash the server on bot initialization failure
    }
};

// Start server
const startServer = () => {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log('\n🎉 Server started successfully!');
        console.log(`📍 Platform: ${isVercel ? 'Vercel' : isRender ? 'Render' : 'Local'}`);
        console.log(`📍 Port: ${PORT}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Base URL: ${BASE_URL}`);
        console.log(`🕒 Started at: ${new Date().toISOString()}`);
        console.log(`🔗 Health check: ${BASE_URL}/api/health`);
        console.log(`📚 API Info: ${BASE_URL}/api/info`);
        console.log(`🖥️ Platform Info: ${BASE_URL}/api/platform`);
        
        if (USE_WEBHOOK) {
            console.log(`🤖 Webhook URL: ${BASE_URL}/api/webhook/{BOT_TOKEN}`);
        } else {
            console.log(`🔄 Running in Polling mode`);
        }
        
        console.log(`🐍 Python Support: ${isVercel ? 'Limited' : 'Full'}`);
        console.log('----------------------------------------\n');
        
        // Initialize bots after server starts with delay
        setTimeout(initializeBots, 3000);
    });

    return server;
};

// Vercel specific handling
if (isVercel) {
    // Vercel expects the app to be exported
    module.exports = app;
    
    // For Vercel, we don't start the server manually
    console.log('🚀 Vercel environment detected - exporting app');
} else {
    // For Render and local development, start the server
    const server = startServer();
    
    // Graceful shutdown (not needed for Vercel)
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

// Export for testing and Vercel
module.exports = app;