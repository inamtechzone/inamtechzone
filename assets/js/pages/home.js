/**
 * pages/home.js — logic for index.html
 */

const CATEGORY_ICONS = ["📱", "🎧", "💻", "⌚", "🏠", "🔌", "📷", "🎮"];

// Helper function to prevent "Cannot set properties of null" crashes
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
  return el;
}

function setDisplay(id, displayValue) {
  const el = document.getElementById(id);
  if (el) el.style.display = displayValue;
  return el;
}

function productCardHtml(p) {
  const inStock = p.stock > 0;
  const wishlisted = typeof isWishlisted === "function" ? isWishlisted(p.id) : false;
  const hasDiscount = p.discountPrice && p.discountPrice < p.price;
  const escapeFn = typeof escapeHtml === "function" ? escapeHtml : (s) => s || "";
  const cdnFn = typeof cdnUrl === "function" ? cdnUrl : (url) => url;
  const formatFn = typeof formatMoney === "function" ? formatMoney : (v) => "$" + v;

  return `
    <a href="/product.html?slug=${encodeURIComponent(p.slug)}" class="product-card">
      ${p.flashSale ? '<span class="ribbon sale">Flash Sale</span>' : p.bestSeller ? '<span class="ribbon">Best Seller</span>' : p.newArrival ? '<span class="ribbon">New</span>' : ""}
      <button class="wishlist-btn ${wishlisted ? "active" : ""}" onclick="event.preventDefault();event.stopPropagation();handleWishlistClick(this,'${p.id}')">${wishlisted ? "♥" : "♡"}</button>
      <div class="product-thumb">
        ${p.images && p.images[0] ? `<img src="${escapeFn(cdnFn(p.images[0], { width: 400 }))}" alt="${escapeFn(p.name)}" loading="lazy">` : '<span style="color:var(--muted);font-size:12px">No image</span>'}
      </div>
      <div class="product-body">
        <span class="stock-badge ${inStock ? "in" : "out"}">${inStock ? "In stock · " + p.stock : "Out of stock"}</span>
        <div class="product-name">${escapeFn(p.name)}</div>
        <div class="spec-strip"><span>${escapeFn(p.category)}</span>${p.brand ? `<span class="dot">•</span><span>${escapeFn(p.brand)}</span>` : ""}</div>
        <div class="price-row">
          <div class="product-price">${formatFn(hasDiscount ? p.discountPrice : p.price)}</div>
          ${hasDiscount ? `<div class="product-price-old">${formatFn(p.price)}</div>` : ""}
        </div>
      </div>
    </a>`;
}

function handleWishlistClick(btn, productId) {
  if (typeof toggleWishlist !== "function") return;
  const active = toggleWishlist(productId);
  btn.classList.toggle("active", active);
  btn.textContent = active ? "♥" : "♡";
  if (typeof toast === "function") toast(active ? "Added to wishlist" : "Removed from wishlist");
}

async function loadHome() {
  const skeleton = typeof skeletonCards === "function" ? skeletonCards : () => "";

  // 1. Initial Skeleton Render with Guard Checks
  setHtml("featured-grid", skeleton(4));
  setHtml("bestseller-grid", skeleton(4));
  setHtml("latest-grid", skeleton(8));
  setHtml("category-grid", skeleton(6));

  try {
    if (typeof apiGet !== "function") return;

    const bundle = await apiGet("home.bundle", { limit: 8 });
    const { categories = [], featured = [], bestSeller: bestSellers = [], latest = [], flashSale: flash = [] } = bundle || {};
    
    if (bundle && bundle.settings && !window.ITZ_SETTINGS) {
      window.ITZ_SETTINGS = bundle.settings;
    }

    // 2. Render Categories
    const escapeFn = typeof escapeHtml === "function" ? escapeHtml : (s) => s || "";
    const categoryHtml = categories.map((c, i) => `
      <a href="/shop.html?category=${encodeURIComponent(c.slug)}" class="category-card">
        ${c.image ? `<img class="cat-thumb" src="${escapeFn(c.image)}" alt="">` : `<div class="icon">${CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</div>`}
        ${escapeFn(c.name)}
      </a>`).join("") || '<p style="color:var(--muted)">No categories yet.</p>';
    setHtml("category-grid", categoryHtml);

    // 3. Render Featured Section
    if (featured.length) {
      setHtml("featured-grid", featured.map(productCardHtml).join(""));
      setDisplay("featured-section", "block");
    } else {
      setDisplay("featured-section", "none");
    }

    // 4. Render Bestsellers Section
    if (bestSellers.length) {
      setHtml("bestseller-grid", bestSellers.map(productCardHtml).join(""));
      setDisplay("bestseller-section", "block");
    } else {
      setDisplay("bestseller-section", "none");
    }

    // 5. Render Flash Sale Section
    setDisplay("flash-sale-band", flash.length ? "block" : "none");

    // 6. Render Latest Section
    const latestHtml = latest.length
      ? latest.map(productCardHtml).join("")
      : '<div class="empty-state"><h3>No products yet</h3><p>Check back soon.</p></div>';
    setHtml("latest-grid", latestHtml);

  } catch (e) {
    if (typeof toastError === "function") toastError(e);
  }
}

function initFaq() {
  if (typeof qsa !== "function") return;
  qsa(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-question");
    if (!q) return;
    q.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      qsa(".faq-item").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadHome();
  initFaq();
});
