/**
 * pages/product.js — Optimized & Fast Loading Version
 */

let currentProduct = null;
let activeImageIndex = 0;

function resolveHandleFromLocation_() {
  const path = window.location.pathname;
  const cleanMatch = path.match(/\/products\/([^/]+)\/?$/);
  if (cleanMatch) return { handle: decodeURIComponent(cleanMatch[1]), isCleanUrl: true };

  const legacy = new URL(window.location.href).searchParams.get("slug") || new URL(window.location.href).searchParams.get("id");
  return { handle: legacy ? decodeURIComponent(legacy) : null, isCleanUrl: false };
}

// Optimized Gallery: Native Lazy Loading Added
function renderGallery(product) {
  const placeholderImg = "https://via.placeholder.com/600x600?text=No+Image";
  const rawImages = product.images && product.images.length ? product.images : [product.image || ""];
  const images = rawImages.map(img => img ? cdnUrl(img, { width: 600 }) : placeholderImg);

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

// Background Task: Non-blocking Reviews Fetch
function loadReviewsAsync(productId) {
  setTimeout(async () => {
    try {
      const data = await apiGet("reviews.list", { productId: productId });
      const summaryEl = document.getElementById("review-summary");
      if (summaryEl) {
        summaryEl.innerHTML = data.count
          ? `<span class="rating-stars">${"★".repeat(Math.round(data.average))}${"☆".repeat(5 - Math.round(data.average))}</span> ${data.average} out of 5 (${data.count} review${data.count > 1 ? "s" : ""})`
          : "No reviews yet — be the first!";
      }
      const listEl = document.getElementById("review-list");
      if (listEl) {
        listEl.innerHTML = (data.reviews || []).map((r) => `
          <div class="review-card">
            <div class="name">${escapeHtml(r.customerName)}</div>
            <div class="rating-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
            <p style="color:var(--muted);font-size:13.5px;margin:6px 0 0">${escapeHtml(r.comment || "")}</p>
          </div>`).join("");
      }
    } catch (e) { /* non-fatal */ }
  }, 100);
}

// Core Execution Path
async function loadProduct() {
  const { handle, isCleanUrl } = resolveHandleFromLocation_();
  if (!handle) { showNotFound_(); return; }

  try {
    // Single Fast Fetch for Critical Content
    const product = await apiGet("products.get", { id: handle, slug: handle });
    if (!product || !product.name) { showNotFound_(); return; }

    currentProduct = product;

    if (!isCleanUrl && product.canonicalPath && product.canonicalPath.startsWith("/collections/")) {
      window.history.replaceState({}, "", product.canonicalPath);
    }

    // Render UI immediately
    renderGallery(product);
    
    document.getElementById("product-name").textContent = product.name;
    document.getElementById("product-sku").textContent = "SKU " + (product.sku || "N/A");
    document.getElementById("product-category").textContent = product.category || "General";

    const hasDiscount = product.discountPrice && product.discountPrice < product.price;
    document.getElementById("product-price").textContent = formatMoney(hasDiscount ? product.discountPrice : product.price);

    const oldPriceEl = document.getElementById("product-price-old");
    if (oldPriceEl) {
      if (hasDiscount) { oldPriceEl.style.display = "inline"; oldPriceEl.textContent = formatMoney(product.price); }
      else oldPriceEl.style.display = "none";
    }

    document.getElementById("product-description").textContent = product.description || "";

    const addBtn = document.getElementById("add-cart-btn");
    const buyBtn = document.getElementById("buy-now-btn");
    if (addBtn) addBtn.disabled = product.stock === 0;
    if (buyBtn) buyBtn.disabled = product.stock === 0;

    // Load non-critical data lazily without blocking render
    requestAnimationFrame(() => {
      if (typeof pushRecentlyViewed === "function") pushRecentlyViewed(product.id);
      loadReviewsAsync(product.id);
    });

  } catch (e) {
    showNotFound_();
  }
}

function showNotFound_() {
  const root = document.getElementById("product-root");
  if (root) {
    root.innerHTML = `<div class="empty-state" style="text-align:center;padding:40px 10px;">
      <h3>Product not found</h3>
      <a href="/shop.html" class="btn btn-primary" style="margin-top:16px;">Back to shop</a>
    </div>`;
  }
}

// Fast DOM Init
document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  document.getElementById("add-cart-btn")?.addEventListener("click", () => {
    if (!currentProduct) return;
    const qty = Number(document.getElementById("qty-input")?.value || 1);
    addToCart(currentProduct, qty);
    if (typeof toast === "function") toast(`Added ${qty} × ${currentProduct.name} to cart`, "success");
  });

  document.getElementById("buy-now-btn")?.addEventListener("click", () => {
    if (!currentProduct) return;
    const qty = Number(document.getElementById("qty-input")?.value || 1);
    addToCart(currentProduct, qty);
    window.location.href = "/checkout.html";
  });
});
