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

// ✅ IMPROVED: Route loading with better error handling
const loadRoutes = () => {
    const routes = [
        { path: '/api/auth', file: './routes/auth' },
        { path: '/api/bots', file: './routes/bots' },
        { path: '/api/commands', file: './routes/commands' },
        { path: '/api/admin', file: './routes/admin' },
        { path: '/api/password', file: './routes/password' },
        { path: '/api/webhook', file: './routes/webhook' },
        { path: '/api/templates', file: './routes/templates' }
    ];

    let loadedCount = 0;
    let errorCount = 0;

    routes.forEach(route => {
        try {
            const routeModule = require(route.file);
            app.use(route.path, routeModule);
            console.log(`✅ Route loaded: ${route.path}`);
            loadedCount++;
        } catch (error) {
            console.error(`❌ Failed to load route ${route.path}:`, error.message);
            errorCount++;
            
            // Create a fallback route for failed modules
            app.use(route.path, (req, res) => {
                res.status(503).json({
                    success: false,
                    error: `Service temporarily unavailable: ${error.message}`,
                    path: req.path
                });
            });
        }
    });

    console.log(`📊 Routes loaded: ${loadedCount} successful, ${errorCount} failed`);
    
    if (errorCount > 0) {
        console.warn('⚠️ Some routes failed to load. The app will continue with limited functionality.');
    }
};

// Load routes
loadRoutes();

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
            if (error) {
                healthInfo.dbError = error.message;
            }
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
            
            // Improved webhook handling with fallback
            try {
                const botManager = require('./core/bot-manager');
                await botManager.handleBotUpdate(token, update);
            } catch (botError) {
                console.error('❌ Bot manager error in webhook:', botError.message);
                // Continue to respond with 200 to prevent Telegram retries
            }
            
            res.status(200).send('OK');
        } catch (error) {
            console.error('❌ Webhook processing error:', error);
            // Always respond with 200 to prevent Telegram from retrying
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
            webhook: '/api/webhook',
            templates: '/api/templates',
            password: '/api/password'
        },
        features: [
            'Universal Data Storage',
            'Python Library Support',
            'Webhook & Polling Modes',
            'Multi-Bot Management',
            'Real-time Command Execution'
        ],
        status: 'operational'
    });
});

// Serve SPA - All other routes go to client
app.get('*', (req, res) => {
    // Don't serve API routes as HTML
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            success: false,
            error: 'API endpoint not found',
            path: req.originalUrl 
        });
    }
    
    // Serve the main HTML file for all other routes (SPA)
    const clientPath = path.join(__dirname, '../client/index.html');
    
    // Check if file exists before sending
    const fs = require('fs');
    if (fs.existsSync(clientPath)) {
        res.sendFile(clientPath);
    } else {
        res.status(404).json({
            success: false,
            error: 'Client application not found',
            message: 'The frontend application is not available'
        });
    }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        availableEndpoints: [
            '/api/auth',
            '/api/bots', 
            '/api/commands',
            '/api/admin',
            '/api/webhook',
            '/api/templates',
            '/api/password',
            '/api/health',
            '/api/info'
        ]
    });
});

// ✅ IMPROVED: Global error handling middleware
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
                timestamp: new Date().toISOString(),
                userAgent: req.get('User-Agent')
            }),
            metadata: {
                type: 'server_error',
                environment: process.env.NODE_ENV
            }
        }).catch(e => console.error('Failed to log error to database:', e));
    } catch (logError) {
        console.error('Failed to initialize error logging:', logError);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(500).json({
        success: false,
        error: isProduction ? 'Internal server error' : error.message,
        ...(!isProduction && { 
            stack: error.stack,
            path: req.originalUrl
        })
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Log to database if possible
    try {
        const supabase = require('./config/supabase');
        supabase.from('universal_data').insert({
            data_type: 'error_log',
            data_key: `unhandled_rejection_${Date.now()}`,
            data_value: JSON.stringify({
                reason: reason?.message || reason,
                stack: reason?.stack,
                timestamp: new Date().toISOString()
            }),
            metadata: {
                type: 'unhandled_rejection',
                environment: process.env.NODE_ENV
            }
        }).catch(e => console.error('Failed to log unhandled rejection:', e));
    } catch (logError) {
        console.error('Failed to log unhandled rejection to database:', logError);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    
    // Log to database if possible
    try {
        const supabase = require('./config/supabase');
        supabase.from('universal_data').insert({
            data_type: 'error_log',
            data_key: `uncaught_exception_${Date.now()}`,
            data_value: JSON.stringify({
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }),
            metadata: {
                type: 'uncaught_exception',
                environment: process.env.NODE_ENV
            }
        }).catch(e => console.error('Failed to log uncaught exception:', e));
    } catch (logError) {
        console.error('Failed to log uncaught exception to database:', logError);
    }
    
    process.exit(1);
});

// ✅ IMPROVED: Server startup with better initialization
const startServer = async () => {
    try {
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
        });

        // Initialize bots after server starts with delay
        setTimeout(async () => {
            try {
                console.log('🔄 Initializing bots...');
                const botManager = require('./core/bot-manager');
                await botManager.initializeAllBots();
                console.log('✅ All bots initialized successfully');
            } catch (error) {
                console.error('❌ Bot initialization failed:', error);
                console.log('⚠️ Bots will not be available. Some functionality may be limited.');
            }
        }, 3000); // Reduced delay for faster initialization

        // ✅ IMPROVED: Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
            
            server.close(() => {
                console.log('✅ HTTP server closed');
                
                // Clean up bot connections
                try {
                    const botManager = require('./core/bot-manager');
                    const activeBots = botManager.activeBots?.size || 0;
                    console.log(`🛑 Stopping ${activeBots} active bots...`);
                    
                    if (botManager.activeBots) {
                        botManager.activeBots.forEach((bot, token) => {
                            console.log(`🛑 Stopping bot: ${token.substring(0, 15)}...`);
                            botManager.removeBot(token);
                        });
                    }
                    console.log('✅ Bot cleanup completed');
                } catch (error) {
                    console.error('❌ Error during bot cleanup:', error);
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

        return server;

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer().then(server => {
    console.log('✅ Server startup process completed');
}).catch(error => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
});

module.exports = app;