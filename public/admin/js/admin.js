/* ============================================
   Admin.js — Admin Panel SPA Logic
   ============================================ */

const API = '';
let currentPage = 'dashboard';
let adminProducts = [];
let adminCategories = [];
let editingProductId = null;
let confirmCallback = null;
let searchTimeout = null;
let analyticsDays = 7;
let draftTimer = null;

// ====== AUTH ======
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

// ====== NAVIGATION ======
function navigateTo(page) {
  currentPage = page;

  // Update pages
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update sidebar
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update header title
  const titles = { dashboard: 'Dashboard', products: 'Sản phẩm', categories: 'Danh mục', analytics: 'Analytics', settings: 'Cài đặt' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // FAB visibility
  const fab = document.getElementById('fab-add');
  fab.style.display = (page === 'products' || page === 'dashboard') ? '' : 'none';

  // Load data
  if (page === 'dashboard') loadDashboard();
  if (page === 'products') loadAdminProducts();
  if (page === 'categories') loadCategories();
  if (page === 'analytics') loadAnalytics(analyticsDays);
  if (page === 'settings') loadSettingsForm();
}

// ====== TOAST ======
function showToast(message, type = '') {
  const toast = document.getElementById('admin-toast');
  toast.textContent = message;
  toast.className = 'admin-toast show ' + type;
  setTimeout(() => toast.className = 'admin-toast', 2500);
}

// ====== FORMAT ======
function formatPrice(price) {
  if (!price) return '';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function formatNumber(n) {
  if (!n) return '0';
  return new Intl.NumberFormat('vi-VN').format(n);
}

// ====== DASHBOARD ======
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/analytics/overview?days=7`);
    const data = await res.json();

    document.getElementById('stat-views').textContent = formatNumber(data.totalViews);
    document.getElementById('stat-clicks').textContent = formatNumber(data.totalClicks);
    document.getElementById('stat-ctr').textContent = data.ctr + '%';
    document.getElementById('stat-products').textContent = formatNumber(data.totalProducts);

    // Top products
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

    // Traffic
    renderTraffic(document.getElementById('traffic-sources'), data.traffic);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
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

// ====== PRODUCTS ======
async function loadAdminProducts(search = '', filters = {}) {
  const list = document.getElementById('admin-product-list');
  list.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';

  try {
    let url = `${API}/api/products?admin=1&limit=100`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (filters.status) url += `&status=${filters.status}`;
    if (filters.category) url += `&category=${filters.category}`;
    if (filters.platform) url += `&platform=${filters.platform}`;

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
            <button class="more-btn" onclick="openProductSheet(${p.id})" title="Tùy chọn">⋮</button>
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

// ====== BOTTOM SHEET ======
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
  const statusIcon = p.status === 'published' ? '📴' : '📢';
  const newStatus = p.status === 'published' ? 'hidden' : 'published';

  openBottomSheet(`
    <div class="bottom-sheet-title">${p.name}</div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();editProduct(${p.id})">
      <span class="bs-icon">✏️</span> Sửa sản phẩm
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();openLinkForm(${p.id})">
      <span class="bs-icon">🔗</span> Thêm link
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();duplicateProduct(${p.id})">
      <span class="bs-icon">📋</span> Nhân bản
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();changeStatus(${p.id},'${newStatus}')">
      <span class="bs-icon">${statusIcon}</span> ${statusLabel}
    </div>
    <div class="bottom-sheet-item" onclick="closeBottomSheet();window.open('/product/${p.slug}','_blank')">
      <span class="bs-icon">👁</span> Xem trang khách
    </div>
    <div class="bottom-sheet-item danger" onclick="closeBottomSheet();confirmDelete(${p.id},'${p.name.replace(/'/g, "\\'")}')">
      <span class="bs-icon">🗑️</span> Xóa
    </div>
  `);
}

function openFilterSheet() {
  let catOptions = '<option value="">Tất cả</option>';
  adminCategories.forEach(c => {
    catOptions += `<option value="${c.slug}">${c.name}</option>`;
  });

  openBottomSheet(`
    <div class="bottom-sheet-title">Bộ lọc</div>
    <div style="padding:0 20px 20px;">
      <div class="form-group">
        <label class="form-label">Trạng thái</label>
        <select id="filter-status">
          <option value="">Tất cả</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Danh mục</label>
        <select id="filter-category">${catOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Nền tảng</label>
        <select id="filter-platform">
          <option value="">Tất cả</option>
          <option value="shopee">Shopee</option>
          <option value="tiktok">TikTok</option>
          <option value="lazada">Lazada</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick="applyFilters()">Áp dụng</button>
    </div>
  `);
}

function applyFilters() {
  const status = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category').value;
  const platform = document.getElementById('filter-platform').value;
  closeBottomSheet();
  loadAdminProducts('', { status, category, platform });
}

// ====== MODAL ======
function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  editingProductId = null;
  clearDraftTimer();
}

// ====== CONFIRM DIALOG ======
function openConfirm(title, message, btnText, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-action-btn').textContent = btnText;
  confirmCallback = callback;
  document.getElementById('confirm-overlay').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
  confirmCallback = null;
}

function confirmAction() {
  if (confirmCallback) confirmCallback();
  closeConfirm();
}

function confirmDelete(id, name) {
  openConfirm(
    `Xóa "${name}"?`,
    'Sản phẩm sẽ bị xóa vĩnh viễn khỏi website.',
    'Xóa',
    () => deleteProduct(id)
  );
}

// ====== PRODUCT CRUD ======
function openProductForm(product = null) {
  editingProductId = product ? product.id : null;

  let catOptions = '<option value="">Chọn danh mục</option>';
  adminCategories.forEach(c => {
    const sel = product && product.category_id == c.id ? 'selected' : '';
    catOptions += `<option value="${c.id}" ${sel}>${c.name}</option>`;
  });

  const isEdit = !!product;
  const title = isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  const imagePreview = product && product.image_url
    ? `<div class="upload-preview" id="image-preview"><img src="${product.image_url}"><button class="remove-image" onclick="removeImage()">✕</button></div>`
    : '';

  // Check for draft
  let draft = null;
  if (!isEdit) {
    try { draft = JSON.parse(localStorage.getItem('product-draft')); } catch (e) {}
  }

  const name = product ? product.name : (draft ? draft.name : '');
  const desc = product ? product.description : (draft ? draft.description : '');
  const imgUrl = product ? product.image_url : (draft ? draft.image_url : '');
  const catId = product ? product.category_id : (draft ? draft.category_id : '');
  const isHot = product ? product.is_hot : (draft ? draft.is_hot : false);
  const status = product ? product.status : (draft ? draft.status : 'draft');

  openModal(title, `
    <form id="product-form" onsubmit="return saveProduct(event)">
      <div class="form-section-title">📝 Thông tin</div>
      <div class="form-group">
        <label class="form-label">Tên sản phẩm *</label>
        <input type="text" id="pf-name" value="${name}" required oninput="autosaveDraft()">
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả</label>
        <textarea id="pf-desc" oninput="autosaveDraft()">${desc}</textarea>
      </div>

      <div class="form-section-title">📷 Hình ảnh</div>
      <div class="form-group">
        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('pf-image-file').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleDrop(event)">
          ${imagePreview || '<div class="upload-zone-icon">📷</div><div class="upload-zone-text">Chụp ảnh hoặc chọn từ thư viện</div>'}
        </div>
        <input type="file" id="pf-image-file" accept="image/*" capture="environment" style="display:none" onchange="handleImageUpload(this)">
        <input type="hidden" id="pf-image-url" value="${imgUrl}">
        <div class="upload-progress" id="upload-progress" style="display:none"><div class="upload-progress-bar" id="upload-progress-bar"></div></div>
      </div>

      <div class="form-section-title">📂 Phân loại</div>
      <div class="form-group">
        <label class="form-label">Danh mục</label>
        <select id="pf-category" oninput="autosaveDraft()">${catOptions}</select>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" id="pf-hot" style="width:auto;" ${isHot ? 'checked' : ''} onchange="autosaveDraft()">
        <label for="pf-hot" class="form-label" style="margin:0;">🔥 Sản phẩm hot</label>
      </div>

      <div class="form-section-title">📢 Xuất bản</div>
      <div class="form-group">
        <label class="form-label">Trạng thái</label>
        <select id="pf-status" oninput="autosaveDraft()">
          <option value="draft" ${status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${status === 'published' ? 'selected' : ''}>Published</option>
          <option value="hidden" ${status === 'hidden' ? 'selected' : ''}>Hidden</option>
        </select>
      </div>

      <div class="autosave-indicator" id="autosave-indicator"></div>

      <button type="submit" class="btn btn-primary btn-full" id="save-product-btn">
        ${isEdit ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
      </button>
    </form>
  `);

  if (draft && !isEdit) {
    document.getElementById('autosave-indicator').textContent = '📝 Đã khôi phục bản nháp';
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('save-product-btn');
  btn.textContent = 'Đang lưu...';
  btn.disabled = true;

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

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      showToast(editingProductId ? '✅ Đã cập nhật' : '✅ Đã thêm sản phẩm', 'success');
      localStorage.removeItem('product-draft');
      closeModal();
      loadAdminProducts();
      loadDashboard();
    } else {
      const err = await res.json();
      showToast('❌ ' + (err.error || 'Lỗi'), 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối', 'error');
  }

  btn.textContent = editingProductId ? 'Lưu thay đổi' : 'Đăng sản phẩm';
  btn.disabled = false;
}

async function editProduct(id) {
  try {
    const p = adminProducts.find(x => x.id === id);
    if (!p) return;

    // Fetch full product data with links
    const res = await fetch(`${API}/api/products/${p.slug}`);
    const full = await res.json();
    openProductForm(full);
  } catch (err) {
    showToast('❌ Lỗi tải sản phẩm', 'error');
  }
}

async function deleteProduct(id) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Đã xóa', 'success');
      loadAdminProducts();
    } else {
      showToast('❌ Lỗi xóa', 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối', 'error');
  }
}

async function duplicateProduct(id) {
  try {
    const res = await fetch(`${API}/api/products/${id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      showToast('📋 Đã nhân bản', 'success');
      loadAdminProducts();
    }
  } catch (err) {
    showToast('❌ Lỗi', 'error');
  }
}

async function changeStatus(id, status) {
  try {
    const res = await fetch(`${API}/api/products/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast('✅ Đã cập nhật trạng thái', 'success');
      loadAdminProducts();
    }
  } catch (err) {
    showToast('❌ Lỗi', 'error');
  }
}

// ====== IMAGE UPLOAD ======
async function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  await uploadImage(file);
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    uploadImage(file);
  }
}

async function uploadImage(file) {
  const progressContainer = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  progressContainer.style.display = 'block';
  progressBar.style.width = '30%';

  const formData = new FormData();
  formData.append('image', file);

  try {
    progressBar.style.width = '60%';
    const res = await fetch(`${API}/api/upload`, {
      method: 'POST',
      body: formData
    });

    progressBar.style.width = '90%';

    if (res.ok) {
      const data = await res.json();
      document.getElementById('pf-image-url').value = data.url;

      const zone = document.getElementById('upload-zone');
      zone.innerHTML = `
        <div class="upload-preview" id="image-preview">
          <img src="${data.url}">
          <button type="button" class="remove-image" onclick="removeImage()">✕</button>
        </div>
      `;

      progressBar.style.width = '100%';
      setTimeout(() => { progressContainer.style.display = 'none'; }, 500);
      showToast('✅ Ảnh đã tải lên', 'success');
      autosaveDraft();
    } else {
      showToast('❌ Lỗi upload', 'error');
      progressContainer.style.display = 'none';
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối', 'error');
    progressContainer.style.display = 'none';
  }
}

function removeImage() {
  document.getElementById('pf-image-url').value = '';
  const zone = document.getElementById('upload-zone');
  zone.innerHTML = '<div class="upload-zone-icon">📷</div><div class="upload-zone-text">Chụp ảnh hoặc chọn từ thư viện</div>';
  autosaveDraft();
}

// ====== PRODUCT LINKS ======
function openLinkForm(productId) {
  openModal('Thêm link mua hàng', `
    <form onsubmit="return saveLinkForm(event, ${productId})">
      <div class="form-group">
        <label class="form-label">Nền tảng</label>
        <div class="platform-options">
          <div class="platform-option">
            <input type="radio" name="link-platform" value="shopee" id="lp-shopee" checked>
            <label for="lp-shopee">🟠 Shopee</label>
          </div>
          <div class="platform-option">
            <input type="radio" name="link-platform" value="tiktok" id="lp-tiktok">
            <label for="lp-tiktok">⬛ TikTok</label>
          </div>
          <div class="platform-option">
            <input type="radio" name="link-platform" value="lazada" id="lp-lazada">
            <label for="lp-lazada">🔵 Lazada</label>
          </div>
          <div class="platform-option">
            <input type="radio" name="link-platform" value="other" id="lp-other">
            <label for="lp-other">⚪ Khác</label>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Link affiliate</label>
        <input type="url" id="lf-url" placeholder="https://..." required>
        <button type="button" class="paste-btn" onclick="pasteLink()">📋 PASTE</button>
      </div>

      <div class="form-group">
        <label class="form-label">Giá (VNĐ)</label>
        <input type="number" id="lf-price" placeholder="129000">
      </div>

      <div class="form-group">
        <label class="form-label">Tên shop</label>
        <input type="text" id="lf-shop" placeholder="Tên shop trên sàn">
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
  } catch (err) {
    showToast('Không thể paste. Hãy paste thủ công.', 'error');
  }
}

async function saveLinkForm(e, productId) {
  e.preventDefault();
  const platform = document.querySelector('input[name="link-platform"]:checked').value;
  const url = document.getElementById('lf-url').value;
  const price = parseInt(document.getElementById('lf-price').value) || 0;
  const shop_name = document.getElementById('lf-shop').value;

  try {
    const res = await fetch(`${API}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, platform, url, price, shop_name })
    });

    if (res.ok) {
      showToast('✅ Đã thêm link', 'success');
      closeModal();
      loadAdminProducts();
    } else {
      const err = await res.json();
      showToast('❌ ' + (err.error || 'Lỗi'), 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối', 'error');
  }
}

// ====== AUTOSAVE DRAFT ======
function autosaveDraft() {
  if (editingProductId) return; // Don't autosave when editing

  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const nameEl = document.getElementById('pf-name');
    const descEl = document.getElementById('pf-desc');
    if (!nameEl) return;

    const draft = {
      name: nameEl.value,
      description: descEl ? descEl.value : '',
      image_url: document.getElementById('pf-image-url') ? document.getElementById('pf-image-url').value : '',
      category_id: document.getElementById('pf-category') ? document.getElementById('pf-category').value : '',
      is_hot: document.getElementById('pf-hot') ? document.getElementById('pf-hot').checked : false,
      status: document.getElementById('pf-status') ? document.getElementById('pf-status').value : 'draft',
      saved_at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    localStorage.setItem('product-draft', JSON.stringify(draft));
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) indicator.textContent = `📝 Đã lưu nháp ${draft.saved_at}`;
  }, 1000);
}

function clearDraftTimer() {
  clearTimeout(draftTimer);
}

// ====== CATEGORIES ======
async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    adminCategories = await res.json();

    const list = document.getElementById('category-list');
    if (!list) return;

    if (adminCategories.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Chưa có danh mục</div>';
      return;
    }

    list.innerHTML = adminCategories.map(c => `
      <div class="category-item" data-id="${c.id}">
        <div>
          <div class="category-item-name">${c.name}</div>
          <div class="category-item-slug">/${c.slug} · ${c.product_count || 0} sản phẩm</div>
        </div>
        <div class="category-item-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditCategory(${c.id},'${c.name.replace(/'/g,"\\'")}','${c.slug}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDeleteCategory(${c.id},'${c.name.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load categories error:', err);
  }
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

function openEditCategory(id, name, slug) {
  openModal('Sửa danh mục', `
    <form onsubmit="return updateCategoryForm(event, ${id})">
      <div class="form-group">
        <label class="form-label">Tên danh mục</label>
        <input type="text" id="cf-name" value="${name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Slug</label>
        <input type="text" id="cf-slug" value="${slug}">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Lưu</button>
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
    } else {
      const err = await res.json();
      showToast('❌ ' + (err.error || 'Lỗi'), 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối', 'error');
  }
}

async function updateCategoryForm(e, id) {
  e.preventDefault();
  const name = document.getElementById('cf-name').value;
  const slug = document.getElementById('cf-slug').value;

  try {
    const res = await fetch(`${API}/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug })
    });

    if (res.ok) {
      showToast('✅ Đã cập nhật', 'success');
      closeModal();
      loadCategories();
    }
  } catch (err) {
    showToast('❌ Lỗi', 'error');
  }
}

function confirmDeleteCategory(id, name) {
  openConfirm(`Xóa "${name}"?`, 'Danh mục sẽ bị xóa. Sản phẩm thuộc danh mục này sẽ không bị xóa.', 'Xóa', async () => {
    try {
      await fetch(`${API}/api/categories/${id}`, { method: 'DELETE' });
      showToast('🗑️ Đã xóa', 'success');
      loadCategories();
    } catch (err) {
      showToast('❌ Lỗi', 'error');
    }
  });
}

// ====== ANALYTICS ======
function filterAnalytics(el, days) {
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  analyticsDays = days;
  loadAnalytics(days);
}

async function loadAnalytics(days) {
  try {
    const res = await fetch(`${API}/api/analytics/overview?days=${days}`);
    const data = await res.json();

    document.getElementById('ana-views').textContent = formatNumber(data.totalViews);
    document.getElementById('ana-clicks').textContent = formatNumber(data.totalClicks);
    document.getElementById('ana-ctr').textContent = data.ctr + '%';
    document.getElementById('ana-published').textContent = formatNumber(data.publishedProducts);

    // Traffic
    renderTraffic(document.getElementById('analytics-traffic'), data.traffic);

    // Top products
    const topList = document.getElementById('analytics-top-products');
    if (data.topProducts && data.topProducts.length > 0) {
      topList.innerHTML = data.topProducts.slice(0, 10).map((p, i) => `
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
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

// ====== QUICK ADD ======
function openQuickAddForm() {
  openModal('⚡ Thêm sản phẩm nhanh', `
    <form onsubmit="return saveQuickAdd(event)">
      <div class="form-group">
        <label class="form-label">Tên sản phẩm *</label>
        <input type="text" id="qa-name" required placeholder="VD: Quạt mini Xiaomi">
      </div>
      <div class="form-group">
        <label class="form-label">Link Affiliate (Shopee/TikTok/Lazada) *</label>
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
      <button type="submit" class="btn btn-primary btn-full" id="qa-btn">🚀 Đăng ngay</button>
    </form>
  `);
}

async function pasteQuickLink() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('qa-link').value = text;
    showToast('📋 Đã paste', 'success');
  } catch (err) {
    showToast('Hãy paste thủ công', 'error');
  }
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
      document.getElementById('qa-upload-zone').innerHTML = `<img src="${data.url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin:0 auto;">`;
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
    // 1. Create product
    const resP = await fetch(`${API}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, image_url: imageUrl, status: 'published' })
    });
    const product = await resP.json();

    // 2. Add link
    await fetch(`${API}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, platform, url: linkUrl, price })
    });

    showToast('🎉 Đã đăng sản phẩm thành công!', 'success');
    closeModal();
    loadAdminProducts();
    loadDashboard();
  } catch (err) {
    showToast('❌ Lỗi đăng sản phẩm', 'error');
  }
}

// ====== SETTINGS PAGE HANDLER ======
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
  } catch (err) {
    showToast('❌ Lỗi lưu cài đặt', 'error');
  }
}

// ====== INIT ======
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
