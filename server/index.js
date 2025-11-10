require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.PUBLIC_URL]
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

// Body parsers
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- Mount routers ---
const botManager = require('./bot-manager');
app.use('/api/bots', botManager.router);

// Health
app.get('/', (_req, res) => res.status(200).send('OK'));

// Telegram webhook endpoint: /bot?token=xxxx
app.post('/bot', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token query missing' });

    const update = req.body;
    console.log('🔔 Webhook received for token:', token.slice(0, 8) + '…');

    if (botManager.handleBotUpdate) {
      await botManager.handleBotUpdate(token, update);
    }

    // Telegram requires a 200 fast response
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ ok: true }); // still 200 to avoid retries storm
  }
});

// Fallback to client (if any)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Bot Maker Server Started!\n📍 Port: ${PORT}\n📍 Env: ${process.env.NODE_ENV || 'development'}\n📍 Public URL: ${process.env.PUBLIC_URL || 'N/A'}\n`);
  // Initialize all bots on boot
  if (botManager.initializeAllBots) botManager.initializeAllBots();
});

module.exports = app;