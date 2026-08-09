const express = require('express');
const router = express.Router();
const { getDb, prepare } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
