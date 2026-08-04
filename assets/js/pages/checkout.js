/**
 * pages/checkout.js — logic for checkout.html
 */

let appliedCoupon = null;

function renderSummary() {
  const items = getCart();
  const subtotal = cartSubtotal();
  const shipping = Number((window.ITZ_SETTINGS && window.ITZ_SETTINGS.shippingRate) || 250);
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  document.getElementById("summary-lines").innerHTML = items.map((i) =>
    `<div class="summary-row"><span>${escapeHtml(i.name)} × ${i.quantity}</span><span>${formatMoney(i.price * i.quantity)}</span></div>`
  ).join("");
  document.getElementById("summary-subtotal").textContent = formatMoney(subtotal);
  document.getElementById("summary-shipping").textContent = formatMoney(shipping);
  document.getElementById("summary-total").textContent = formatMoney(total);

  const discountRow = document.getElementById("summary-discount-row");
  if (discount > 0) {
    discountRow.style.display = "flex";
    document.getElementById("summary-discount").textContent = "− " + formatMoney(discount);
  } else discountRow.style.display = "none";

  document.getElementById("place-order-btn").textContent = `Place order (COD) · ${formatMoney(total)}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const items = getCart();
  if (!items.length) {
    document.getElementById("checkout-root").innerHTML = `<div class="empty-state"><h3>Nothing to check out</h3><a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Browse products</a></div>`;
    return;
  }
  await new Promise((r) => setTimeout(r, 150));
  renderSummary();

  document.getElementById("apply-coupon-btn").addEventListener("click", async () => {
    const code = document.getElementById("coupon-input").value.trim();
    if (!code) return;
    try {
      const data = await apiPost("coupons.validate", { code: code, subtotal: cartSubtotal() });
      appliedCoupon = data;
      toast(`Coupon applied: -${formatMoney(data.discount)}`, "success");
      renderSummary();
    } catch (e) { toastError(e); }
  });

  document.getElementById("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("place-order-btn");
    btn.disabled = true;
    try {
      const utm = getUtmSession();
      const payload = {
        customerName: form.customerName.value,
        phone: form.phone.value,
        address: form.address.value,
        city: form.city.value,
        postalCode: form.postalCode.value,
        notes: form.notes.value,
        couponCode: appliedCoupon ? appliedCoupon.code : "",
        items: getCart().map((i) => ({ productId: i.productId, quantity: i.quantity })),
        utmSource: utm.utmSource, utmMedium: utm.utmMedium,
        utmCampaign: utm.utmCampaign, utmContent: utm.utmContent, referrer: utm.referrer,
      };
      const order = await apiPost("orders.create", payload);
      trackEvent("checkout", { orderId: order.id });
      clearCart();
      window.location.href = "/order-confirmed.html?orderNumber=" + encodeURIComponent(order.orderNumber);
    } catch (err) {
      toastError(err);
      btn.disabled = false;
    }
  });
});
