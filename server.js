const express = require('express');
const session = require('express-session');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'tiemnhame-secret-key-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Rate limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Thử lại sau ít phút' }
});
app.use('/api/auth/login', loginLimiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/links', require('./routes/links'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

// Customer SPA
app.get('/product/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// Admin SPA
app.get(['/admin', '/admin/', '/admin/*'], (req, res) => {
  const p1 = path.join(__dirname, 'public', 'admin', 'index.html');
  const p2 = path.join(__dirname, 'public', 'admin.html');
  const p3 = path.join(__dirname, 'admin', 'index.html');
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  if (fs.existsSync(p3)) return res.sendFile(p3);
  res.status(404).send('Admin page file not found');
});

const os = require('os');
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Tiệm nhà Me server running:`);
  console.log(`💻 PC Access:    http://localhost:${PORT}`);
  console.log(`📱 Phone Access: http://${localIP}:${PORT}`);
  console.log(`⚙️ Mobile Admin:  http://${localIP}:${PORT}/admin`);
});
