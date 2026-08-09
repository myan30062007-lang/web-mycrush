const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Public: list products
router.get('/', async (req, res) => {
  await getDb();
  const { search, category, status, platform, page = 1, limit = 20, admin } = req.query;
  const offset = (page - 1) * limit;
  let where = [];
  let params = [];

  if (!admin) {
    where.push('p.status = ?');
    params.push('published');
  } else if (status) {
    where.push('p.status = ?');
    params.push(status);
  }

  if (search) {
    where.push('(p.name LIKE ? OR p.slug LIKE ? OR p.description LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }

  if (platform) {
    where.push('p.id IN (SELECT product_id FROM product_links WHERE platform = ?)');
    params.push(platform);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const total = prepare(`SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`).get(...params);

  const allParams = [...params, parseInt(limit), parseInt(offset)];
  const products = prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug,
      (SELECT MIN(price) FROM product_links WHERE product_id = p.id AND price > 0) as min_price,
      (SELECT GROUP_CONCAT(DISTINCT platform) FROM product_links WHERE product_id = p.id) as platforms
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY p.is_hot DESC, p.sort_order ASC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...allParams);

  res.json({
    products,
    total: total ? total.total : 0,
    page: parseInt(page),
    totalPages: Math.ceil((total ? total.total : 0) / limit)
  });
});

// Public: get product by slug
router.get('/:slug', async (req, res) => {
  await getDb();
  const product = prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `).get(req.params.slug);

  if (!product) {
    return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  }

  const links = prepare('SELECT * FROM product_links WHERE product_id = ? ORDER BY price ASC').all(product.id);

  prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(product.id);
  prepare('INSERT INTO analytics (product_id, event_type, referrer, user_agent) VALUES (?, ?, ?, ?)')
    .run(product.id, 'view', req.headers.referer || '', req.headers['user-agent'] || '');

  res.json({ ...product, links });
});

// Admin: create product
router.post('/', requireAuth, async (req, res) => {
  await getDb();
  const { name, description, category_id, image_url, status, is_hot } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Tên sản phẩm là bắt buộc' });
  }

  let slug = slugify(name);
  const existing = prepare('SELECT id FROM products WHERE slug = ?').get(slug);
  if (existing) {
    slug = slug + '-' + Date.now();
  }

  const result = prepare(`
    INSERT INTO products (name, slug, description, category_id, image_url, status, is_hot)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, slug, description || '', category_id || null, image_url || '', status || 'draft', is_hot ? 1 : 0);

  const product = prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.json(product);
});

// Admin: update product
router.put('/:id', requireAuth, async (req, res) => {
  await getDb();
  const { name, slug, description, category_id, image_url, status, is_hot, sort_order } = req.body;
  const id = parseInt(req.params.id);

  const existing = prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  }

  let newSlug = slug || existing.slug;
  if (name && name !== existing.name && !slug) {
    newSlug = slugify(name);
    const slugExists = prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(newSlug, id);
    if (slugExists) {
      newSlug = newSlug + '-' + Date.now();
    }
  }

  prepare(`
    UPDATE products SET 
      name = ?, slug = ?, description = ?, category_id = ?,
      image_url = ?, status = ?, is_hot = ?, sort_order = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || existing.name,
    newSlug,
    description !== undefined ? description : existing.description,
    category_id !== undefined ? category_id : existing.category_id,
    image_url !== undefined ? image_url : existing.image_url,
    status || existing.status,
    is_hot !== undefined ? (is_hot ? 1 : 0) : existing.is_hot,
    sort_order !== undefined ? sort_order : existing.sort_order,
    id
  );

  const updated = prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(updated);
});

// Admin: delete product
router.delete('/:id', requireAuth, async (req, res) => {
  await getDb();
  prepare('DELETE FROM analytics WHERE product_id = ?').run(parseInt(req.params.id));
  prepare('DELETE FROM product_links WHERE product_id = ?').run(parseInt(req.params.id));
  const result = prepare('DELETE FROM products WHERE id = ?').run(parseInt(req.params.id));
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  }
  res.json({ ok: true });
});

// Admin: change status
router.patch('/:id/status', requireAuth, async (req, res) => {
  await getDb();
  const { status } = req.body;
  if (!['draft', 'published', 'hidden'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }
  prepare('UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, parseInt(req.params.id));
  res.json({ ok: true });
});

// Admin: duplicate product
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  await getDb();
  const original = prepare('SELECT * FROM products WHERE id = ?').get(parseInt(req.params.id));
  if (!original) {
    return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  }

  const newSlug = original.slug + '-copy-' + Date.now();
  const result = prepare(`
    INSERT INTO products (name, slug, description, category_id, image_url, status, is_hot)
    VALUES (?, ?, ?, ?, ?, 'draft', ?)
  `).run(original.name + ' (Bản sao)', newSlug, original.description, original.category_id, original.image_url, original.is_hot);

  const links = prepare('SELECT * FROM product_links WHERE product_id = ?').all(original.id);
  for (const link of links) {
    prepare('INSERT INTO product_links (product_id, platform, url, price, shop_name) VALUES (?, ?, ?, ?, ?)')
      .run(result.lastInsertRowid, link.platform, link.url, link.price, link.shop_name);
  }

  const product = prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.json(product);
});

module.exports = router;
