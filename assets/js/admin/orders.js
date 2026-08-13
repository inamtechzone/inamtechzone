const ADMIN_ORDER_STATUSES = ["New", "Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered", "Cancelled", "Returned"];
let orderPage = 1;
let expandedOrderId = null;

async function loadAdminOrders() {
  const search = document.getElementById("order-search").value;
  const status = document.getElementById("order-status-filter").value;
  document.getElementById("orders-body").innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const data = await apiGet("orders.list", { search: search, status: status, page: orderPage, limit: 10 });
    renderOrdersTable(data.items);
    document.getElementById("orders-pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="orderPage=Number(this.dataset.page);loadAdminOrders()"');
  } catch (e) { toastError(e); }
}

function renderOrdersTable(orders) {
  document.getElementById("orders-body").innerHTML = orders.length ? orders.map((o) => `
    <tr>
      <td style="cursor:pointer" onclick="toggleOrderDetail('${o.id}')">${escapeHtml(o.orderNumber)} ${expandedOrderId === o.id ? "▲" : "▼"}</td>
      <td>${escapeHtml(o.customerName)}</td>
      <td>${escapeHtml(o.phone)}</td>
      <td>${formatMoney(o.total)}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>
        <select onchange="changeOrderStatus('${o.id}',this.value)" style="border:1.5px solid var(--line);border-radius:6px;padding:5px 8px;font-size:13px;background:var(--surface);color:var(--ink)">
          ${ADMIN_ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}','${escapeHtml(o.orderNumber)}')">Delete</button></td>
    </tr>
    ${expandedOrderId === o.id ? `
    <tr><td colspan="7" style="background:var(--bg)">
      <div style="padding:8px 4px">
        <div style="font-size:13px;margin-bottom:8px"><strong>Address:</strong> ${escapeHtml(o.address)}, ${escapeHtml(o.city)} ${escapeHtml(o.postalCode || "")}</div>
        ${o.notes ? `<div style="font-size:13px;margin-bottom:8px"><strong>Notes:</strong> ${escapeHtml(o.notes)}</div>` : ""}
        ${o.couponCode ? `<div style="font-size:13px;margin-bottom:8px"><strong>Coupon:</strong> ${escapeHtml(o.couponCode)} (-${formatMoney(o.discountAmount)})</div>` : ""}
        ${o.items.map((it) => `<div class="summary-row"><span>${escapeHtml(it.name)} × ${it.quantity}</span><span>${formatMoney(it.price * it.quantity)}</span></div>`).join("")}
      </div>
    </td></tr>` : ""}
  `).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No orders found.</td></tr>`;
}

function toggleOrderDetail(id) {
  expandedOrderId = expandedOrderId === id ? null : id;
  loadAdminOrders();
}

async function changeOrderStatus(id, status) {
  try { await apiPost("orders.updateStatus", { id: id, status: status }); toast("Order status updated", "success"); loadAdminOrders(); }
  catch (e) { toastError(e); }
}

async function deleteOrder(id, orderNumber) {
  if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
  try { await apiPost("orders.delete", { id: id }); toast("Order deleted", "success"); loadAdminOrders(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("orders");
  document.getElementById("order-status-filter").innerHTML = `<option value="">All statuses</option>` + ADMIN_ORDER_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("");
  loadAdminOrders();
  document.getElementById("order-search").addEventListener("input", debounce(() => { orderPage = 1; loadAdminOrders(); }, 400));
  document.getElementById("order-status-filter").addEventListener("change", () => { orderPage = 1; loadAdminOrders(); });
});
