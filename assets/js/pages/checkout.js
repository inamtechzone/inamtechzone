/**
 * pages/checkout.js — logic for checkout.html
 */

let appliedCoupon = null;

// Config se safe shipping fee hasil karne ka helper
function getShippingFee(subtotal) {
  const config = window.ITZ_CONFIG || window.CONFIG || {};
  const rate = Number(config.DELIVERY_CHARGES !== undefined ? config.DELIVERY_CHARGES : 150);
  const freeThreshold = Number(config.FREE_DELIVERY_ABOVE || 0);

  // Agar subtotal threshold se zyada hai to delivery free
  if (freeThreshold > 0 && subtotal >= freeThreshold) {
    return 0;
  }
  return rate;
}

function renderSummary() {
  const items = typeof getCart === "function" ? getCart() : [];
  const subtotal = typeof cartSubtotal === "function" ? cartSubtotal() : 0;
  const shipping = getShippingFee(subtotal);
  const discount = appliedCoupon ? Number(appliedCoupon.discount || 0) : 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  const summaryLines = document.getElementById("summary-lines");
  if (summaryLines) {
    summaryLines.innerHTML = items.map((i) =>
      `<div class="summary-row"><span>${escapeHtml(i.name)} × ${i.quantity}</span><span>${formatMoney(i.price * i.quantity)}</span></div>`
    ).join("");
  }

  const subtotalEl = document.getElementById("summary-subtotal");
  const shippingEl = document.getElementById("summary-shipping");
  const totalEl = document.getElementById("summary-total");

  if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
  if (shippingEl) shippingEl.textContent = shipping === 0 ? "FREE" : formatMoney(shipping);
  if (totalEl) totalEl.textContent = formatMoney(total);

  const discountRow = document.getElementById("summary-discount-row");
  if (discountRow) {
    if (discount > 0) {
      discountRow.style.display = "flex";
      const discountEl = document.getElementById("summary-discount");
      if (discountEl) discountEl.textContent = "− " + formatMoney(discount);
    } else {
      discountRow.style.display = "none";
    }
  }

  const placeBtn = document.getElementById("place-order-btn");
  if (placeBtn) {
    placeBtn.textContent = `Place order (COD) · ${formatMoney(total)}`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const items = typeof getCart === "function" ? getCart() : [];
  
  if (!items.length) {
    const root = document.getElementById("checkout-root");
    if (root) {
      root.innerHTML = `<div class="empty-state"><h3>Nothing to check out</h3><a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Browse products</a></div>`;
    }
    return;
  }

  await new Promise((r) => setTimeout(r, 150));
  renderSummary();

  // Coupon Apply Event
  const applyCouponBtn = document.getElementById("apply-coupon-btn");
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener("click", async () => {
      const input = document.getElementById("coupon-input");
      const code = input ? input.value.trim() : "";
      if (!code) return;

      try {
        const subtotal = typeof cartSubtotal === "function" ? cartSubtotal() : 0;
        const data = await apiPost("coupons.validate", { code: code, subtotal: subtotal });
        appliedCoupon = data;
        toast(`Coupon applied: -${formatMoney(data.discount)}`, "success");
        renderSummary();
      } catch (e) { 
        toastError(e); 
      }
    });
  }

  // Checkout Form Submission
  const checkoutForm = document.getElementById("checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = document.getElementById("place-order-btn");
      if (btn) btn.disabled = true;

      try {
        const subtotal = typeof cartSubtotal === "function" ? cartSubtotal() : 0;
        const shippingFee = getShippingFee(subtotal);
        const discount = appliedCoupon ? Number(appliedCoupon.discount || 0) : 0;
        const total = Math.max(0, subtotal - discount) + shippingFee;
        
        const utm = typeof getUtmSession === "function" ? getUtmSession() : {};

        const payload = {
          customerName: form.customerName ? form.customerName.value : "",
          phone: form.phone ? form.phone.value : "",
          address: form.address ? form.address.value : "",
          city: form.city ? form.city.value : "",
          postalCode: form.postalCode ? form.postalCode.value : "",
          notes: form.notes ? form.notes.value : "",
          couponCode: appliedCoupon ? appliedCoupon.code : "",
          subtotal: subtotal,
          shippingFee: shippingFee,
          discount: discount,
          total: total,
          items: getCart().map((i) => ({ 
            productId: i.productId, 
            quantity: i.quantity,
            price: i.price,
            name: i.name 
          })),
          utmSource: utm.utmSource || "",
          utmMedium: utm.utmMedium || "",
          utmCampaign: utm.utmCampaign || "",
          utmContent: utm.utmContent || "",
          referrer: utm.referrer || ""
        };

        const order = await apiPost("orders.create", payload);
        
        if (typeof trackEvent === "function") {
          trackEvent("checkout", { orderId: order.id || order.orderNumber });
        }

        if (typeof clearCart === "function") {
          clearCart();
        }

        const orderNum = order.orderNumber || order.id || "";
        window.location.href = "/order-confirmed.html?orderNumber=" + encodeURIComponent(orderNum);
      } catch (err) {
        toastError(err);
        if (btn) btn.disabled = false;
      }
    });
  }
});
