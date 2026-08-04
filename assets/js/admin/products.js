// Minimal CSV parser handling quoted fields with embedded commas — used for
// parsing an admin-selected Shopify-format CSV file before it's posted to
// products.importShopifyCsv as structured rows.
function parseCsv_(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((r) => r.some((c) => c !== "")).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = r[i] !== undefined ? r[i] : ""; });
    return obj;
  });
}

// Downloads the live product catalog as a Shopify-format CSV — the same
// column layout (Handle, Title, Body (HTML), Vendor, Type, Tags, Variant
// SKU/Price/Inventory Qty, Image Src, Status, etc.) that Shopify itself
// exports, so the file round-trips through Shopify, spreadsheets, or back
// into this admin panel without any reformatting.
async function exportProductsShopifyCsv() {
  const btn = document.getElementById("export-csv-btn");
  btn.disabled = true; btn.textContent = "Exporting…";
  try {
    const csv = await apiGetRaw("products.exportShopifyCsv", {});
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inam-tech-zone-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Export downloaded", "success");
  } catch (e) { toastError(e); }
  finally { btn.disabled = false; btn.textContent = "Export CSV"; }
}

// Groups raw parsed CSV rows by Handle client-side (mirrors the server's own
// grouping in ShopifyCsv.gs) so a product's continuation rows — extra "Image
// Src" rows Shopify uses instead of a repeated array — never get separated
// from their parent row when we split the import into batches below.
function groupRowsByHandle_(rows) {
  const groups = [];
  const indexByHandle = {};
  rows.forEach((row) => {
    const handle = String(row["Handle"] || "").trim();
    if (!handle) return;
    if (indexByHandle[handle] === undefined) {
      indexByHandle[handle] = groups.length;
      groups.push([row]);
    } else {
      groups[indexByHandle[handle]].push(row);
    }
  });
  return groups;
}

const IMPORT_BATCH_SIZE = 40; // products per request — comfortably inside Apps Script's 6-minute execution limit

// Imports a Shopify-format CSV — parses it client-side (reusing the same CSV
// parser the export produces), splits it into batches of complete products
// (see groupRowsByHandle_ above for why batching happens at the product
// level, not the row level), and posts each batch to
// products.importShopifyCsv in turn. Splitting into batches means a CSV with
// hundreds of products imports reliably instead of risking a single request
// timing out — and if one batch does fail, everything before it is already
// saved, so nothing is lost.
async function importProductsShopifyCsv(file) {
  const text = await file.text();
  const rows = parseCsv_(text);
  if (!rows.length) return toast("No rows found in that file", "error");
  if (!rows[0].hasOwnProperty("Handle") || !rows[0].hasOwnProperty("Title")) {
    return toast('This doesn\'t look like a Shopify-format CSV — expected columns like "Handle" and "Title".', "error");
  }

  const productGroups = groupRowsByHandle_(rows);
  if (!productGroups.length) return toast("No valid rows found (every row needs a Handle)", "error");

  const batches = [];
  for (let i = 0; i < productGroups.length; i += IMPORT_BATCH_SIZE) {
    batches.push(productGroups.slice(i, i + IMPORT_BATCH_SIZE).flat());
  }

  const totals = { created: 0, updated: 0, skipped: 0 };
  const allErrors = [];
  const allWarnings = [];
  const progressToastId = "import-progress";

  for (let i = 0; i < batches.length; i++) {
    toast(`Importing… batch ${i + 1} of ${batches.length} (${productGroups.length} products total)`);
    try {
      const result = await apiPost("products.importShopifyCsv", { rows: batches[i] });
      totals.created += result.created;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
      if (result.errors) allErrors.push(...result.errors);
      if (result.warnings) allWarnings.push(...result.warnings);
    } catch (e) {
      allErrors.push(`Batch ${i + 1}: ${e.message}`);
    }
  }

  toast(`Import finished: ${totals.created} created, ${totals.updated} updated, ${totals.skipped} skipped`, "success");
  if (allWarnings.length) allWarnings.forEach((w) => toast(w, "error"));
  if (allErrors.length) {
    console.warn("Import errors:", allErrors);
    toast(`${allErrors.length} row(s) had errors — see browser console for details`, "error");
  }
  loadAdminProducts();
}

let productPage = 1;

async function loadAdminProducts() {
  const search = document.getElementById("admin-product-search").value;
  document.getElementById("admin-products-body").innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const data = await apiGet("products.list", { search: search, page: productPage, limit: 10, __admin: "1" });
    // __isAdmin flag is derived server-side from the token, not this param — harmless if ignored.
    renderAdminProductsTable(data.items);
    document.getElementById("admin-products-pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="productPage=Number(this.dataset.page);loadAdminProducts()"');
  } catch (e) { toastError(e); }
}

function renderAdminProductsTable(items) {
  document.getElementById("admin-products-body").innerHTML = items.length ? items.map((p) => `
    <tr>
      <td><div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:var(--bg)">${p.images[0] ? `<img src="${escapeHtml(p.images[0])}" style="width:100%;height:100%;object-fit:cover">` : ""}</div></td>
      <td>${escapeHtml(p.name)}</td>
      <td style="font-family:var(--font-mono)">${escapeHtml(p.sku)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${formatMoney(p.discountPrice || p.price)}</td>
      <td>${p.stock}</td>
      <td><span class="badge-pill">${p.status === "Disabled" ? "Disabled" : "Active"}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <a href="/admin/product-form.html?id=${p.id}" class="btn btn-outline btn-sm">Edit</a>
        <button class="btn btn-outline btn-sm" onclick="duplicateProduct('${p.id}')">Duplicate</button>
        <button class="btn btn-outline btn-sm" onclick="toggleProductStatus('${p.id}')">${p.status === "Disabled" ? "Enable" : "Disable"}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}','${escapeHtml(p.name)}')">Delete</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No products found.</td></tr>`;
}

async function duplicateProduct(id) {
  try { await apiPost("products.duplicate", { id: id }); toast("Product duplicated", "success"); loadAdminProducts(); }
  catch (e) { toastError(e); }
}

async function toggleProductStatus(id) {
  try { await apiPost("products.toggleStatus", { id: id }); loadAdminProducts(); }
  catch (e) { toastError(e); }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try { await apiPost("products.delete", { id: id }); toast("Product deleted", "success"); loadAdminProducts(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("products");
  loadAdminProducts();
  document.getElementById("admin-product-search").addEventListener("input", debounce(() => { productPage = 1; loadAdminProducts(); }, 400));
  document.getElementById("export-csv-btn").addEventListener("click", exportProductsShopifyCsv);
  document.getElementById("import-csv-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importProductsShopifyCsv(file);
    e.target.value = "";
  });
});
