/**
 * pages/product.js — Complete Single Product Page Logic
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

// Helper: Currency Formatter
function formatCurrency(amount) {
  const currency = window.APP_CURRENCY || "Rs.";
  return `${currency} ${(Number(amount) || 0).toLocaleString()}`;
}

// Global Image Gallery Switcher
window.selectGalleryImage = function(element, imageUrl) {
  const mainImg = document.getElementById("main-product-img");
  if (mainImg) {
    mainImg.src = imageUrl;
  }
  
  document.querySelectorAll(".thumb-item").forEach((el) => el.classList.remove("active"));
  if (element) {
    element.classList.add("active");
  }
};

// Render Full Product View
function renderProductDetails(product) {
  if (!product) return;

  // 1. Text Fields
  const titleEl = document.getElementById("product-title");
  const skuEl = document.getElementById("product-sku");
  const catEl = document.getElementById("product-category");
  const descEl = document.getElementById("product-description");

  if (titleEl) titleEl.textContent = product.name || "";
  if (skuEl) skuEl.textContent = product.sku ? `SKU: ${product.sku}` : "";
  if (catEl) catEl.textContent = product.category || "General";
  if (descEl) descEl.textContent = product.description || "No description available.";

  // 2. Pricing & Stock Status
  const priceEl = document.getElementById("product-price");
  const oldPriceEl = document.getElementById("product-old-price");
  const stockEl = document.getElementById("stock-badge");

  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const currentPrice = hasDiscount ? product.discountPrice : product.price;

  if (priceEl) priceEl.textContent = formatCurrency(currentPrice);
  if (oldPriceEl) {
    oldPriceEl.textContent = hasDiscount ? formatCurrency(product.price) : "";
    oldPriceEl.style.display = hasDiscount ? "inline-block" : "none";
  }

  if (stockEl) {
    const inStock = product.stock > 0;
    stockEl.textContent = inStock ? `In Stock (${product.stock})` : "Out of Stock";
    stockEl.className = `stock-badge ${inStock ? "in-stock" : "out-of-stock"}`;
  }

  // 3. Image Gallery Processing
  const rawImages = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : [product.ogImage].filter(Boolean);

  const images = rawImages.map(fixImageUrl).filter(Boolean);

  const mainBox = document.getElementById("main-image-container");
  if (mainBox) {
    if (images.length > 0) {
      mainBox.innerHTML = `
        <img 
          id="main-product-img" 
          src="${images[0]}" 
          alt="${product.name}" 
          loading="eager" 
          referrerpolicy="no-referrer"
          onerror="this.onerror=null; this.src='https://via.placeholder.com/600x600?text=Image+Error';"
        />`;
    } else {
      mainBox.innerHTML = `<div class="no-image">No Image Available</div>`;
    }
  }

  const thumbsBox = document.getElementById("gallery-thumbnails");
  if (thumbsBox) {
    if (images.length > 1) {
      thumbsBox.innerHTML = images.map((imgUrl, index) => `
        <div class="thumb-item ${index === 0 ? "active" : ""}" onclick="selectGalleryImage(this, '${imgUrl}')">
          <img 
            src="${imgUrl}" 
            alt="Thumbnail ${index + 1}" 
            referrerpolicy="no-referrer"
            onerror="this.onerror=null; this.src='https://via.placeholder.com/100x100?text=NA';"
          />
        </div>
      `).join("");
      thumbsBox.style.display = "flex";
    } else {
      thumbsBox.innerHTML = "";
      thumbsBox.style.display = "none";
    }
  }

  // 4. Specifications Table
  const specsBox = document.getElementById("product-specifications");
  if (specsBox && Array.isArray(product.specifications) && product.specifications.length > 0) {
    specsBox.innerHTML = `
      <table class="specs-table">
        ${product.specifications.map((s) => `
          <tr>
            <th>${s.key || s.name || ""}</th>
            <td>${s.value || ""}</td>
          </tr>
        `).join("")}
      </table>
    `;
  }

  // 5. Action Buttons Setup
  const addToCartBtn = document.getElementById("btn-add-to-cart");
  if (addToCartBtn) {
    addToCartBtn.disabled = product.stock <= 0;
    addToCartBtn.onclick = () => {
      const qtyInput = document.getElementById("quantity-input");
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value) || 1) : 1;
      if (typeof addToCart === "function") {
        addToCart(product, qty);
      } else if (typeof toast === "function") {
        toast(`Added ${qty} item(s) to cart`);
      }
    };
  }
}

// Load Product Detail Page
async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const identifier = params.get("slug") || params.get("id");

  if (!identifier) {
    const container = document.getElementById("product-container");
    if (container) container.innerHTML = `<div class="error-msg">Product link is invalid.</div>`;
    return;
  }

  try {
    if (typeof apiGet !== "function") return;

    const res = await apiGet("products.get", { id: identifier });
    const product = res && res.data ? res.data : res;

    if (!product || !product.id) {
      const container = document.getElementById("product-container");
      if (container) container.innerHTML = `<div class="error-msg">Product not found.</div>`;
      return;
    }

    renderProductDetails(product);

  } catch (err) {
    console.error("Error loading product detail:", err);
  }
}

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
  initProductPage();
});
