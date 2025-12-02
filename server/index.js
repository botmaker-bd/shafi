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

// Trust proxy for rate limiting (Important for Render/Heroku)
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

// Rate limiting configuration
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many login attempts, please try again later.' },
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

// ✅ ROUTE LOADING (Fixed & Clean)
try {
    const authRoutes = require('./routes/auth');
    const botRoutes = require('./routes/bots');
    const commandRoutes = require('./routes/commands');
    const adminRoutes = require('./routes/admin');
    const passwordRoutes = require('./routes/password');
    const webhookRoutes = require('./routes/webhook');
    const templateRoutes = require('./routes/templates');

    // Mount Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/bots', botRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/password', passwordRoutes);
    app.use('/api/webhook', webhookRoutes); // ✅ Webhook handled here
    app.use('/api/templates', templateRoutes);
    
    console.log('✅ All routes loaded successfully');
} catch (error) {
    console.error('❌ Route loading failed:', error);
    process.exit(1);
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const healthInfo = {
            status: 'OK',
            message: 'Bot Platform API is running',
            timestamp: new Date().toISOString(),
            mode: USE_WEBHOOK ? 'webhook' : 'polling',
            baseUrl: BASE_URL,
            uptime: process.uptime()
        };

        // Database connection check
        try {
            const supabase = require('./config/supabase');
            const { error } = await supabase.from('universal_data').select('count').limit(1);
            healthInfo.database = error ? 'disconnected' : 'connected';
        } catch (dbError) {
            healthInfo.database = 'error';
        }

        res.json(healthInfo);
    } catch (error) {
        res.status(500).json({ status: 'ERROR', error: error.message });
    }
});

// API Info Endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Telegram Bot Platform',
        version: '2.0.0',
        endpoints: {
            auth: '/api/auth',
            bots: '/api/bots',
            webhook: '/api/webhook'
        }
    });
});

// Serve SPA - All other routes go to client/index.html
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Global Error Handler
app.use((error, req, res, next) => {
    console.error('🚨 Global Error:', error);
    
    // Log to DB (Optional)
    try {
        const supabase = require('./config/supabase');
        supabase.from('universal_data').insert({
            data_type: 'error_log',
            data_key: `error_${Date.now()}`,
            data_value: JSON.stringify({ message: error.message, url: req.originalUrl }),
            metadata: { env: process.env.NODE_ENV }
        }).catch(() => {}); // Silent fail for log
    } catch (e) {}

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server started on port ${PORT}`);
    
    // Initialize Bots
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

// Graceful Shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 ${signal} received, shutting down...`);
    server.close(() => {
        try {
            const botManager = require('./core/bot-manager');
            botManager.activeBots.forEach((bot, token) => botManager.removeBot(token));
        } catch (e) { console.error('Cleanup error:', e); }
        console.log('✅ Shutdown complete');
        process.exit(0);
    });
    
    setTimeout(() => process.exit(1), 10000); // Force kill
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;