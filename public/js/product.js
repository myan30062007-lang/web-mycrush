const API = '';

function formatPrice(price) {
  if (!price || price === 0) return '';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function getPlatformLabel(platform) {
  const labels = { shopee: 'Shopee', tiktok: 'TikTok Shop', lazada: 'Lazada', other: 'Khác' };
  return labels[platform] || platform;
}

async function loadProduct() {
  const slug = window.location.pathname.replace('/product/', '');
  if (!slug) return;

  try {
    const res = await fetch(`${API}/api/products/${slug}`);
    if (!res.ok) {
      document.getElementById('product-info').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😕</div>
          <p class="empty-state-text">Không tìm thấy sản phẩm</p>
          <a href="/" style="color:var(--accent);margin-top:16px;display:inline-block;">← Về trang chủ</a>
        </div>`;
      return;
    }

    const product = await res.json();

    document.title = `${product.name} — Tiệm nhà Me`;
    document.getElementById('product-back-title').textContent = product.name;

    const imgContainer = document.getElementById('product-image-container');
    if (product.image_url) {
      imgContainer.innerHTML = `<img class="product-hero-image" src="${product.image_url}" alt="${product.name}">`;
    } else {
      imgContainer.innerHTML = `<div style="width:100%;aspect-ratio:1;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:4rem;">📦</div>`;
    }

    const minPrice = product.links && product.links.length > 0
      ? Math.min(...product.links.filter(l => l.price > 0).map(l => l.price))
      : 0;

    document.getElementById('product-info').innerHTML = `
      <h1 class="product-title">${product.name}</h1>
      ${minPrice > 0 ? `<div class="product-price-main">Giá từ ${formatPrice(minPrice)}</div>` : ''}
      ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
    `;

    const buySection = document.getElementById('buy-section');
    if (product.links && product.links.length > 0) {
      let linksHtml = '<div class="buy-section-title">🛒 Mua tại</div>';
      product.links.forEach(link => {
        linksHtml += `
          <div class="buy-link-card" onclick="trackAndBuy(${link.id}, '${link.url}')">
            <div class="buy-link-info">
              <div class="buy-link-platform ${link.platform}">${getPlatformLabel(link.platform)}</div>
              ${link.price > 0 ? `<div class="buy-link-price">${formatPrice(link.price)}</div>` : ''}
              ${link.shop_name ? `<div class="buy-link-shop">${link.shop_name}</div>` : ''}
            </div>
            <button class="buy-link-btn ${link.platform}">MUA NGAY</button>
          </div>
        `;
      });
      buySection.innerHTML = linksHtml;

      const stickyBar = document.getElementById('sticky-buy-bar');
      if (product.links.length === 1) {
        const l = product.links[0];
        stickyBar.innerHTML = `<button class="sticky-buy-btn single" onclick="trackAndBuy(${l.id}, '${l.url}')">🛒 MUA NGAY ${l.price > 0 ? '— ' + formatPrice(l.price) : ''}</button>`;
      } else {
        stickyBar.innerHTML = product.links.slice(0, 3).map(l =>
          `<button class="sticky-buy-btn ${l.platform}" onclick="trackAndBuy(${l.id}, '${l.url}')">${getPlatformLabel(l.platform)}</button>`
        ).join('');
      }
      stickyBar.style.display = 'flex';
    }

  } catch (err) {
    console.error('Failed to load product:', err);
  }
}

async function trackAndBuy(linkId, url) {
  try {
    await fetch(`${API}/api/links/${linkId}/click`, { method: 'POST' });
  } catch (e) {}
  window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', loadProduct);
