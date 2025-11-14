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

console.log('🌐 Server Configuration:');
console.log(`📍 Port: ${PORT}`);
console.log(`🌐 Base URL: ${BASE_URL}`);
console.log(`🔗 Mode: ${USE_WEBHOOK ? 'Webhook' : 'Polling'}`);

// server/index.js - app configuration এর শুরুতে যোগ করুন

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Enhanced CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://bot-maker-bd.onrender.com',
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
    max: 1000, // limit each IP to 1000 requests per windowMs
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

// server/index.js - এই লাইনগুলো আছে কিনা চেক করুন
try {
    const authRoutes = require('./routes/auth');
    const botRoutes = require('./routes/bots');
    const commandRoutes = require('./routes/commands');
    const adminRoutes = require('./routes/admin');
    const passwordRoutes = require('./routes/password');
    const webhookRoutes = require('./routes/webhook');
    const templateRoutes = require('./routes/templates'); // ✅ এই লাইন থাকতে হবে

    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/password', passwordRoutes);
    app.use('/api/webhook', webhookRoutes);
    app.use('/api/templates', templateRoutes); // ✅ এই লাইন থাকতে হবে
    
    console.log('✅ All routes loaded successfully');
} catch (error) {
    console.error('❌ Route loading failed:', error);
    process.exit(1);
}

// Health check endpoint with detailed info
app.get('/api/health', async (req, res) => {
    try {
        const healthInfo = {
            status: 'OK',
            message: 'Bot Platform API is running smoothly',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            mode: USE_WEBHOOK ? 'webhook' : 'polling',
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
        description: 'Universal Telegram Bot Platform with Python Support',
        endpoints: {
            auth: '/api/auth',
            bots: '/api/bots',
            commands: '/api/commands',
            admin: '/api/admin',
            webhook: '/api/webhook'
        },
        features: [
            'Universal Data Storage',
            'Python Library Support',
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
    res.sendFile(path.join(__dirname, '../client/index.html'));
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
    
    // Log error to database if possible
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

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
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
    process.exit(1);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Server started successfully!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Base URL: ${BASE_URL}`);
    console.log(`🕒 Started at: ${new Date().toISOString()}`);
    console.log(`🔗 Health check: ${BASE_URL}/api/health`);
    console.log(`📚 API Info: ${BASE_URL}/api/info`);
    
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
    }, 5000);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
    
    server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Clean up bot connections
        try {
            const botManager = require('./core/bot-manager');
            botManager.activeBots.forEach((bot, token) => {
                console.log(`🛑 Stopping bot: ${token.substring(0, 15)}...`);
                botManager.removeBot(token);
            });
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

module.exports = app;