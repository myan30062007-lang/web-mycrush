const { getDb, prepare, saveDb } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding database...');
  await getDb();

  // Create/update admin account (Thaomy / Thaomy2007)
  prepare('DELETE FROM admin').run();
  const hash = bcrypt.hashSync('Thaomy2007', 10);
  prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('Thaomy', hash);
  console.log('✅ Admin account set: Thaomy / Thaomy2007');

  // Create categories
  const categories = [
    { name: 'Gaming', slug: 'gaming', sort_order: 1 },
    { name: 'Gia dụng', slug: 'gia-dung', sort_order: 2 },
    { name: 'Thời trang', slug: 'thoi-trang', sort_order: 3 },
    { name: 'Công nghệ', slug: 'cong-nghe', sort_order: 4 },
    { name: 'Làm đẹp', slug: 'lam-dep', sort_order: 5 },
    { name: 'Phụ kiện', slug: 'phu-kien', sort_order: 6 }
  ];

  for (const cat of categories) {
    const existing = prepare('SELECT id FROM categories WHERE slug = ?').get(cat.slug);
    if (!existing) {
      prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)').run(cat.name, cat.slug, cat.sort_order);
    }
  }
  console.log('✅ Categories seeded');

  // Create sample products
  const sampleProducts = [
    {
      name: 'Quạt Mini Xiaomi USB',
      slug: 'quat-mini-xiaomi-usb',
      description: 'Quạt mini cầm tay Xiaomi, sạc USB, 3 tốc độ gió, pin 2000mAh. Nhỏ gọn, tiện lợi mang theo.',
      category_slug: 'gia-dung',
      status: 'published',
      is_hot: 1,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example1', price: 129000, shop_name: 'Xiaomi Official' },
        { platform: 'tiktok', url: 'https://www.tiktok.com/@shop/product1', price: 125000, shop_name: 'Xiaomi Store' }
      ]
    },
    {
      name: 'Bàn Phím Cơ Aula F75',
      slug: 'ban-phim-co-aula-f75',
      description: 'Bàn phím cơ Aula F75, switch Gasket mount, RGB, kết nối 3 chế độ: Bluetooth, 2.4G, Type-C.',
      category_slug: 'gaming',
      status: 'published',
      is_hot: 1,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example2', price: 899000, shop_name: 'Aula Store' },
        { platform: 'lazada', url: 'https://lazada.vn/product/example2', price: 920000, shop_name: 'Aula Official' }
      ]
    },
    {
      name: 'Chuột Logitech G304',
      slug: 'chuot-logitech-g304',
      description: 'Chuột gaming không dây Logitech G304 LIGHTSPEED, sensor HERO 12K DPI, pin AA dùng 250 giờ.',
      category_slug: 'gaming',
      status: 'published',
      is_hot: 0,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example3', price: 590000, shop_name: 'Logitech VN' },
        { platform: 'tiktok', url: 'https://www.tiktok.com/@shop/product3', price: 575000, shop_name: 'Logitech Official' }
      ]
    },
    {
      name: 'Tai Nghe Bluetooth QCY T13',
      slug: 'tai-nghe-bluetooth-qcy-t13',
      description: 'Tai nghe true wireless QCY T13, Bluetooth 5.1, pin 40 giờ, chống nước IPX5.',
      category_slug: 'cong-nghe',
      status: 'published',
      is_hot: 1,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example4', price: 199000, shop_name: 'QCY Store' }
      ]
    },
    {
      name: 'Đèn Bàn LED Chống Cận',
      slug: 'den-ban-led-chong-can',
      description: 'Đèn bàn LED bảo vệ mắt, 3 chế độ ánh sáng, điều chỉnh độ sáng, cổng sạc USB.',
      category_slug: 'gia-dung',
      status: 'published',
      is_hot: 0,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example5', price: 159000, shop_name: 'Home Living' },
        { platform: 'tiktok', url: 'https://www.tiktok.com/@shop/product5', price: 149000, shop_name: 'Home Store' },
        { platform: 'lazada', url: 'https://lazada.vn/product/example5', price: 165000, shop_name: 'Home Official' }
      ]
    },
    {
      name: 'Son Dưỡng Môi Vaseline',
      slug: 'son-duong-moi-vaseline',
      description: 'Son dưỡng môi Vaseline Lip Therapy, dưỡng ẩm sâu, mềm mượt, không gây khô.',
      category_slug: 'lam-dep',
      status: 'draft',
      is_hot: 0,
      links: [
        { platform: 'shopee', url: 'https://shopee.vn/product/example6', price: 45000, shop_name: 'Vaseline Official' }
      ]
    }
  ];

  for (const p of sampleProducts) {
    const existingP = prepare('SELECT id FROM products WHERE slug = ?').get(p.slug);
    if (existingP) continue;

    const cat = prepare('SELECT id FROM categories WHERE slug = ?').get(p.category_slug);
    const catId = cat ? cat.id : null;
    const views = Math.floor(Math.random() * 5000) + 500;
    const clicks = Math.floor(views * (Math.random() * 0.4 + 0.1));

    const result = prepare(`
      INSERT INTO products (name, slug, description, category_id, status, is_hot, views, clicks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.name, p.slug, p.description, catId, p.status, p.is_hot, views, clicks);

    for (const link of p.links) {
      prepare('INSERT INTO product_links (product_id, platform, url, price, shop_name) VALUES (?, ?, ?, ?, ?)')
        .run(result.lastInsertRowid, link.platform, link.url, link.price, link.shop_name);
    }
  }
  console.log('✅ Sample products seeded');

  saveDb();
  console.log('🎉 Seed completed!');
  
  // Force save to disk immediately
  setTimeout(() => process.exit(0), 1000);
}

seed();
