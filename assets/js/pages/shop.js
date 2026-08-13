/**
 * pages/shop.js — logic for shop.html (Category & Brand Chips Removed)
 */

let currentPage = 1;

// Helper to safely get DOM elements
function getEl(id) {
  return document.getElementById(id);
}

// Inline SVG Fallback for broken/missing images
const NO_IMAGE_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'><rect width='100%' height='100%' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='16' font-family='sans-serif'>No Image Available</text></svg>";

// Image URL Resolver Function
function resolveImageUrl(p) {
  if (!p) return NO_IMAGE_SVG;

  let img = p.image || p.thumbnail || p.img || p.image_url || p.photo;

  if (!img && Array.isArray(p.images) && p.images.length > 0) {
    img = p.images[0];
  }

  if (img && typeof img === "object") {
    img = img.url || img.src || "";
  }

  if (typeof img !== "string" || !img.trim()) {
    return NO_IMAGE_SVG;
  }

  img = img.trim();

  if (typeof imgCdn === "function") {
    return imgCdn(img);
  }

  if (!img.startsWith("http://") && !img.startsWith("https://") && !img.startsWith("data:")) {
    if (img.startsWith("//")) return `https:${img}`;
    const apiBase = (typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "").replace(/\/api\/?$/, "");
    return apiBase ? `${apiBase}/${img.replace(/^\//, "")}` : img;
  }

  return img;
}

function readParams() {
  const url = new URL(window.location.href);
  const pathMatch = window.location.pathname.match(/^\/collections\/([^/]+)\/?$/);
  return {
    search: url.searchParams.get("search") || "",
    category: (pathMatch ? decodeURIComponent(pathMatch[1]) : url.searchParams.get("category")) || "",
    brand: url.searchParams.get("brand") || "",
    featured: url.searchParams.get("featured") || "",
    bestSeller: url.searchParams.get("bestSeller") || "",
    newArrival: url.searchParams.get("newArrival") || "",
    flashSale: url.searchParams.get("flashSale") || "",
    sort: url.searchParams.get("sort") || "newest",
    page: Number(url.searchParams.get("page")) || 1,
  };
}

function setParam(key, value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  url.searchParams.delete("page");
  window.history.pushState({}, "", url);
  loadShop();
}

async function loadShop() {
  const params = readParams();

  const shopGrid = getEl("shop-grid");
  if (shopGrid) {
    shopGrid.innerHTML = typeof skeletonCards === "function" ? skeletonCards(8) : '<div style="grid-column:1/-1; text-align:center; padding:40px;">Loading products...</div>';
  }

  const minPriceEl = getEl("min-price");
  const maxPriceEl = getEl("max-price");
  const sortSelectEl = getEl("sort-select");
  const inStockCheck = getEl("in-stock-check");

  if (minPriceEl) minPriceEl.value = params.minPrice || "";
  if (maxPriceEl) maxPriceEl.value = params.maxPrice || "";
  if (sortSelectEl) sortSelectEl.value = params.sort;

  try {
    if (typeof apiGet !== "function") {
      throw new Error("apiGet function is missing.");
    }

    const requestParams = Object.assign({}, params, {
      minPrice: minPriceEl ? minPriceEl.value : "",
      maxPrice: maxPriceEl ? maxPriceEl.value : "",
      inStock: inStockCheck && inStockCheck.checked ? "true" : "",
      limit: 12,
    });

    const data = await apiGet("products.list", requestParams);

    const items = Array.isArray(data) ? data : (data.items || data.products || []);
    const totalCount = data.total !== undefined ? data.total : items.length;

    // 1. Result Count Update
    const resultCountEl = getEl("result-count");
    if (resultCountEl) {
      resultCountEl.textContent = totalCount + " products";
    }

    // 2. Hide / Remove Category & Brand Chips
    const categoryChipsEl = getEl("category-chips");
    if (categoryChipsEl) {
      categoryChipsEl.style.display = "none";
      categoryChipsEl.innerHTML = "";
    }

    const brandChipsEl = getEl("brand-chips");
    if (brandChipsEl) {
      brandChipsEl.style.display = "none";
      brandChipsEl.innerHTML = "";
    }

    // 3. Products Render
    if (shopGrid) {
      if (items.length > 0) {
        const renderCard = typeof productCardHtml === "function" ? productCardHtml : defaultProductCardHtml;
        shopGrid.innerHTML = items.map(renderCard).join("");
      } else {
        shopGrid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:50px;">
            <h3>No products match your filters</h3>
            <p>Try clearing a filter or searching a different term.</p>
          </div>`;
      }
    }

    // 4. Pagination Render
    const paginationEl = getEl("pagination");
    if (paginationEl && typeof paginationHtml === "function") {
      paginationEl.innerHTML = paginationHtml(data.page || 1, data.pages || 1, 'onclick="setParam(\'page\',this.dataset.page)"');
    }
  } catch (e) {
    console.error("Shop page load error:", e);
    if (typeof toastError === "function") {
      toastError(e);
    } else if (shopGrid) {
      shopGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red; padding:40px;">Failed to load products.</div>`;
    }
  }
}

// Fallback Product Card rendering
function defaultProductCardHtml(p) {
  const sanitize = typeof escapeHtml === "function" ? escapeHtml : (str) => str || "";
  const name = sanitize(p.name || "Product");
  const price = p.price ? `$${p.price}` : "";
  const imgUrl = resolveImageUrl(p);

  return `
    <div class="card product-card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%;">
      <div style="text-align:center; margin-bottom:12px; height:180px; display:flex; align-items:center; justify-content:center; background:var(--bg-hover, #f8fafc); border-radius:8px; overflow:hidden;">
        <img src="${imgUrl}" 
             alt="${name}" 
             style="max-width:100%; max-height:100%; object-fit:contain;" 
             onerror="this.onerror=null; this.src='${NO_IMAGE_SVG}';" 
             loading="lazy">
      </div>
      <h3 style="font-size:15px; margin-bottom:8px; flex-grow:1; color:var(--text-main);">${name}</h3>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <span style="font-weight:700; font-size:16px; color:var(--accent, #2563eb);">${price}</span>
        <a href="/product.html?id=${p.id}" class="btn btn-sm btn-primary">View</a>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const params = readParams();
  const searchTitleEl = getEl("search-title");
  if (searchTitleEl) {
    searchTitleEl.textContent = params.search ? `Search results for "${params.search}"` : "Shop";
  }

  loadShop();

  const applyBtn = getEl("apply-filters-btn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => loadShop());
  }

  const sortSelect = getEl("sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => setParam("sort", e.target.value));
  }
});
