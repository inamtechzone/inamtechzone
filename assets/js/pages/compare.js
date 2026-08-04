/**
 * pages/compare.js — logic for compare.html
 */

function specRowsUnion_(products) {
  const keys = new Set();
  products.forEach((p) => (p.specifications || []).forEach((s) => keys.add(s.key)));
  return Array.from(keys);
}

function specValue_(product, key) {
  const found = (product.specifications || []).find((s) => s.key === key);
  return found ? found.value : "—";
}

async function loadCompare() {
  const ids = getCompareList();
  const root = document.getElementById("compare-root");
  if (!ids.length) {
    root.innerHTML = `<div class="empty-state"><h3>Nothing to compare yet</h3><p>Tap "Compare" on any product page to add it here (up to 4 at a time).</p><a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Browse products</a></div>`;
    return;
  }

  root.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
  const products = (await Promise.all(ids.map((id) => apiGet("products.get", { id: id }).catch(() => null)))).filter(Boolean);
  if (!products.length) { root.innerHTML = ""; return; }

  const specKeys = specRowsUnion_(products);

  root.innerHTML = `
    <div class="table-scroll">
      <table class="admin-table" style="min-width:${products.length * 220}px">
        <thead><tr><th>&nbsp;</th>${products.map((p) => `<th>${escapeHtml(p.name)} <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="removeFromCompare('${p.id}');loadCompare()">×</button></th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>Image</td>${products.map((p) => `<td><img src="${escapeHtml(p.images[0] || "")}" style="width:70px;height:70px;object-fit:cover;border-radius:8px"></td>`).join("")}</tr>
          <tr><td>Price</td>${products.map((p) => `<td>${formatMoney(p.discountPrice || p.price)}</td>`).join("")}</tr>
          <tr><td>Stock</td>${products.map((p) => `<td>${p.stock > 0 ? "In stock (" + p.stock + ")" : "Out of stock"}</td>`).join("")}</tr>
          <tr><td>Category</td>${products.map((p) => `<td>${escapeHtml(p.category)}</td>`).join("")}</tr>
          <tr><td>Brand</td>${products.map((p) => `<td>${escapeHtml(p.brand || "—")}</td>`).join("")}</tr>
          ${specKeys.map((key) => `<tr><td>${escapeHtml(key)}</td>${products.map((p) => `<td>${escapeHtml(specValue_(p, key))}</td>`).join("")}</tr>`).join("")}
          <tr><td></td>${products.map((p) => `<td><a href="${escapeHtml(p.canonicalPath)}" class="btn btn-primary btn-sm">View</a></td>`).join("")}</tr>
        </tbody>
      </table>
    </div>`;
}

document.addEventListener("DOMContentLoaded", loadCompare);
