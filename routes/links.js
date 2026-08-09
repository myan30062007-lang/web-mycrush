const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Get links for a product
router.get('/product/:productId', async (req, res) => {
  await getDb();
  const links = prepare('SELECT * FROM product_links WHERE product_id = ? ORDER BY price ASC')
    .all(parseInt(req.params.productId));
  res.json(links);
});

// Admin: add link
router.post('/', requireAuth, async (req, res) => {
  await getDb();
  const { product_id, platform, url, price, shop_name } = req.body;
  if (!product_id || !platform || !url) {
    return res.status(400).json({ error: 'product_id, platform, url required' });
  }
  if (!['shopee', 'tiktok', 'lazada', 'other'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  const result = prepare('INSERT INTO product_links (product_id, platform, url, price, shop_name) VALUES (?, ?, ?, ?, ?)')
    .run(parseInt(product_id), platform, url, price || 0, shop_name || '');
  const link = prepare('SELECT * FROM product_links WHERE id = ?').get(result.lastInsertRowid);
  res.json(link);
});

// Admin: update link
router.put('/:id', requireAuth, async (req, res) => {
  await getDb();
  const { platform, url, price, shop_name } = req.body;
  const id = parseInt(req.params.id);
  
  const existing = prepare('SELECT * FROM product_links WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  prepare('UPDATE product_links SET platform = ?, url = ?, price = ?, shop_name = ? WHERE id = ?')
    .run(platform || existing.platform, url || existing.url, price !== undefined ? price : existing.price, shop_name !== undefined ? shop_name : existing.shop_name, id);
  
  const link = prepare('SELECT * FROM product_links WHERE id = ?').get(id);
  res.json(link);
});

// Admin: delete link
router.delete('/:id', requireAuth, async (req, res) => {
  await getDb();
  prepare('DELETE FROM product_links WHERE id = ?').run(parseInt(req.params.id));
  res.json({ ok: true });
});

// Public: track click
router.post('/:id/click', async (req, res) => {
  await getDb();
  const link = prepare('SELECT * FROM product_links WHERE id = ?').get(parseInt(req.params.id));
  if (!link) return res.status(404).json({ error: 'Link not found' });

  prepare('UPDATE product_links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
  prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ?').run(link.product_id);
  prepare('INSERT INTO analytics (product_id, link_id, event_type, referrer, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(link.product_id, link.id, 'click', req.headers.referer || '', req.headers['user-agent'] || '');

  res.json({ ok: true, url: link.url });
});

module.exports = router;
