document.addEventListener("DOMContentLoaded", async () => {
  initAdminLayout("dashboard");
  try {
    const [products, orders, pending, customers, reports] = await Promise.all([
      apiGet("products.list", { limit: 1 }),
      apiGet("orders.list", { limit: 5 }),
      apiGet("orders.list", { status: "Pending", limit: 1 }),
      apiGet("customers.list", { limit: 1 }),
      apiGet("reports.summary", {}),
    ]);

    document.getElementById("stat-products").textContent = products.total;
    document.getElementById("stat-orders").textContent = orders.total;
    document.getElementById("stat-pending").textContent = pending.total;
    document.getElementById("stat-customers").textContent = customers.total;
    document.getElementById("stat-revenue").textContent = formatMoney(reports.totalRevenue);
    document.getElementById("stat-monthly").textContent = formatMoney(reports.monthlySales);

    document.getElementById("recent-orders-body").innerHTML = orders.items.map((o) => `
      <tr>
        <td>${escapeHtml(o.orderNumber)}</td>
        <td>${escapeHtml(o.customerName)}</td>
        <td>${formatMoney(o.total)}</td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No orders yet.</td></tr>`;
  } catch (e) { toastError(e); }
});
