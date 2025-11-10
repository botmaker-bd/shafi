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
    // Still return 200 to avoid Telegram retry storms
    res.status(200).json({ ok: true });
  }
});

// Optional: serve SPA client if exists
app.get('*', (_req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  } catch {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`
🚀 Bot Maker Server Started!
📍 Port: ${PORT}
📍 Env: ${process.env.NODE_ENV || 'development'}
📍 Public URL: ${process.env.PUBLIC_URL || 'N/A'}
`);
  if (botManager.initializeAllBots) await botManager.initializeAllBots();
});

module.exports = app;