const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, prepare } = require('../db/database');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  await getDb();
  const admin = prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  res.json({ ok: true, username: admin.username });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Check session
router.get('/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ ok: true, username: req.session.adminUsername });
  }
  res.status(401).json({ error: 'Not logged in' });
});

module.exports = router;
