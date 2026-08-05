/**
 * pages/product.js — Ultra-Fast Instant Render & Optimized Version
 */

let currentProduct = null;
let activeImageIndex = 0;

// URL Parsing (Supports Clean Paths & Search Params)
function resolveHandleFromLocation_() {
  const path = window.location.pathname;
  
  // Clean URL Path: /collections/.../products/{handle} or /products/{handle}
  const cleanMatch = path.match(/\/products\/([^/]+)\/?$/);
  if (cleanMatch) return { handle: decodeURIComponent(cleanMatch[1]), isCleanUrl: true };

  // Legacy Parameters: ?slug={handle} or ?id={handle}
  const params = new URLSearchParams(window.location.search);
  const legacy = params.get("slug") || params.get("id");
  if (legacy) return { handle: decodeURIComponent(legacy), isCleanUrl: false };

  return { handle: null, isCleanUrl: false };
}

// Fast Responsive Gallery Renderer
function renderGallery(product) {
  const placeholderImg = "https://via.placeholder.com/600x600?text=No+Image";
  const rawImages = product.images && product.images.length ? product.images : [product.image || ""];
  const images = rawImages.map(img => img ? (typeof cdnUrl === "function" ? cdnUrl(img, { width: 600 }) : img) : placeholderImg);

  const thumbsEl = document.getElementById("gallery-thumbs");
  if (thumbsEl) {
    thumbsEl.innerHTML = images.map((img, i) => `
      <div class="gallery-thumb ${i === activeImageIndex ? "active" : ""}" onclick="setActiveImage(${i})">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)} ${i + 1}" loading="lazy" onerror="this.src='${placeholderImg}'">
      </div>`).join("");
  }

  const mainImg = document.getElementById("gallery-main-img");
  if (mainImg) {
    mainImg.src = images[activeImageIndex] || placeholderImg;
    mainImg.onerror = function() { this.src = placeholderImg; };
  }
}

function setActiveImage(i) {
  activeImageIndex = i;
  if (currentProduct) renderGallery(currentProduct);
}

function toggleZoom() {
  const gallery = document.getElementById("gallery-main");
  if (gallery) gallery.classList.toggle("zoomed");
}

function changeQty(delta) {
  const input = document.getElementById("qty-input");
  if (!input || !currentProduct) return;
  const next = Math.max(1, Math.min((currentProduct.stock || 99), Number(input.value) + delta));
  input.value = next;
}

// Render DOM UI instantly
function renderUI(product) {
  currentProduct = product;

  renderGallery(product);

  const stockEl = document.getElementById("product-stock");
  if (stockEl) {
    stockEl.outerHTML = `<span id="product-stock" class="stock-badge ${product.stock > 0 ? "in" : "out"}">${product.stock > 0 ? "In stock · " + product.stock + " available" : "Out of stock"}</span>`;
  }

  const nameEl = document.getElementById("product-name");
  if (nameEl) nameEl.textContent = product.name;

  const skuEl = document.getElementById("product-sku");
  if (skuEl) skuEl.textContent = "SKU " + (product.sku || "N/A");

  const catEl = document.getElementById("product-category");
  if (catEl) catEl.textContent = product.category || "General";

  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const priceEl = document.getElementById("product-price");
  if (priceEl && typeof formatMoney === "function") {
    priceEl.textContent = formatMoney(hasDiscount ? product.discountPrice : product.price);
  }

  const oldPriceEl = document.getElementById("product-price-old");
  if (oldPriceEl && typeof formatMoney === "function") {
    if (hasDiscount) { oldPriceEl.style.display = "inline"; oldPriceEl.textContent = formatMoney(product.price); }
    else oldPriceEl.style.display = "none";
  }

  const descEl = document.getElementById("product-description");
  if (descEl) descEl.textContent = product.description || "";

  const addBtn = document.getElementById("add-cart-btn");
  if (addBtn) addBtn.disabled = product.stock === 0;

  const buyBtn = document.getElementById("buy-now-btn");
  if (buyBtn) buyBtn.disabled = product.stock === 0;
}

// Async Background Fetching for Non-Critical Content
function loadNonCriticalData(product) {
  requestAnimationFrame(async () => {
    if (typeof pushRecentlyViewed === "function") pushRecentlyViewed(product.id);
    if (typeof applyProductSeo_ === "function") applyProductSeo_(product);

    // Async Reviews
    if (typeof apiGet === "function") {
      try {
        const data = await apiGet("reviews.list", { productId: product.id });
        const summaryEl = document.getElementById("review-summary");
        if (summaryEl) {
          summaryEl.innerHTML = data.count
            ? `<span class="rating-stars">${"★".repeat(Math.round(data.average))}${"☆".repeat(5 - Math.round(data.average))}</span> ${data.average} out of 5 (${data.count} review${data.count > 1 ? "s" : ""})`
            : "No reviews yet — be the first!";
        }
      } catch (e) { /* non-fatal */ }
    }
  });
}

// Primary Data Loader with Session Caching (0ms Delay)
async function loadProduct() {
  const { handle, isCleanUrl } = resolveHandleFromLocation_();
  if (!handle) { showNotFound_(); return; }

  // Step 1: Check Local Cache for Immediate Display
  const cacheKey = `itz_product_${handle}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      renderUI(parsed);
      loadNonCriticalData(parsed);
    } catch (e) {}
  }

  // Step 2: Fetch Fresh Product Data from API
  try {
    const product = await apiGet("products.get", { id: handle, slug: handle });
    if (!product || !product.name) {
      if (!cachedData) showNotFound_();
      return;
    }

    // Rewrite Canonical URL path cleanly without page reload
    if (!isCleanUrl && product.canonicalPath && product.canonicalPath.startsWith("/collections/")) {
      window.history.replaceState({}, "", product.canonicalPath);
    }

    // Save Fresh Cache & Render
    sessionStorage.setItem(cacheKey, JSON.stringify(product));
    renderUI(product);
    loadNonCriticalData(product);

  } catch (e) {
    if (!cachedData) showNotFound_();
  }
}

function showNotFound_() {
  const root = document.getElementById("product-root");
  if (root) {
    root.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px 10px;">
      <h3>Product not found</h3>
      <p style="color:var(--muted);margin-top:8px;">The product you are looking for might have been moved or updated.</p>
      <a href="/shop.html" class="btn btn-primary" style="margin-top:16px;">Back to shop</a>
    </div>`;
  }
}

// Initializing DOM Operations
document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  document.getElementById("qty-minus")?.addEventListener("click", () => changeQty(-1));
  document.getElementById("qty-plus")?.addEventListener("click", () => changeQty(1));
  document.getElementById("gallery-main")?.addEventListener("click", toggleZoom);

  document.getElementById("add-cart-btn")?.addEventListener("click", () => {
    if (!currentProduct) return;
    const qty = Number(document.getElementById("qty-input")?.value || 1);
    if (typeof addToCart === "function") addToCart(currentProduct, qty);
    if (typeof toast === "function") toast(`Added ${qty} × ${currentProduct.name} to cart`, "success");
  });

  document.getElementById("buy-now-btn")?.addEventListener("click", () => {
    if (!currentProduct) return;
    const qty = Number(document.getElementById("qty-input")?.value || 1);
    if (typeof addToCart === "function") addToCart(currentProduct, qty);
    window.location.href = "/checkout.html";
  });
});
