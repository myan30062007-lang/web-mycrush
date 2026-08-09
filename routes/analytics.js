const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Overview dashboard stats
router.get('/overview', requireAuth, async (req, res) => {
  await getDb();
  const { days = 7 } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));
  const sinceStr = since.toISOString();

  const totalViews = prepare('SELECT COUNT(*) as c FROM analytics WHERE event_type = ? AND created_at >= ?').get('view', sinceStr);
  const totalClicks = prepare('SELECT COUNT(*) as c FROM analytics WHERE event_type = ? AND created_at >= ?').get('click', sinceStr);
  const viewCount = totalViews ? totalViews.c : 0;
  const clickCount = totalClicks ? totalClicks.c : 0;
  const ctr = viewCount > 0 ? ((clickCount / viewCount) * 100).toFixed(1) : 0;

  const totalProducts = prepare('SELECT COUNT(*) as c FROM products').get();
  const publishedProducts = prepare("SELECT COUNT(*) as c FROM products WHERE status = 'published'").get();

  const topProducts = prepare(`
    SELECT p.id, p.name, p.slug, p.image_url,
      COUNT(CASE WHEN a.event_type = 'click' THEN 1 END) as click_count,
      COUNT(CASE WHEN a.event_type = 'view' THEN 1 END) as view_count
    FROM products p
    LEFT JOIN analytics a ON a.product_id = p.id AND a.created_at >= ?
    GROUP BY p.id
    ORDER BY click_count DESC
    LIMIT 10
  `).all(sinceStr);

  const traffic = prepare(`
    SELECT 
      CASE 
        WHEN referrer LIKE '%tiktok%' THEN 'TikTok'
        WHEN referrer LIKE '%facebook%' OR referrer LIKE '%fb%' THEN 'Facebook'
        WHEN referrer LIKE '%youtube%' THEN 'YouTube'
        WHEN referrer LIKE '%google%' THEN 'Google'
        WHEN referrer = '' OR referrer IS NULL THEN 'Direct'
        ELSE 'Other'
      END as source,
      COUNT(*) as count
    FROM analytics
    WHERE created_at >= ?
    GROUP BY source
    ORDER BY count DESC
  `).all(sinceStr);

  const platformClicks = prepare(`
    SELECT pl.platform, COUNT(*) as clicks
    FROM analytics a
    JOIN product_links pl ON a.link_id = pl.id
    WHERE a.event_type = 'click' AND a.created_at >= ?
    GROUP BY pl.platform
    ORDER BY clicks DESC
  `).all(sinceStr);

  res.json({
    totalViews: viewCount,
    totalClicks: clickCount,
    ctr: parseFloat(ctr),
    totalProducts: totalProducts ? totalProducts.c : 0,
    publishedProducts: publishedProducts ? publishedProducts.c : 0,
    topProducts,
    traffic,
    platformClicks
  });
});

// Product specific analytics
router.get('/products/:id', requireAuth, async (req, res) => {
  await getDb();
  const { days = 7 } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));
  const sinceStr = since.toISOString();
  const pid = parseInt(req.params.id);

  const product = prepare('SELECT * FROM products WHERE id = ?').get(pid);
  if (!product) return res.status(404).json({ error: 'Not found' });

  const views = prepare('SELECT COUNT(*) as c FROM analytics WHERE product_id = ? AND event_type = ? AND created_at >= ?').get(pid, 'view', sinceStr);
  const clicks = prepare('SELECT COUNT(*) as c FROM analytics WHERE product_id = ? AND event_type = ? AND created_at >= ?').get(pid, 'click', sinceStr);
  const viewCount = views ? views.c : 0;
  const clickCount = clicks ? clicks.c : 0;
  const ctr = viewCount > 0 ? ((clickCount / viewCount) * 100).toFixed(1) : 0;

  const platformClicks = prepare(`
    SELECT pl.platform, pl.shop_name, COUNT(a.id) as clicks
    FROM product_links pl
    LEFT JOIN analytics a ON a.link_id = pl.id AND a.event_type = 'click' AND a.created_at >= ?
    WHERE pl.product_id = ?
    GROUP BY pl.id
    ORDER BY clicks DESC
  `).all(sinceStr, pid);

  const traffic = prepare(`
    SELECT 
      CASE 
        WHEN referrer LIKE '%tiktok%' THEN 'TikTok'
        WHEN referrer LIKE '%facebook%' OR referrer LIKE '%fb%' THEN 'Facebook'
        WHEN referrer LIKE '%youtube%' THEN 'YouTube'
        WHEN referrer LIKE '%google%' THEN 'Google'
        WHEN referrer = '' OR referrer IS NULL THEN 'Direct'
        ELSE 'Other'
      END as source,
      COUNT(*) as count
    FROM analytics
    WHERE product_id = ? AND created_at >= ?
    GROUP BY source
    ORDER BY count DESC
  `).all(pid, sinceStr);

  res.json({ views: viewCount, clicks: clickCount, ctr: parseFloat(ctr), platformClicks, traffic });
});

// Track page view (public)
router.post('/view', async (req, res) => {
  await getDb();
  const { product_id } = req.body;
  if (product_id) {
    prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(parseInt(product_id));
    prepare('INSERT INTO analytics (product_id, event_type, referrer, user_agent) VALUES (?, ?, ?, ?)')
      .run(parseInt(product_id), 'view', req.headers.referer || '', req.headers['user-agent'] || '');
  }
  res.json({ ok: true });
});

module.exports = router;
