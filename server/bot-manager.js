const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');

const router = express.Router();

// === Supabase (ENV based) ===
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ SUPABASE_URL / SUPABASE_KEY missing in ENV');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Public URL for webhook ===
const PUBLIC_URL = process.env.PUBLIC_URL; // e.g. https://your-app.onrender.com

// Active instances per token
const activeBots = new Map();
const botCommands = new Map(); // token => [{command, code, is_active}]

// Utility: fetch commands for a bot token
async function loadCommands(token) {
  const { data, error } = await supabase
    .from('commands')
    .select('*')
    .eq('bot_token', token)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

// Initialize a single bot by token
async function initializeBot(token) {
  try {
    if (!token) throw new Error('Missing token');

    // Reuse existing
    if (activeBots.has(token)) return activeBots.get(token);

    // Load commands
    const commands = await loadCommands(token);
    botCommands.set(token, commands);

    // Create bot (webhook mode; no local port)
    const bot = new TelegramBot(token, { webHook: { port: 0 } });

    // Refresh webhook on every init
    if (!PUBLIC_URL) {
      console.error('❌ PUBLIC_URL missing in ENV. Set it to your Render URL.');
    } else {
      const webhookUrl = `${PUBLIC_URL}/bot?token=${encodeURIComponent(token)}`;
      await bot.setWebHook(webhookUrl);
      console.log('✅ Webhook set =>', webhookUrl);
    }

    // Basic listeners (in case you ever switch to polling)
    bot.on('error', (err) => console.error('Bot error:', err.message));

    // Dynamic message handler (slash-commands)
    bot.on('message', async (msg) => {
      try {
        if (!msg.text) return;
        if (!msg.text.startsWith('/')) return; // only commands

        const list = botCommands.get(token) || [];
        const text = msg.text.split(' ')[0];
        const cmdName = text.replace(/^\//, '').split('@')[0];
        const cmd = list.find((c) => c.command === cmdName);
        if (!cmd) return; // unknown command -> ignore silently

        await executeUserCode(bot, msg.chat.id, msg, cmd.code);
      } catch (err) {
        console.error('on(message) error:', err);
      }
    });

    bot.on('callback_query', async (cb) => {
      try {
        await bot.answerCallbackQuery(cb.id);
      } catch (e) {}
    });

    activeBots.set(token, bot);
    return bot;
  } catch (err) {
    console.error('initializeBot error:', err);
    throw err;
  }
}

// Initialize all active bots from DB (called on server start)
async function initializeAllBots() {
  try {
    console.log('🔄 Initializing all bots…');
    const { data: bots, error } = await supabase
      .from('bots')
      .select('token, is_active')
      .eq('is_active', true);
    if (error) throw error;

    for (const b of bots || []) {
      try {
        await initializeBot(b.token);
      } catch (e) {
        console.error('Init single bot failed:', e.message);
      }
    }
    console.log('✅ All bots initialized');
  } catch (err) {
    console.error('initializeAllBots error:', err);
  }
}

// Handle a single Telegram update coming from /bot
async function handleBotUpdate(token, update) {
  try {
    let bot = activeBots.get(token);
    if (!bot) {
      // lazy init if missing (e.g., after restart)
      await initializeBot(token);
      bot = activeBots.get(token);
    }

    if (!bot) throw new Error('Bot instance not available');

    // node-telegram-bot-api can process raw update objects
    await bot.processUpdate(update);
  } catch (err) {
    console.error('handleBotUpdate error:', err);
  }
}

// Hot-reload commands for a bot
router.post('/:botId/reload', async (req, res) => {
  try {
    const { botId } = req.params;
    const { data: botRow, error } = await supabase
      .from('bots')
      .select('token')
      .eq('id', botId)
      .single();
    if (error) throw error;

    const token = botRow.token;
    const cmds = await loadCommands(token);
    botCommands.set(token, cmds);

    res.json({ success: true, count: cmds.length });
  } catch (err) {
    console.error('reload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add/remove bots (optional; keep if your UI uses them)
router.post('/add', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'token required' });

    // Save to DB if needed, then initialize
    await initializeBot(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === Execute dynamic command code safely-ish ===
async function executeUserCode(bot, chatId, msg, userCode) {
  // Helper functions exposed to command code
  const helpers = {
    reply: (text, opts) => bot.sendMessage(chatId, text, opts),
    sendMessage: (text, opts) => bot.sendMessage(chatId, text, opts),
    sendPhoto: (photo, opts) => bot.sendPhoto(chatId, photo, opts),
    sendDocument: (doc, opts) => bot.sendDocument(chatId, doc, opts),
    ctx: { chatId, msg },
  };

  const wrapped = `\n(async ()=>{\n  try {\n    ${userCode}\n  } catch (e) {\n    await sendMessage('❌ Command error: ' + (e.message||e));\n    throw e;\n  }\n})()\n`;

  const argNames = Object.keys(helpers);
  const argVals = Object.values(helpers);
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...argNames, wrapped);
    await fn(...argVals);
  } catch (err) {
    console.error('Command exec error:', err);
  }
}

module.exports = {
  router,
  initializeAllBots,
  initializeBot,
  handleBotUpdate,
};