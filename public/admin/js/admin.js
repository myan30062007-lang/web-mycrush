const API = '';
let currentPage = 'dashboard';
let adminProducts = [];
let adminCategories = [];
let editingProductId = null;
let confirmCallback = null;
let searchTimeout = null;
let analyticsDays = 7;
let draftTimer = null;

async function checkAuth() {
  try {
    const res = await fetch(`${API}/api/auth/me`);
    if (res.ok) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-app').style.display = '';
      loadDashboard();
      loadAdminProducts();
      loadCategories();
      return true;
    }
  } catch (e) {}
  document.getElementById('login-screen').style.display = '';
  document.getElementById('admin-app').style.display = 'none';
  return false;
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const error = document.getElementById('login-error');

  btn.textContent = 'Đang đăng nhập...';
  btn.disabled = true;
  error.style.display = 'none';

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      checkAuth();
    } else {
      const data = await res.json().catch(() => ({}));
      error.textContent = data.error || 'Sai tài khoản hoặc mật khẩu';
      error.style.display = 'block';
    }
  } catch (err) {
    error.textContent = 'Lỗi kết nối server';
    error.style.display = 'block';
  }

  btn.textContent = 'Đăng nhập';
  btn.disabled = false;
}

async function handleLogout() {
  await fetch(`${API}/api/auth/logout`, { method: 'POST' });
  document.getElementById('login-screen').style.display = '';
  document.getElementById('admin-app').style.display = 'none';
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const titles = { dashboard: 'Dashboard', products: 'Sản phẩm', categories: 'Danh mục', analytics: 'Analytics', settings: 'Cài đặt' };
  document.getElementById('page-title').textContent = titles[page] || page;

  const fab = document.getElementById('fab-add');
  fab.style.display = (page === 'products' || page === 'dashboard') ? '' : 'none';

  if (page === 'dashboard') loadDashboard();
  if (page === 'products') loadAdminProducts();
  if (page === 'categories') loadCategories();
  if (page === 'analytics') loadAnalytics(analyticsDays);
  if (page === 'settings') loadSettingsForm();
}

function showToast(message, type = '') {
  const toast = document.getElementById('admin-toast');
  toast.textContent = message;
  toast.className = 'admin-toast show ' + type;
  setTimeout(() => toast.className = 'admin-toast', 2500);
}

function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function formatNumber(n) {
  if (!n) return '0';
  return new Intl.NumberFormat('vi-VN').format(n);
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/analytics/overview?days=7`);
    const data = await res.json();

    document.getElementById('stat-views').textContent = formatNumber(data.totalViews);
    document.getElementById('stat-clicks').textContent = formatNumber(data.totalClicks);
    document.getElementById('stat-ctr').textContent = data.ctr + '%';
    document.getElementById('stat-products').textContent = formatNumber(data.totalProducts);

    const topList = document.getElementById('top-products-list');
    if (data.topProducts && data.topProducts.length > 0) {
      topList.innerHTML = data.topProducts.slice(0, 5).map((p, i) => `
        <div class="top-product-item">
          <div class="top-product-rank">${i + 1}</div>
          <div class="top-product-info">
            <div class="top-product-name">${p.name}</div>
            <div class="top-product-clicks">${formatNumber(p.click_count)} clicks · ${formatNumber(p.view_count)} views</div>
          </div>
        </div>
      `).join('');
    } else {
      topList.innerHTML = '<div style="padding:20px;color:var(--text-muted);text-align:center;">Chưa có dữ liệu</div>';
    }

    renderTraffic(document.getElementById('traffic-sources'), data.traffic);
  } catch (err) {}
}

function renderTraffic(container, traffic) {
  if (!traffic || traffic.length === 0) {
    container.innerHTML = '<div style="padding:20px;color:var(--text-muted);text-align:center;">Chưa có dữ liệu</div>';
    return;
  }
  const maxCount = Math.max(...traffic.map(t => t.count));
  container.innerHTML = traffic.map(t => {
    const pct = maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0;
    const totalCount = traffic.reduce((s, x) => s + x.count, 0);
    const realPct = totalCount > 0 ? Math.round((t.count / totalCount) * 100) : 0;
    return `
      <div class="traffic-bar">
        <span class="traffic-source">${t.source}</span>
        <div class="traffic-bar-bg"><div class="traffic-bar-fill" style="width:${pct}%"></div></div>
        <span class="traffic-percent">${realPct}%</span>
      </div>
    `;
  }).join('');
}

async function loadAdminProducts(search = '', filters = {}) {
  const list = document.getElementById('admin-product-list');
  list.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';

  try {
    let url = `${API}/api/products?admin=1&limit=100`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (filters.status) url += `&status=${filters.status}`;
    if (filters.category) url += `&category=${filters.category}`;

    const res = await fetch(url);
    const data = await res.json();
    adminProducts = data.products || [];

    if (adminProducts.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">📦 Chưa có sản phẩm nào</div>';
      return;
    }

    list.innerHTML = adminProducts.map(p => {
      const imgSrc = p.image_url || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="#191925" width="80" height="80"/><text x="40" y="46" text-anchor="middle" fill="#5c5c72" font-size="24">📦</text></svg>');
      const platforms = p.platforms ? p.platforms.split(',').join(' · ') : '';
      return `
        <div class="admin-product-card" data-id="${p.id}">
          <img class="admin-product-thumb" src="${imgSrc}" alt="${p.name}" loading="lazy">
          <div class="admin-product-info">
            <div class="admin-product-name">${p.name}</div>
            <div class="admin-product-meta">
              ${p.category_name || 'Chưa phân loại'} ${platforms ? '· ' + platforms : ''}
            </div>
            <div class="admin-product-stats">
              <span>👁 ${formatNumber(p.views)}</span>
              <span>👆 ${formatNumber(p.clicks)}</span>
              <span class="status-badge ${p.status}">${p.status === 'published' ? '● Published' : p.status === 'draft' ? '○ Draft' : '◌ Hidden'}</span>
            </div>
          </div>
          <div class="admin-product-actions">
            <button class="more-btn" onclick="openProductSheet(${p.id})">⋮</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">Lỗi tải sản phẩm</div>';
  }
}

function debounceAdminSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const val = document.getElementById('admin-search').value.trim();
    loadAdminProducts(val);
  }, 300);
}

function openBottomSheet(html) {
  document.getElementById('bs-content').innerHTML = html;
  document.getElementById('bs-overlay').classList.add('show');
  document.getElementById('bottom-sheet').classList.add('show');
}

function closeBottomSheet() {
  document.getElementById('bs-overlay').classList.remove('show');
  document.getElementById('bottom-sheet').classList.remove('show');
}

function openProductSheet(productId) {
  const p = adminProducts.find(x => x.id === productId);
  if (!p) return;

  const statusLabel = p.status === 'published' ? 'Ẩn (Unpublish)' : 'Xuất bản (Publish)';
  const newStatus = p.status === 'published' ? 'hidden' : 'published';

  openBottomSheet(`
    <div class="bottom-sheet-title">${p.name}</div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();editProduct(${p.id})">
      <span class="bs-icon">✏️</span> Sửa sản phẩm
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();openLinkForm(${p.id})">
      <span class="bs-icon">🔗</span> Thêm link mua hàng
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();duplicateProduct(${p.id})">
      <span class="bs-icon">📋</span> Nhân bản
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();changeStatus(${p.id},'${newStatus}')">
      <span class="bs-icon">📴</span> ${statusLabel}
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();window.open('/product/${p.slug}','_blank')">
      <span class="bs-icon">👁</span> Xem trang khách
    </div>
    <div class="bottom-sheet-item danger" onclick="closeBottomSheet();confirmDelete(${p.id},'${p.name.replace(/'/g, "\\'")}')">
      <span class="bs-icon">🗑️</span> Xóa sản phẩm
    </div>
  `);
}

function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  editingProductId = null;
}

function openConfirm(title, message, btnText, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-action-btn').textContent = btnText;
  confirmCallback = callback;
  document.getElementById('confirm-overlay').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
}

function confirmAction() {
  if (confirmCallback) confirmCallback();
  closeConfirm();
}

function confirmDelete(id, name) {
  openConfirm(`Xóa "${name}"?`, 'Sản phẩm sẽ bị xóa vĩnh viễn khỏi website.', 'Xóa', () => deleteProduct(id));
}

