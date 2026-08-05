/**
 * pages/cart.js — logic for cart.html
 */

function renderCart() {
  const items = getCart();
  const root = document.getElementById("cart-root");
  if (!items.length) {
    root.innerHTML = `<div class="empty-state"><h3>Your cart is empty</h3><p>Add a few products and they'll show up here.</p><a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Browse products</a></div>`;
    return;
  }

  const subtotal = cartSubtotal();
  const shipping = Number((window.ITZ_SETTINGS && window.ITZ_SETTINGS.shippingRate) || 250);
  const total = subtotal + shipping;

  root.innerHTML = `
    <div class="two-col">
      <div>
        <h2>Your cart</h2>
        <div class="card" style="padding:6px 22px" id="cart-lines"></div>
      </div>
      <div>
        <h2>Summary</h2>
        <div class="card">
          <div class="summary-row"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${formatMoney(shipping)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${formatMoney(total)}</span></div>
          <a href="/checkout.html" class="btn btn-primary btn-block" style="margin-top:16px">Proceed to checkout</a>
        </div>
      </div>
    </div>`;

  document.getElementById("cart-lines").innerHTML = items.map((i) => `
    <div class="cart-line">
      <img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}">
      <div>
        <div style="font-weight:600;font-size:14.5px">${escapeHtml(i.name)}</div>
        <div style="font-size:13px;color:var(--muted)">${formatMoney(i.price)}</div>
      </div>
      <div class="qty-control">
        <button onclick="changeCartQty('${i.productId}', ${i.quantity - 1})">−</button>
        <span>${i.quantity}</span>
        <button onclick="changeCartQty('${i.productId}', ${i.quantity + 1})">+</button>
      </div>
      <button class="btn btn-danger btn-sm" onclick="removeCartLine('${i.productId}')">Remove</button>
    </div>`).join("");
}

function changeCartQty(productId, qty) {
  if (qty < 1) return;
  updateCartQuantity(productId, qty);
  renderCart();
}

function removeCartLine(productId) {
  removeFromCart(productId);
  renderCart();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Wait briefly for settings to load via layout.js so shipping rate is accurate.
  await new Promise((r) => setTimeout(r, 150));
  renderCart();
});
