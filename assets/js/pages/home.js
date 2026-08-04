/**
 * pages/home.js — Complete Homepage Renderer
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

// Product Card HTML Generator
function createProductCard(product) {
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

// Load Featured & Recent Products
async function loadHomeProducts() {
  const featuredContainer = document.getElementById("featured-products-grid");
  const recentContainer = document.getElementById("recent-products-grid");

  try {
    if (typeof apiGet !== "function") return;

    const response = await apiGet("products.list", { limit: 20 });
    const resData = response.data || response;
    const products = resData.items || resData || [];

    // 1. Render Featured Products
    if (featuredContainer) {
      const featured = products.filter((p) => p.featured);
      const displayFeatured = featured.length > 0 ? featured : products.slice(0, 8);
      
      featuredContainer.innerHTML = displayFeatured.length > 0
        ? displayFeatured.map(createProductCard).join("")
        : `<p class="no-data">No featured products found.</p>`;
    }

    // 2. Render All / Recent Products
    if (recentContainer) {
      recentContainer.innerHTML = products.length > 0
        ? products.map(createProductCard).join("")
        : `<p class="no-data">No products available.</p>`;
    }

  } catch (err) {
    console.error("Error loading home products:", err);
  }
}

// Global Quick Add to Cart Handler
window.handleQuickAddToCart = function(productId) {
  if (typeof addToCart === "function") {
    addToCart(productId, 1);
  } else if (typeof toast === "function") {
    toast("Added to cart!");
  }
};

// Initialize Page
document.addEventListener("DOMContentLoaded", () => {
  loadHomeProducts();
});
