import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import Database from 'better-sqlite3';

// ---- Config ----
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'devsecret';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// ---- App ----
const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(helmet());
app.use(morgan('dev'));

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  }
}));

// Basic rate limit
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120 }));

// ---- DB ----
const db = new Database('./db/data.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT UNIQUE NOT NULL,
    reply TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ---- Simple Admin Auth (optional) ----
function adminAuth(req, res, next) {
  if (!ADMIN_TOKEN) return next(); // open if not configured
  const token = req.header('x-admin-token');
  if (token && token === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---- API ----
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Create command
app.post('/api/commands', adminAuth, (req, res) => {
  const { command, reply } = req.body || {};
  if (!command || !reply) return res.status(400).json({ error: 'command and reply are required' });
  const cmd = command.replace(/^\//, '').trim();
  try {
    const stmt = db.prepare('INSERT INTO commands (command, reply) VALUES (?, ?)');
    const info = stmt.run(cmd, String(reply));
    res.status(201).json({ id: info.lastInsertRowid, command: cmd, reply });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Command already exists' });
    }
    res.status(500).json({ error: 'DB error', detail: String(e) });
  }
});

// List commands
app.get('/api/commands', adminAuth, (_req, res) => {
  const rows = db.prepare('SELECT id, command, reply, created_at FROM commands ORDER BY id DESC').all();
  res.json(rows);
});

// Delete command
app.delete('/api/commands/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM commands WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Upsert (create or update) for convenience
app.put('/api/commands', adminAuth, (req, res) => {
  const { command, reply } = req.body || {};
  if (!command || !reply) return res.status(400).json({ error: 'command and reply are required' });
  const cmd = command.replace(/^\//, '').trim();
  const existing = db.prepare('SELECT id FROM commands WHERE command = ?').get(cmd);
  if (existing) {
    db.prepare('UPDATE commands SET reply = ? WHERE id = ?').run(String(reply), existing.id);
    return res.json({ id: existing.id, command: cmd, reply });
  } else {
    const info = db.prepare('INSERT INTO commands (command, reply) VALUES (?, ?)').run(cmd, String(reply));
    return res.status(201).json({ id: info.lastInsertRowid, command: cmd, reply });
  }
});

// ---- Telegram Webhook ----
// Set your webhook at: https://api.telegram.org/bot<token>/setWebhook?url=https://yourdomain.com/webhook/<WEBHOOK_SECRET>
// Then point your reverse proxy to this server.
app.post(`/webhook/${WEBHOOK_SECRET}`, async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
    }
    const update = req.body;
    if (update && update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const match = text.startsWith('/') ? text.slice(1).split(' ')[0] : null;
      if (match) {
        const row = db.prepare('SELECT reply FROM commands WHERE command = ?').get(match);
        if (row) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: row.reply })
          });
        }
      }
    }
    // Always respond OK quickly to Telegram
    res.json({ ok: true });
  } catch (e) {
    console.error('webhook error', e);
    res.json({ ok: true });
  }
});

// Serve static client
app.use('/', express.static('client'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});