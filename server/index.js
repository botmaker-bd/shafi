const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/commands', require('./routes/commands'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve HTML files for SPA
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, '../', req.path);
    
    // If the request is for a specific file and it exists, serve it
    if (req.path.includes('.') && require('fs').existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    
    // Otherwise serve the main HTML file based on the path
    let htmlFile = 'index.html';
    if (req.path.startsWith('/dashboard')) htmlFile = 'dashboard.html';
    if (req.path.startsWith('/bot-management')) htmlFile = 'bot-management.html';
    if (req.path.startsWith('/command-editor')) htmlFile = 'command-editor.html';
    if (req.path.startsWith('/admin-settings')) htmlFile = 'admin-settings.html';
    
    res.sendFile(path.join(__dirname, '../', htmlFile));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;