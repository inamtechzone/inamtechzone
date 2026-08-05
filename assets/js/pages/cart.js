/**
 * js/cart.js — Complete Cart & State Management Utility
 */

const CART_STORAGE_KEY = "itz_shopping_cart";

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

/**
 * Cart Storage Operations
 */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading cart from localStorage:", e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
    renderCartDrawer();
  } catch (e) {
    console.error("Error saving cart to localStorage:", e);
  }
}

/**
 * Add Item to Cart
 */
function addToCart(productOrId, quantity = 1) {
  const qty = Math.max(1, parseInt(quantity) || 1);
  let cart = getCart();

  // Handle case where argument is just an ID vs full product object
  let product = typeof productOrId === "object" ? productOrId : { id: productOrId };

  const existingIndex = cart.findIndex((item) => item.id === product.id);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += qty;
  } else {
    const rawImg = Array.isArray(product.images) && product.images.length > 0 
      ? product.images[0] 
      : (product.ogImage || "");

    const finalPrice = product.discountPrice && product.discountPrice < product.price 
      ? product.discountPrice 
      : (product.price || 0);

    cart.push({
      id: product.id,
      name: product.name || "Product",
      price: Number(finalPrice),
      originalPrice: Number(product.price || finalPrice),
      image: fixImageUrl(rawImg),
      slug: product.slug || product.handle || product.id,
      sku: product.sku || "",
      quantity: qty,
    });
  }

  saveCart(cart);

  if (typeof toast === "function") {
    toast(`Added ${qty} item(s) to cart`);
  }
}

/**
 * Update Quantity of Existing Item
 */
function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  const index = cart.findIndex((item) => item.id === productId);

  if (index > -1) {
    const newQty = parseInt(quantity);
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQty;
    }
    saveCart(cart);
  }
}

/**
 * Remove Item Completely
 */
function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
}

/**
 * Clear Entire Cart
 */
function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  updateCartBadge();
  renderCartDrawer();
}

/**
 * Update Cart Badge Count in Header
 */
function updateCartBadge() {
  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  const badges = document.querySelectorAll(".cart-badge-count");
  badges.forEach((badge) => {
    badge.textContent = totalCount;
    badge.style.display = totalCount > 0 ? "inline-block" : "none";
  });
}

/**
 * Calculate Cart Totals
 */
function getCartTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return {
    subtotal: subtotal,
    total: subtotal, // Add shipping / taxes calculation logic here if needed
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
  };
}

/**
 * Render Side Drawer or Floating Cart
 */
function renderCartDrawer() {
  const drawerBody = document.getElementById("cart-drawer-items");
  const drawerSubtotal = document.getElementById("cart-drawer-subtotal");
  const cart = getCart();

  if (drawerSubtotal) {
    const totals = getCartTotals();
    drawerSubtotal.textContent = formatCurrency(totals.subtotal);
  }

  if (!drawerBody) return;

  if (cart.length === 0) {
    drawerBody.innerHTML = `
      <div class="empty-cart-msg">
        <p>Your cart is empty.</p>
        <a href="/collections.html" class="btn-shop-now">Continue Shopping</a>
      </div>
    `;
    return;
  }

  drawerBody.innerHTML = cart.map((item) => `
    <div class="cart-drawer-item" data-id="${item.id}">
      <img 
        src="${item.image || 'https://via.placeholder.com/80x80?text=No+Img'}" 
        alt="${item.name}" 
        referrerpolicy="no-referrer"
        onerror="this.onerror=null; this.src='https://via.placeholder.com/80x80?text=NA';"
      />
      <div class="cart-item-details">
        <h4 class="cart-item-title">${item.name}</h4>
        <span class="cart-item-price">${formatCurrency(item.price)}</span>
        <div class="cart-item-qty-controls">
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">&times;</button>
    </div>
  `).join("");
}

// Auto-initialize Cart UI on page load
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  renderCartDrawer();
});
