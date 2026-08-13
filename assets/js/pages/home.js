/**
 * pages/home.js — logic for index.html (With Instant API LocalStorage Cache)
 */

const CATEGORY_ICONS = ["📱", "🎧", "💻", "⌚", "🏠", "🔌", "📷", "🎮"];
const HOME_CACHE_KEY = "itz_home_bundle_cache";
const HOME_CACHE_TIME_KEY = "itz_home_bundle_time";
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutes Cache Time

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

/**
 * Cache Wrapper Function for home.bundle API
 */
async function getHomeBundleData() {
  const cached = localStorage.getItem(HOME_CACHE_KEY);
  const cacheTime = localStorage.getItem(HOME_CACHE_TIME_KEY);
  const now = Date.now();

  // 1. Return cached data immediately if fresh (< 10 mins)
  if (cached && cacheTime && (now - parseInt(cacheTime, 10) < CACHE_TTL)) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn("Invalid JSON in home cache, fetching fresh...", e);
    }
  }

  // 2. Fetch fresh data from API
  try {
    const bundle = await apiGet("home.bundle", { limit: 8 });
    if (bundle) {
      localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(bundle));
      localStorage.setItem(HOME_CACHE_TIME_KEY, now.toString());
    }
    return bundle;
  } catch (e) {
    // Fallback: Return stale cache if API request fails
    if (cached) {
      console.warn("Network issue: Serving stale home cache as fallback.");
      return JSON.parse(cached);
    }
    throw e;
  }
}

async function loadHome() {
  // Safe element retrieval
  const featuredGrid = document.getElementById("featured-grid");
  const bestsellerGrid = document.getElementById("bestseller-grid");
  const latestGrid = document.getElementById("latest-grid");
  const categoryGrid = document.getElementById("category-grid");

  // Exit gracefully if this page isn't index.html or is missing core grids
  if (!featuredGrid && !bestsellerGrid && !latestGrid && !categoryGrid) return;

  // Check if fresh cache exists to prevent showing Skeleton Cards unnecessarily
  const cached = localStorage.getItem(HOME_CACHE_KEY);
  const cacheTime = localStorage.getItem(HOME_CACHE_TIME_KEY);
  const isCacheValid = cached && cacheTime && (Date.now() - parseInt(cacheTime, 10) < CACHE_TTL);

  // Skeletons tabhi dikhayen jab cache majood na ho
  if (!isCacheValid) {
    if (featuredGrid) featuredGrid.innerHTML = skeletonCards(4);
    if (bestsellerGrid) bestsellerGrid.innerHTML = skeletonCards(4);
    if (latestGrid) latestGrid.innerHTML = skeletonCards(8);
    if (categoryGrid) categoryGrid.innerHTML = skeletonCards(6);
  }

  try {
    const bundle = await getHomeBundleData();
    const { categories = [], featured = [], bestSeller: bestSellers = [], latest = [], flashSale: flash = [] } = bundle;
    if (!window.ITZ_SETTINGS && bundle.settings) window.ITZ_SETTINGS = bundle.settings;

    // Categories
    if (categoryGrid) {
      categoryGrid.innerHTML = categories.map((c, i) => `
        <a href="/shop.html?category=${encodeURIComponent(c.slug)}" class="category-card">
          ${c.image ? `<img class="cat-thumb" src="${escapeHtml(c.image)}" alt="">` : `<div class="icon">${CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</div>`}
          ${escapeHtml(c.name)}
        </a>`).join("") || '<p style="color:var(--muted)">No categories yet.</p>';
    }

    // Featured
    const featuredSection = document.getElementById("featured-section");
    if (featured.length && featuredGrid) {
      featuredGrid.innerHTML = featured.map(productCardHtml).join("");
    } else if (featuredSection) {
      featuredSection.style.display = "none";
    }

    // Bestseller
    const bsSection = document.getElementById("bestseller-section");
    if (bestSellers.length && bestsellerGrid) {
      bestsellerGrid.innerHTML = bestSellers.map(productCardHtml).join("");
    } else if (bsSection) {
      bsSection.style.display = "none";
    }

    // Flash sale
    const flashSection = document.getElementById("flash-sale-band");
    if (flashSection) {
      flashSection.style.display = flash.length ? "block" : "none";
    }

    // Latest
    if (latestGrid) {
      latestGrid.innerHTML = latest.length
        ? latest.map(productCardHtml).join("")
        : '<div class="empty-state"><h3>No products yet</h3><p>Check back soon.</p></div>';
    }
  } catch (e) {
    toastError(e);
  }
}

function initFaq() {
  qsa(".faq-item").forEach((item) => {
    item.querySelector(".faq-question")?.addEventListener("click", () => {
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