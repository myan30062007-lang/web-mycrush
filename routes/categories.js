const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  await getDb();
  const categories = prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.status = 'published'
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `).all();
  res.json(categories);
});

router.post('/', requireAuth, async (req, res) => {
  await getDb();
  const { name, slug, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Tên danh mục là bắt buộc' });
  }

  const catSlug = slug || name.toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  try {
    const result = prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)')
      .run(name, catSlug, sort_order || 0);
    const category = prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json(category);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Slug danh mục đã tồn tại' });
    }
    throw e;
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  await getDb();
  const { name, slug, sort_order } = req.body;
  const id = parseInt(req.params.id);
  
  const existing = prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  prepare('UPDATE categories SET name = ?, slug = ?, sort_order = ? WHERE id = ?')
    .run(name || existing.name, slug || existing.slug, sort_order !== undefined ? sort_order : existing.sort_order, id);
  
  const category = prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(category);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await getDb();
  prepare('DELETE FROM categories WHERE id = ?').run(parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
