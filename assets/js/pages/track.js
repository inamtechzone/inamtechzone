/**
 * pages/track.js — logic for track-order.html
 */

const TRACK_STEPS = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered"];

function renderOrderCard(o) {
  const cancelled = o.status === "Cancelled" || o.status === "Returned";
  const currentIdx = TRACK_STEPS.indexOf(o.status);
  const stepsHtml = !cancelled ? `
    <div class="tracker-steps">
      ${TRACK_STEPS.map((s, i) => `
        <div class="tracker-step ${i < currentIdx ? "done" : ""} ${i === currentIdx ? "current" : ""}">
          <div class="tracker-dot">${i < currentIdx ? "✓" : i + 1}</div>
          <div class="tracker-label">${s}</div>
        </div>`).join("")}
    </div>` : "";

  return `
    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div><div style="font-weight:700">${escapeHtml(o.orderNumber)}</div><div style="font-size:12.5px;color:var(--muted)">${formatDate(o.createdAt)}</div></div>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
      ${stepsHtml}
      <p style="color:var(--muted);font-size:14px">${escapeHtml(o.statusMessage)}</p>
      <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:6px">
        ${o.items.map((it) => `<div class="summary-row"><span>${escapeHtml(it.name)} × ${it.quantity}</span><span>${formatMoney(it.price * it.quantity)}</span></div>`).join("")}
        <div class="summary-row total"><span>Total</span><span>${formatMoney(o.total)}</span></div>
      </div>
    </div>`;
}

let mode = "orderId";

function setMode(next) {
  mode = next;
  qsa(".track-mode-chip").forEach((c) => c.classList.toggle("active", c.dataset.mode === next));
  document.getElementById("order-id-field").style.display = next === "orderId" ? "block" : "none";
  document.getElementById("phone-field").style.display = next === "phone" ? "block" : "none";
}

async function doSearch(e) {
  if (e) e.preventDefault();
  const resultsEl = document.getElementById("track-results");
  resultsEl.innerHTML = "";
  try {
    if (mode === "orderId") {
      const orderId = document.getElementById("order-id-input").value.trim();
      if (!orderId) return toast("Enter your Order ID", "error");
      resultsEl.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      const order = await apiGet("tracking.byOrderNumber", { orderNumber: orderId });
      resultsEl.innerHTML = renderOrderCard(order);
    } else {
      const phone = document.getElementById("phone-input").value.trim();
      if (!phone) return toast("Enter your phone number", "error");
      resultsEl.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      const orders = await apiGet("tracking.byPhone", { phone: phone });
      resultsEl.innerHTML = orders.map(renderOrderCard).join("");
    }
  } catch (err) {
    resultsEl.innerHTML = "";
    toastError(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  qsa(".track-mode-chip").forEach((c) => c.addEventListener("click", () => setMode(c.dataset.mode)));
  document.getElementById("track-form").addEventListener("submit", doSearch);

  const orderNumber = new URL(window.location.href).searchParams.get("orderNumber");
  if (orderNumber) {
    document.getElementById("order-id-input").value = orderNumber;
    doSearch();
  }
});
