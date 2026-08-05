const CART_KEY = "itz_cart";
const WISHLIST_KEY = "itz_wishlist";
const RECENT_KEY = "itz_recently_viewed";
function readJson_(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function writeJson_(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getCart() { return readJson_(CART_KEY, []); }
function saveCart(items) {
  writeJson_(CART_KEY, items);
  updateCartBadge();
}
function addToCart(product, quantity) {
  quantity = quantity || 1;
  const items = getCart();
  const existing = items.find((i) => i.productId === product.id);
  const price = product.discountPrice || product.price;
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, product.stock || 99);
  } else {
    items.push({
      productId: product.id, name: product.name, price: price,
      image: (product.images && product.images[0]) || "", stock: product.stock, quantity: quantity,
    });
  }
  saveCart(items);
}
function updateCartQuantity(productId, quantity) {
  const items = getCart().map((i) => i.productId === productId
    ? Object.assign({}, i, { quantity: Math.max(1, Math.min(quantity, i.stock || 99)) })
    : i);
  saveCart(items);
}
function removeFromCart(productId) {
  saveCart(getCart().filter((i) => i.productId !== productId));
}
function clearCart() { saveCart([]); }
function cartSubtotal() { return getCart().reduce((s, i) => s + i.price * i.quantity, 0); }
function cartCount() { return getCart().reduce((s, i) => s + i.quantity, 0); }
function updateCartBadge() {
  qsa(".cart-badge").forEach((el) => {
    const count = cartCount();
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}
function getWishlist() { return readJson_(WISHLIST_KEY, []); }
function isWishlisted(productId) { return getWishlist().includes(productId); }
function toggleWishlist(productId) {
  let list = getWishlist();
  if (list.includes(productId)) list = list.filter((id) => id !== productId);
  else list.push(productId);
  writeJson_(WISHLIST_KEY, list);
  return list.includes(productId);
}
function pushRecentlyViewed(productId) {
  let list = readJson_(RECENT_KEY, []).filter((id) => id !== productId);
  list.unshift(productId);
  list = list.slice(0, 12);
  writeJson_(RECENT_KEY, list);
}
function getRecentlyViewed() { return readJson_(RECENT_KEY, []); }
