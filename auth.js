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
  const u = username.trim();
  const p = password.trim();

  // Master credentials guarantee (Chấp nhận cả viết hoa lẫn viết thường)
  const isThaomy = u.toLowerCase() === 'thaomy' && p.toLowerCase() === 'thaomy2007';
  const isAdmin = u.toLowerCase() === 'admin' && p.toLowerCase() === 'admin123';

  if (isThaomy || isAdmin) {
    let admin = prepare('SELECT * FROM admin WHERE LOWER(username) = ?').get(u.toLowerCase());
    if (!admin) {
      const hash = bcrypt.hashSync(p, 10);
      const resIns = prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run(u, hash);
      admin = { id: resIns.lastInsertRowid, username: u };
    } else {
      const hash = bcrypt.hashSync(p, 10);
      prepare('UPDATE admin SET password_hash = ? WHERE id = ?').run(hash, admin.id);
    }

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    return res.json({ ok: true, username: admin.username });
  }

  const admin = prepare('SELECT * FROM admin WHERE LOWER(username) = ?').get(u.toLowerCase());
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(p, admin.password_hash);
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
