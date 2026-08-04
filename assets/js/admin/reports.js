async function loadReports() {
  try {
    const r = await apiGet("reports.summary", {});
    document.getElementById("stat-daily").textContent = formatMoney(r.dailySales);
    document.getElementById("stat-weekly").textContent = formatMoney(r.weeklySales);
    document.getElementById("stat-monthly").textContent = formatMoney(r.monthlySales);
    document.getElementById("stat-total-revenue").textContent = formatMoney(r.totalRevenue);
    document.getElementById("stat-total-orders").textContent = r.totalOrders;

    document.getElementById("best-sellers-body").innerHTML = r.bestSellers.length ? r.bestSellers.map((p) => `
      <tr><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${formatMoney(p.revenue)}</td></tr>`).join("")
      : `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">No sales yet.</td></tr>`;

    document.getElementById("top-customers-body").innerHTML = r.topCustomers.length ? r.topCustomers.map((c) => `
      <tr><td>${escapeHtml(c.name)}</td><td>${c.orders}</td><td>${formatMoney(c.spend)}</td></tr>`).join("")
      : `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">No customers yet.</td></tr>`;
  } catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("reports");
  loadReports();
});
