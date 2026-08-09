const API = '';
let currentCategory = '';
let searchTimeout = null;

function formatPrice(price) {
  if (!price || price === 0) return '';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function createProductCard(product) {
  const price = product.min_price ? formatPrice(product.min_price) : '';
  const platforms = product.platforms ? product.platforms.split(',') : [];
  const platformTags = platforms.map(p =>
    `<span class="platform-tag ${p}">${p === 'tiktok' ? 'TikTok' : p.charAt(0).toUpperCase() + p.slice(1)}</span>`
  ).join('');

  const badge = product.is_hot ? '<span class="product-badge hot">🔥 HOT</span>' : '';
  const imgSrc = product.image_url || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#1a1a2e" width="200" height="200"/><text x="100" y="108" text-anchor="middle" fill="#6a6a80" font-size="40">📦</text></svg>');

  return `
    <a href="/product/${product.slug}" class="product-card" data-id="${product.id}">
      <div class="product-image-wrapper">
        ${badge}
        <img class="product-card-image" src="${imgSrc}" alt="${product.name}" loading="lazy">
      </div>
      <div class="product-card-info">
        <div class="product-card-name">${product.name}</div>
        ${price ? `<div class="product-card-price">${price}</div>` : ''}
        <div class="product-card-platforms">${platformTags}</div>
      </div>
    </a>
  `;
}

function createSkeletonCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="product-card">
        <div class="skeleton-image skeleton"></div>
        <div class="product-card-info">
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    `;
  }
  return html;
}

async function loadShopSettings() {
  try {
    const res = await fetch(`${API}/api/settings/public`);
    const settings = await res.json();

    if (settings.shop_name) {
      document.querySelector('.shop-name').textContent = settings.shop_name;
      document.title = `${settings.shop_name} — Sản phẩm hot & Deal tốt nhất`;
    }
    if (settings.shop_desc) {
      document.querySelector('.shop-desc').textContent = settings.shop_desc;
    }

    const avatarEl = document.getElementById('shop-avatar');
    if (settings.shop_avatar) {
      avatarEl.innerHTML = `<img src="${settings.shop_avatar}" alt="${settings.shop_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      avatarEl.classList.remove('skeleton');
    } else {
      avatarEl.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;border-radius:50%;background:var(--bg-card);">💖</div>';
      avatarEl.classList.remove('skeleton');
    }

    if (settings.social_tiktok) document.getElementById('social-tiktok').href = settings.social_tiktok;
    if (settings.social_facebook) document.getElementById('social-facebook').href = settings.social_facebook;
    if (settings.social_youtube) document.getElementById('social-youtube').href = settings.social_youtube;

  } catch (err) {
    console.error('Failed to load shop settings:', err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    const categories = await res.json();
    const scroller = document.getElementById('category-scroller');

    let html = '<button class="category-chip active" data-category="" onclick="filterCategory(this, \'\')">Tất cả</button>';
    categories.forEach(cat => {
      html += `<button class="category-chip" data-category="${cat.slug}" onclick="filterCategory(this, '${cat.slug}')">${cat.name}</button>`;
    });
    scroller.innerHTML = html;
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function filterCategory(el, slug) {
  document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  currentCategory = slug;
  loadProducts();
}

async function loadProducts() {
  const hotGrid = document.getElementById('hot-products');
  const allGrid = document.getElementById('all-products');
  const hotSection = document.getElementById('hot-section');
  const emptyState = document.getElementById('empty-state');
  const searchVal = document.getElementById('search-input').value.trim();

  hotGrid.innerHTML = createSkeletonCards(4);
  allGrid.innerHTML = createSkeletonCards(6);

  try {
    let url = `${API}/api/products?limit=50`;
    if (currentCategory) url += `&category=${currentCategory}`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;

    const res = await fetch(url);
    const data = await res.json();
    const products = data.products || [];

    if (products.length === 0) {
      hotSection.style.display = 'none';
      allGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    const hotProducts = products.filter(p => p.is_hot);
    if (hotProducts.length > 0 && !searchVal && !currentCategory) {
      hotSection.style.display = 'block';
      hotGrid.innerHTML = hotProducts.map(createProductCard).join('');
    } else {
      hotSection.style.display = 'none';
      hotGrid.innerHTML = '';
    }

    allGrid.innerHTML = products.map(createProductCard).join('');

  } catch (err) {
    console.error('Failed to load products:', err);
    hotGrid.innerHTML = '';
    allGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Lỗi kết nối. Thử lại sau.</p></div>';
  }
}

function setupSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadProducts();
    }, 300);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadShopSettings();
  loadCategories();
  loadProducts();
  setupSearch();
});
