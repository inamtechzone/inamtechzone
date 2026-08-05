/**
 * pages/home.js — logic for index.html
 */

const CATEGORY_ICONS = ["📱", "🎧", "💻", "⌚", "🏠", "🔌", "📷", "🎮"];

function productCardHtml(p) {
  const inStock = p.stock > 0;
  const wishlisted = isWishlisted(p.id);
  const hasDiscount = p.discountPrice && p.discountPrice < p.price;
  return `
    <a href="/product.html?slug=${encodeURIComponent(p.slug)}" class="product-card">
      ${p.flashSale ? '<span class="ribbon sale">Flash Sale</span>' : p.bestSeller ? '<span class="ribbon">Best Seller</span>' : p.newArrival ? '<span class="ribbon">New</span>' : ""}
      <button class="wishlist-btn ${wishlisted ? "active" : ""}" onclick="event.preventDefault();event.stopPropagation();handleWishlistClick(this,'${p.id}')">${wishlisted ? "♥" : "♡"}</button>
      <div class="product-thumb">
        ${p.images && p.images[0] ? `<img src="${escapeHtml(cdnUrl(p.images[0], { width: 400 }))}" alt="${escapeHtml(p.name)}" loading="lazy">` : '<span style="color:var(--muted);font-size:12px">No image</span>'}
      </div>
      <div class="product-body">
        <span class="stock-badge ${inStock ? "in" : "out"}">${inStock ? "In stock · " + p.stock : "Out of stock"}</span>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="spec-strip"><span>${escapeHtml(p.category)}</span>${p.brand ? `<span class="dot">•</span><span>${escapeHtml(p.brand)}</span>` : ""}</div>
        <div class="price-row">
          <div class="product-price">${formatMoney(hasDiscount ? p.discountPrice : p.price)}</div>
          ${hasDiscount ? `<div class="product-price-old">${formatMoney(p.price)}</div>` : ""}
        </div>
      </div>
    </a>`;
}

function handleWishlistClick(btn, productId) {
  const active = toggleWishlist(productId);
  btn.classList.toggle("active", active);
  btn.textContent = active ? "♥" : "♡";
  toast(active ? "Added to wishlist" : "Removed from wishlist");
}

async function loadHome() {
  document.getElementById("featured-grid").innerHTML = skeletonCards(4);
  document.getElementById("bestseller-grid").innerHTML = skeletonCards(4);
  document.getElementById("latest-grid").innerHTML = skeletonCards(8);
  document.getElementById("category-grid").innerHTML = skeletonCards(6);

  try {
    // Single request instead of 5 separate ones (settings/categories/featured/
    // bestSeller/latest/flashSale) — see Home.gs for why this matters for speed.
    const bundle = await apiGet("home.bundle", { limit: 8 });
    const { categories, featured, bestSeller: bestSellers, latest, flashSale: flash } = bundle;
    if (!window.ITZ_SETTINGS) window.ITZ_SETTINGS = bundle.settings;

    document.getElementById("category-grid").innerHTML = categories.map((c, i) => `
      <a href="/shop.html?category=${encodeURIComponent(c.slug)}" class="category-card">
        ${c.image ? `<img class="cat-thumb" src="${escapeHtml(c.image)}" alt="">` : `<div class="icon">${CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</div>`}
        ${escapeHtml(c.name)}
      </a>`).join("") || '<p style="color:var(--muted)">No categories yet.</p>';

    const featuredSection = document.getElementById("featured-section");
    if (featured.length) {
      document.getElementById("featured-grid").innerHTML = featured.map(productCardHtml).join("");
    } else featuredSection.style.display = "none";

    const bsSection = document.getElementById("bestseller-section");
    if (bestSellers.length) {
      document.getElementById("bestseller-grid").innerHTML = bestSellers.map(productCardHtml).join("");
    } else bsSection.style.display = "none";

    const flashSection = document.getElementById("flash-sale-band");
    if (flash.length) flashSection.style.display = "block"; else flashSection.style.display = "none";

    document.getElementById("latest-grid").innerHTML = latest.length
      ? latest.map(productCardHtml).join("")
      : '<div class="empty-state"><h3>No products yet</h3><p>Check back soon.</p></div>';
  } catch (e) {
    toastError(e);
  }
}

function initFaq() {
  qsa(".faq-item").forEach((item) => {
    item.querySelector(".faq-question").addEventListener("click", () => {
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