function openProductForm(product = null) {
  editingProductId = product ? product.id : null;
  let catOptions = '<option value="">Chọn danh mục</option>';
  adminCategories.forEach(c => {
    const sel = product && product.category_id == c.id ? 'selected' : '';
    catOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
  });

  const isEdit = !!product;
  const name = product ? product.name : '';
  const desc = product ? product.description : '';
  const imgUrl = product ? product.image_url : '';
  const isHot = product ? product.is_hot : false;
  const status = product ? product.status : 'draft';

  openModal(isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm', `
    <form id="product-form" onsubmit="return saveProduct(event)">
      <div class="form-section-title">📝 Thông tin</div>
      <div class="form-group">
        <label class="form-label">Tên sản phẩm *</label>
        <input type="text" id="pf-name" value="${name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả</label>
        <textarea id="pf-desc">${desc}</textarea>
      </div>
      <div class="form-section-title">📷 Hình ảnh</div>
      <div class="form-group">
        <div class="upload-zone" onclick="document.getElementById('pf-image-file').click()">
          ${imgUrl ? `<img src="${imgUrl}" style="width:100px;height:100px;object-fit:cover;margin:0 auto;border-radius:8px;">` : '<div class="upload-zone-icon">📷</div><div class="upload-zone-text">Chọn hoặc chụp ảnh</div>'}
        </div>
        <input type="file" id="pf-image-file" accept="image/*" style="display:none" onchange="handleImageUpload(this)">
        <input type="hidden" id="pf-image-url" value="${imgUrl}">
      </div>
      <div class="form-section-title">📂 Phân loại</div>
      <div class="form-group">
        <label class="form-label">Danh mục</label>
        <select id="pf-category">${catOptions}</select>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" id="pf-hot" style="width:auto;" ${isHot ? 'checked' : ''}>
        <label for="pf-hot" class="form-label" style="margin:0;">🔥 Sản phẩm hot</label>
      </div>
      <div class="form-section-title">📢 Xuất bản</div>
      <div class="form-group">
        <label class="form-label">Trạng thái</label>
        <select id="pf-status">
          <option value="draft" ${status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${status === 'published' ? 'selected' : ''}>Published</option>
          <option value="hidden" ${status === 'hidden' ? 'selected' : ''}>Hidden</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full" id="save-product-btn">${isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm'}</button>
    </form>
  `);
}

async function saveProduct(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('pf-name').value,
    description: document.getElementById('pf-desc').value,
    image_url: document.getElementById('pf-image-url').value,
    category_id: document.getElementById('pf-category').value || null,
    is_hot: document.getElementById('pf-hot').checked,
    status: document.getElementById('pf-status').value
  };

  try {
    const url = editingProductId ? `${API}/api/products/${editingProductId}` : `${API}/api/products`;
    const method = editingProductId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) {
      showToast('✅ Đã lưu sản phẩm', 'success');
      closeModal();
      loadAdminProducts();
    }
  } catch (err) {}
}

async function editProduct(id) {
  const p = adminProducts.find(x => x.id === id);
  if (p) openProductForm(p);
}

async function deleteProduct(id) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Đã xóa', 'success');
      loadAdminProducts();
    }
  } catch (err) {}
}

async function duplicateProduct(id) {
  try {
    const res = await fetch(`${API}/api/products/${id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      showToast('📋 Đã nhân bản', 'success');
      loadAdminProducts();
    }
  } catch (err) {}
}

async function changeStatus(id, status) {
  try {
    const res = await fetch(`${API}/api/products/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast('✅ Đã đổi trạng thái', 'success');
      loadAdminProducts();
    }
  } catch (err) {}
}

async function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('pf-image-url').value = data.url;
      showToast('✅ Đã tải ảnh lên', 'success');
    }
  } catch (e) {}
}

function openLinkForm(productId) {
  openModal('Thêm link mua hàng', `
    <form onsubmit="return saveLinkForm(event, ${productId})">
      <div class="form-group">
        <label class="form-label">Nền tảng</label>
        <div class="platform-options">
          <div class="platform-option">
            <input type="radio" name="link-platform" value="shopee" id="lp-shopee" checked>
            <label for="lp-shopee">Shopee</label>
          </div>
          <div class="platform-option">
            <input type="radio" name="link-platform" value="tiktok" id="lp-tiktok">
            <label for="lp-tiktok">TikTok</label>
          </div>
          <div class="platform-option">
            <input type="radio" name="link-platform" value="lazada" id="lp-lazada">
            <label for="lp-lazada">Lazada</label>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Link Affiliate</label>
        <input type="url" id="lf-url" placeholder="https://..." required>
        <button type="button" class="paste-btn" onclick="pasteLink()">📋 PASTE</button>
      </div>
      <div class="form-group">
        <label class="form-label">Giá (VNĐ)</label>
        <input type="number" id="lf-price" placeholder="129000">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Lưu link</button>
    </form>
  `);
}

async function pasteLink() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('lf-url').value = text;
    showToast('📋 Đã paste', 'success');
  } catch (err) {}
}

async function saveLinkForm(e, productId) {
  e.preventDefault();
  const platform = document.querySelector('input[name="link-platform"]:checked').value;
  const url = document.getElementById('lf-url').value;
  const price = parseInt(document.getElementById('lf-price').value) || 0;

  try {
    const res = await fetch(`${API}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, platform, url, price })
    });
    if (res.ok) {
      showToast('✅ Đã thêm link', 'success');
      closeModal();
      loadAdminProducts();
    }
  } catch (err) {}
}

