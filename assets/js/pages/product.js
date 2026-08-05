/**
 * pages/product.js — logic for product.html (FIXED VERSION)
 */

let currentProduct = null;
let activeImageIndex = 0;

// Returns the product handle regardless of which URL shape got us here.
function resolveHandleFromLocation_() {
  const path = window.location.pathname;
  
  // 1. Check clean URL: /collections/{category}/products/{handle} or /products/{handle}
  const cleanMatch = path.match(/\/products\/([^/]+)\/?$/);
  if (cleanMatch) {
    return { handle: decodeURIComponent(cleanMatch[1]), isCleanUrl: true };
  }

  // 2. Check legacy query parameters: ?slug={handle} or ?id={handle}
  const params = new URL(window.location.href).searchParams;
  const legacy = params.get("slug") || params.get("id");
  if (legacy) {
    return { handle: decodeURIComponent(legacy), isCleanUrl: false };
  }

  return { handle: null, isCleanUrl: false };
}

function renderGallery(product) {
  const placeholderImg = "https://via.placeholder.com/600x600?text=No+Image";
  const rawImages = product.images && product.images.length ? product.images : [product.image || ""];
  const images = rawImages.map(img => img ? cdnUrl(img, { width: 800 }) : placeholderImg);

  const thumbsEl = document.getElementById("gallery-thumbs");
  if (thumbsEl) {
    thumbsEl.innerHTML = images.map((img, i) => `
      <div class="gallery-thumb ${i === activeImageIndex ? "active" : ""}" onclick="setActiveImage(${i})">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)} ${i + 1}" onerror="this.src='${placeholderImg}'">
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

async function loadReviews(productId) {
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
}

function applyProductSeo_(product) {
  const s = window.ITZ_SETTINGS || {};
  const site = (s.siteUrl || "").replace(/\/$/, "");
  const url = site + (product.canonicalPath || window.location.pathname);
  const title = product.seoTitle || `${product.name} — ${s.storeName || "INAM TECH ZONE"}`;
  const description = product.seoDescription || (product.description || "").slice(0, 160);
  const image = (product.images && product.images[0]) || product.image || (s.logo || "");
  const price = product.discountPrice || product.price;

  document.title = title;
  setMeta_('meta[name="description"]', description);
  setLink_('link[rel="canonical"]', url);
  setMeta_('meta[property="og:type"]', "product", "property");
  setMeta_('meta[property="og:title"]', title, "property");
  setMeta_('meta[property="og:description"]', description, "property");
  setMeta_('meta[property="og:url"]', url, "property");
  setMeta_('meta[property="og:image"]', product.ogImage || image, "property");
  setMeta_('meta[name="twitter:card"]', "summary_large_image");
  setMeta_('meta[name="twitter:title"]', title);
  setMeta_('meta[name="twitter:description"]', description);
  setMeta_('meta[name="twitter:image"]', product.ogImage || image);
  setMeta_('meta[name="robots"]', product.status === "Disabled" ? "noindex,nofollow" : "index,follow");
}

function setMeta_(selector, content, attr) {
  attr = attr || "name";
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const name = selector.match(/"([^"]+)"/)[1];
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink_(selector, href) {
  let el = document.querySelector(selector);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

async function loadProduct() {
  const { handle, isCleanUrl } = resolveHandleFromLocation_();
  if (!handle) { 
    showNotFound_();
    return; 
  }

  try {
    const product = await apiGet("products.get", { id: handle, slug: handle });
    if (!product || !product.name) {
      showNotFound_();
      return;
    }

    currentProduct = product;
    if (typeof pushRecentlyViewed === "function") pushRecentlyViewed(product.id);

    if (!isCleanUrl && product.canonicalPath && product.canonicalPath.startsWith("/collections/")) {
      window.history.replaceState({}, "", product.canonicalPath);
    }

    applyProductSeo_(product);
    renderGallery(product);

    // Populate Details safely
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
    if (priceEl) priceEl.textContent = formatMoney(hasDiscount ? product.discountPrice : product.price);

    const oldPriceEl = document.getElementById("product-price-old");
    if (oldPriceEl) {
      if (hasDiscount) { oldPriceEl.style.display = "inline"; oldPriceEl.textContent = formatMoney(product.price); }
      else oldPriceEl.style.display = "none";
    }

    const descEl = document.getElementById("product-description");
    if (descEl) descEl.textContent = product.description || "";

    const addCartBtn = document.getElementById("add-cart-btn");
    if (addCartBtn) addCartBtn.disabled = product.stock === 0;

    const buyNowBtn = document.getElementById("buy-now-btn");
    if (buyNowBtn) buyNowBtn.disabled = product.stock === 0;

    loadReviews(product.id);
  } catch (e) {
    showNotFound_();
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

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  const minusBtn = document.getElementById("qty-minus");
  if (minusBtn) minusBtn.addEventListener("click", () => changeQty(-1));

  const plusBtn = document.getElementById("qty-plus");
  if (plusBtn) plusBtn.addEventListener("click", () => changeQty(1));

  const mainGal = document.getElementById("gallery-main");
  if (mainGal) mainGal.addEventListener("click", toggleZoom);

  const addCartBtn = document.getElementById("add-cart-btn");
  if (addCartBtn) {
    addCartBtn.addEventListener("click", () => {
      if (!currentProduct) return;
      const qtyInput = document.getElementById("qty-input");
      const qty = qtyInput ? Number(qtyInput.value) : 1;
      addToCart(currentProduct, qty);
      if (typeof toast === "function") toast(`Added ${qty} × ${currentProduct.name} to cart`, "success");
    });
  }

  const buyNowBtn = document.getElementById("buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", () => {
      if (!currentProduct) return;
      const qtyInput = document.getElementById("qty-input");
      const qty = qtyInput ? Number(qtyInput.value) : 1;
      addToCart(currentProduct, qty);
      window.location.href = "/checkout.html";
    });
  }
});
