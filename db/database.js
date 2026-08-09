const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mycrush.db');
const dataDir = path.dirname(DB_PATH);

let db = null;
let saveTimer = null;

async function getDb() {
  if (db) return db;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Init tables
  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      category_id INTEGER,
      image_url TEXT DEFAULT '',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','hidden')),
      is_hot INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('shopee','tiktok','lazada','other')),
      url TEXT NOT NULL,
      price INTEGER DEFAULT 0,
      shop_name TEXT DEFAULT '',
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      link_id INTEGER,
      event_type TEXT NOT NULL CHECK(event_type IN ('view','click')),
      referrer TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (link_id) REFERENCES product_links(id) ON DELETE CASCADE
    );
  `);

  // Default settings if empty
  const defaultSettings = [
    ['shop_name', 'Tiệm nhà Me'],
    ['shop_desc', 'Chia sẻ sản phẩm hot, deal tốt nhất 🔥'],
    ['shop_avatar', ''],
    ['social_tiktok', 'https://www.tiktok.com'],
    ['social_facebook', 'https://www.facebook.com'],
    ['social_youtube', 'https://www.youtube.com']
  ];
  for (const [k, v] of defaultSettings) {
    try {
      db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
    } catch (e) {}
  }

  // Ensure Thaomy admin user exists
  const bcrypt = require('bcryptjs');
  const existingAdmin = db.prepare('SELECT id FROM admin WHERE username = ?');
  existingAdmin.bind(['Thaomy']);
  if (!existingAdmin.step()) {
    const hash = bcrypt.hashSync('Thaomy2007', 10);
    db.run('INSERT INTO admin (username, password_hash) VALUES (?, ?)', ['Thaomy', hash]);
  }
  existingAdmin.free();

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)',
    'CREATE INDEX IF NOT EXISTS idx_product_links_product ON product_links(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type)'
  ];
  for (const idx of indexes) {
    try { db.run(idx); } catch (e) {}
  }

  db.run('PRAGMA foreign_keys = ON');

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (e) {
      console.error('DB save error:', e);
    }
  }, 500);
}

function prepare(sql) {
  return {
    get(...params) {
      const d = db;
      const stmt = d.prepare(sql);
      if (params.length) stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const d = db;
      const results = [];
      const stmt = d.prepare(sql);
      if (params.length) stmt.bind(params);
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        results.push(row);
      }
      stmt.free();
      return results;
    },
    run(...params) {
      const d = db;
      d.run(sql, params);
      const changes = d.getRowsModified();
      const lastStmt = d.prepare('SELECT last_insert_rowid() as id');
      lastStmt.step();
      const lastId = lastStmt.get()[0];
      lastStmt.free();
      saveDb();
      return { changes, lastInsertRowid: lastId };
    }
  };
}

module.exports = { getDb, prepare, saveDb };