function openQuickAddForm() {
  openModal('⚡ Thêm sản phẩm nhanh', `
    <form onsubmit="return saveQuickAdd(event)">
      <div class="form-group">
        <label class="form-label">Tên sản phẩm *</label>
        <input type="text" id="qa-name" required placeholder="VD: Quạt mini Xiaomi">
      </div>
      <div class="form-group">
        <label class="form-label">Link Affiliate *</label>
        <input type="url" id="qa-link" required placeholder="https://shopee.vn/...">
        <button type="button" class="paste-btn" onclick="pasteQuickLink()">📋 PASTE</button>
      </div>
      <div class="form-group">
        <label class="form-label">Giá (VNĐ)</label>
        <input type="number" id="qa-price" placeholder="129000">
      </div>
      <div class="form-group">
        <label class="form-label">Ảnh sản phẩm</label>
        <div class="upload-zone" id="qa-upload-zone" onclick="document.getElementById('qa-image-file').click()">
          <div class="upload-zone-icon">📷</div>
          <div class="upload-zone-text">Chọn hoặc chụp ảnh</div>
        </div>
        <input type="file" id="qa-image-file" accept="image/*" style="display:none" onchange="handleQuickUpload(this)">
        <input type="hidden" id="qa-image-url">
      </div>
      <button type="submit" class="btn btn-primary btn-full">🚀 Đăng ngay</button>
    </form>
  `);
}

async function pasteQuickLink() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('qa-link').value = text;
    showToast('📋 Đã paste', 'success');
  } catch (err) {}
}

async function handleQuickUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('qa-image-url').value = data.url;
      showToast('✅ Upload ảnh thành công', 'success');
    }
  } catch (e) {}
}

async function saveQuickAdd(e) {
  e.preventDefault();
  const name = document.getElementById('qa-name').value;
  const linkUrl = document.getElementById('qa-link').value;
  const price = parseInt(document.getElementById('qa-price').value) || 0;
  const imageUrl = document.getElementById('qa-image-url').value || '';

  let platform = 'shopee';
  if (linkUrl.includes('tiktok')) platform = 'tiktok';
  else if (linkUrl.includes('lazada')) platform = 'lazada';

  try {
    const resP = await fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, image_url: imageUrl, status: 'published' })
    });
    const product = await resP.json();

    await fetch(`${API}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, platform, url: linkUrl, price })
    });

    showToast('🎉 Đã đăng sản phẩm thành công!', 'success');
    closeModal();
    loadAdminProducts();
  } catch (err) {}
}

async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    adminCategories = await res.json();
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = adminCategories.map(c => `
      <div class="category-item">
        <div>
          <div class="category-item-name">${c.name}</div>
          <div class="category-item-slug">/${c.slug} · ${c.product_count || 0} sản phẩm</div>
        </div>
      </div>
    `).join('');
  } catch (err) {}
}

function openCategoryForm() {
  openModal('Thêm danh mục', `
    <form onsubmit="return saveCategoryForm(event)">
      <div class="form-group">
        <label class="form-label">Tên danh mục</label>
        <input type="text" id="cf-name" required placeholder="VD: Gaming">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Thêm</button>
    </form>
  `);
}

async function saveCategoryForm(e) {
  e.preventDefault();
  const name = document.getElementById('cf-name').value;
  try {
    const res = await fetch(`${API}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      showToast('✅ Đã thêm danh mục', 'success');
      closeModal();
      loadCategories();
    }
  } catch (err) {}
}

async function loadAnalytics(days) {
  try {
    const res = await fetch(`${API}/api/analytics/overview?days=${days}`);
    const data = await res.json();

    document.getElementById('ana-views').textContent = formatNumber(data.totalViews);
    document.getElementById('ana-clicks').textContent = formatNumber(data.totalClicks);
    document.getElementById('ana-ctr').textContent = data.ctr + '%';
    document.getElementById('ana-published').textContent = formatNumber(data.publishedProducts);

    renderTraffic(document.getElementById('analytics-traffic'), data.traffic);
  } catch (err) {}
}

function filterAnalytics(el, days) {
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  analyticsDays = days;
  loadAnalytics(days);
}

async function loadSettingsForm() {
  try {
    const res = await fetch(`${API}/api/settings`);
    const s = await res.json();
    if (s.shop_name) document.getElementById('set-shop-name').value = s.shop_name;
    if (s.shop_desc) document.getElementById('set-shop-desc').value = s.shop_desc;
    if (s.social_tiktok) document.getElementById('set-tiktok').value = s.social_tiktok;
    if (s.social_facebook) document.getElementById('set-fb').value = s.social_facebook;
    if (s.social_youtube) document.getElementById('set-yt').value = s.social_youtube;
  } catch (e) {}
}

async function saveSettingsForm(e) {
  e.preventDefault();
  const settings = {
    shop_name: document.getElementById('set-shop-name').value,
    shop_desc: document.getElementById('set-shop-desc').value,
    social_tiktok: document.getElementById('set-tiktok').value,
    social_facebook: document.getElementById('set-fb').value,
    social_youtube: document.getElementById('set-yt').value
  };

  try {
    const res = await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      showToast('✅ Đã lưu cài đặt Shop', 'success');
    }
  } catch (err) {}
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeBottomSheet();
      closeConfirm();
    }
  });
});
