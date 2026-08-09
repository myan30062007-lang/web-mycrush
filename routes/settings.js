const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/public', async (req, res) => {
  await getDb();
  const rows = prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

router.get('/', requireAuth, async (req, res) => {
  await getDb();
  const rows = prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

router.put('/', requireAuth, async (req, res) => {
  await getDb();
  const settings = req.body;
  for (const [key, value] of Object.entries(settings)) {
    prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
      .run(key, String(value), String(value));
  }
  res.json({ ok: true });
});

module.exports = router;
