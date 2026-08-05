/**
 * pages/collections.js — Complete Category & Collections Logic
 */

// Helper: Fix Google Drive links on client side
function fixImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.includes("drive.google.com") || trimmed.includes("googleusercontent.com")) {
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return trimmed;
}

// Helper: Format Currency
function formatCurrency(amount) {
  const currency = window.APP_CURRENCY || "Rs.";
  return `${currency} ${(Number(amount) || 0).toLocaleString()}`;
}

// Global Collections State
const collectionState = {
  allProducts: [],
  filteredProducts: [],
  currentCategory: "",
  searchQuery: "",
  sortBy: "default",
  page: 1,
  limit: 12,
};

// Render Product Card Component
function renderCollectionCard(product) {
  const mainImage = Array.isArray(product.images) && product.images.length > 0 
    ? fixImageUrl(product.images[0]) 
    : fixImageUrl(product.ogImage);

  const finalImg = mainImage || "https://via.placeholder.com/300x300?text=No+Image";
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const currentPrice = hasDiscount ? product.discountPrice : product.price;
  const productUrl = product.canonicalPath || `/product.html?slug=${product.slug || product.id}`;

  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card-image">
        <a href="${productUrl}">
          <img 
            src="${finalImg}" 
            alt="${product.name}" 
            loading="lazy" 
            referrerpolicy="no-referrer"
            onerror="this.onerror=null; this.src='https://via.placeholder.com/300x300?text=Image+Error';"
          />
        </a>
        ${hasDiscount ? `<span class="badge-discount">Sale</span>` : ""}
      </div>
      <div class="product-card-content">
        <span class="product-category">${product.category || "General"}</span>
        <h3 class="product-title">
          <a href="${productUrl}">${product.name}</a>
        </h3>
        <div class="product-price-box">
          <span class="price-current">${formatCurrency(currentPrice)}</span>
          ${hasDiscount ? `<span class="price-old">${formatCurrency(product.price)}</span>` : ""}
        </div>
        <button 
          class="btn-add-cart" 
          onclick="handleQuickAddToCart('${product.id}')"
          ${product.stock <= 0 ? "disabled" : ""}
        >
          ${product.stock > 0 ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
    </div>
  `;
}

// Apply Filters & Sorting
function applyFiltersAndSort() {
  let list = [...collectionState.allProducts];

  // 1. Search Query Filter
  if (collectionState.searchQuery) {
    const q = collectionState.searchQuery.toLowerCase();
    list = list.filter((p) => 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }

  // 2. Sorting Logic
  switch (collectionState.sortBy) {
    case "price-low":
      list.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
      break;
    case "price-high":
      list.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "newest":
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    default:
      break;
  }

  collectionState.filteredProducts = list;
  renderCollectionsGrid();
}

// Render Products Grid & Meta Controls
function renderCollectionsGrid() {
  const gridContainer = document.getElementById("collections-grid");
  const countElement = document.getElementById("products-count");

  if (countElement) {
    countElement.textContent = `${collectionState.filteredProducts.length} Product(s) Found`;
  }

  if (!gridContainer) return;

  if (collectionState.filteredProducts.length === 0) {
    gridContainer.innerHTML = `
      <div class="no-products-found" style="grid-column: 1 / -1; text-align: center; padding: 40px 0;">
        <h3>No Products Found</h3>
        <p>Try clearing filters or searching for something else.</p>
      </div>
    `;
    return;
  }

  gridContainer.innerHTML = collectionState.filteredProducts.map(renderCollectionCard).join("");
}

// Populate Categories Sidebar
function renderCategoryList(categories) {
  const categoryContainer = document.getElementById("categories-sidebar");
  if (!categoryContainer || !Array.isArray(categories)) return;

  const html = `
    <ul class="category-list">
      <li class="${!collectionState.currentCategory ? "active" : ""}">
        <a href="/collections.html">All Categories</a>
      </li>
      ${categories.map((cat) => `
        <li class="${collectionState.currentCategory === cat.slug ? "active" : ""}">
          <a href="/collections.html?category=${cat.slug}">${cat.name}</a>
        </li>
      `).join("")}
    </ul>
  `;
  categoryContainer.innerHTML = html;
}

// Load Collection Data from API
async function initCollectionsPage() {
  const params = new URLSearchParams(window.location.search);
  collectionState.currentCategory = params.get("category") || "";
  collectionState.searchQuery = params.get("q") || "";

  // Title Update
  const pageTitle = document.getElementById("collection-page-title");
  if (pageTitle) {
    pageTitle.textContent = collectionState.currentCategory 
      ? collectionState.currentCategory.replace(/-/g, " ").toUpperCase()
      : (collectionState.searchQuery ? `Search Results for "${collectionState.searchQuery}"` : "All Products");
  }

  try {
    if (typeof apiGet !== "function") return;

    // Fetch Products
    const queryParams = { limit: 100 };
    if (collectionState.currentCategory) {
      queryParams.category = collectionState.currentCategory;
    }

    const response = await apiGet("products.list", queryParams);
    const resData = response.data || response;

    collectionState.allProducts = resData.items || resData || [];

    // Render Categories Sidebar if available in payload
    if (resData.categories) {
      renderCategoryList(resData.categories);
    }

    // Bind Sorting Selector Event
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        collectionState.sortBy = e.target.value;
        applyFiltersAndSort();
      };
    }

    // Apply initial filters & render
    applyFiltersAndSort();

  } catch (error) {
    console.error("Failed to load collections:", error);
  }
}

// Document Ready Event
document.addEventListener("DOMContentLoaded", () => {
  initCollectionsPage();
});
