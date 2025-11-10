const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const authRoutes = require('./auth');
const botRoutes = require('./bot-manager');
const commandRoutes = require('./command-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/commands', commandRoutes);

// Webhook endpoint for Telegram bots
app.post('/bot/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const update = req.body;
        
        // Handle Telegram update
        await handleTelegramUpdate(token, update);
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Serve client files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

async function handleTelegramUpdate(token, update) {
    // This will be implemented in bot-manager.js
    const { handleBotUpdate } = require('./bot-manager');
    await handleBotUpdate(token, update);
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});