let customerPage = 1;

async function loadCustomers() {
  const search = document.getElementById("customer-search").value;
  document.getElementById("customers-body").innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const data = await apiGet("customers.list", { search: search, page: customerPage, limit: 15 });
    document.getElementById("customer-total").textContent = data.total + " total";
    document.getElementById("customers-body").innerHTML = data.items.length ? data.items.map((c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td>${escapeHtml(c.city)}</td>
        <td>${c.totalOrders}</td>
        <td>${formatMoney(c.totalSpent)}</td>
        <td>${new Date(c.lastOrderAt).toLocaleDateString()}</td>
      </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No customers yet.</td></tr>`;
    document.getElementById("customers-pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="customerPage=Number(this.dataset.page);loadCustomers()"');
  } catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("customers");
  loadCustomers();
  document.getElementById("customer-search").addEventListener("input", debounce(() => { customerPage = 1; loadCustomers(); }, 400));
});
