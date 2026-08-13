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

// Downloads the live product catalog as a Shopify-format CSV
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

// Groups raw parsed CSV rows by Handle client-side
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

const IMPORT_BATCH_SIZE = 40;

// Imports a Shopify-format CSV
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

// -------------------------------------------------------------
// Global Product Selection & Actions Logic
// -------------------------------------------------------------
let productPage = 1;
let selectedProductIds = [];

async function loadAdminProducts() {
  const search = document.getElementById("admin-product-search").value;
  document.getElementById("admin-products-body").innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  
  // Reset selections on page load
  selectedProductIds = [];
  updateSelectionUI();

  try {
    const data = await apiGet("products.list", { search: search, page: productPage, limit: 10, __admin: "1" });
    renderAdminProductsTable(data.items || []);
    document.getElementById("admin-products-pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="productPage=Number(this.dataset.page);loadAdminProducts()"');
  } catch (e) { toastError(e); }
}

function renderAdminProductsTable(items) {
  const tbody = document.getElementById("admin-products-body");
  if (!items || !items.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No products found.</td></tr>`;
    updateSelectionUI();
    return;
  }

  tbody.innerHTML = items.map((p) => {
    const pId = String(p.id || p._id);
    const isChecked = selectedProductIds.includes(pId);

    return `
    <tr>
      <td style="text-align:center;width:40px">
        <input type="checkbox" class="product-select-checkbox" value="${pId}" ${isChecked ? 'checked' : ''}>
      </td>
      <td style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:6px;overflow:hidden;background:var(--bg);flex-shrink:0">
          ${p.images && p.images[0] ? `<img src="${escapeHtml(p.images[0])}" style="width:100%;height:100%;object-fit:cover">` : ''}
        </div>
        <span>${escapeHtml(p.name)}</span>
      </td>
      <td style="font-family:var(--font-mono)">${escapeHtml(p.sku || '-')}</td>
      <td>${escapeHtml(p.category || '-')}</td>
      <td>${formatMoney(p.discountPrice || p.price)}</td>
      <td>${p.stock ?? 0}</td>
      <td><span class="badge-pill">${p.status === "Disabled" ? "Disabled" : "Active"}</span></td>
    </tr>`;
  }).join("");

  bindCheckboxEvents();
  updateSelectionUI();
}

function bindCheckboxEvents() {
  const checkboxes = document.querySelectorAll('.product-select-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.value;
      if (e.target.checked) {
        if (!selectedProductIds.includes(id)) selectedProductIds.push(id);
      } else {
        selectedProductIds = selectedProductIds.filter(itemId => itemId !== id);
      }
      updateSelectionUI();
    });
  });
}

function updateSelectionUI() {
  const selectAll = document.getElementById('select-all-products');
  const checkboxes = document.querySelectorAll('.product-select-checkbox');

  if (selectAll) {
    if (checkboxes.length > 0) {
      selectAll.checked = Array.from(checkboxes).every(cb => cb.checked);
    } else {
      selectAll.checked = false;
    }
  }

  const count = selectedProductIds.length;

  const btnEdit = document.getElementById('global-edit-btn');
  const btnModify = document.getElementById('global-modify-btn');
  const btnDuplicate = document.getElementById('global-duplicate-btn');
  const btnDelete = document.getElementById('global-delete-btn');

  // Edit / Modify / Duplicate صرف 1 سلیکٹ ہونے پر فعال ہوں گے
  if (btnEdit) btnEdit.disabled = count !== 1;
  if (btnModify) btnModify.disabled = count !== 1;
  if (btnDuplicate) btnDuplicate.disabled = count !== 1;

  // Delete ایک یا زیادہ سلیکٹ ہونے پر فعال ہوگا
  if (btnDelete) btnDelete.disabled = count === 0;
}

function setupSelectAll() {
  const selectAll = document.getElementById('select-all-products');
  if (!selectAll) return;

  selectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.product-select-checkbox');

    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      const id = cb.value;
      if (isChecked) {
        if (!selectedProductIds.includes(id)) selectedProductIds.push(id);
      } else {
        selectedProductIds = selectedProductIds.filter(itemId => itemId !== id);
      }
    });

    updateSelectionUI();
  });
}

function setupGlobalActions() {
  const btnEdit = document.getElementById('global-edit-btn');
  const btnModify = document.getElementById('global-modify-btn');
  const btnDuplicate = document.getElementById('global-duplicate-btn');
  const btnDelete = document.getElementById('global-delete-btn');

  const handleEdit = () => {
    if (selectedProductIds.length === 1) {
      window.location.href = `/admin/product-form.html?id=${selectedProductIds[0]}`;
    }
  };

  if (btnEdit) btnEdit.addEventListener('click', handleEdit);
  if (btnModify) btnModify.addEventListener('click', handleEdit);

  if (btnDuplicate) {
    btnDuplicate.addEventListener('click', async () => {
      if (selectedProductIds.length === 1) {
        try {
          await apiPost("products.duplicate", { id: selectedProductIds[0] });
          toast("Product duplicated", "success");
          selectedProductIds = [];
          loadAdminProducts();
        } catch (e) { toastError(e); }
      }
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (selectedProductIds.length === 0) return;
      const msg = selectedProductIds.length === 1
        ? "Are you sure you want to delete this product?"
        : `Are you sure you want to delete ${selectedProductIds.length} products?`;

      if (!confirm(msg)) return;

      try {
        for (const id of selectedProductIds) {
          await apiPost("products.delete", { id: id });
        }
        toast(`${selectedProductIds.length} product(s) deleted`, "success");
        selectedProductIds = [];
        loadAdminProducts();
      } catch (e) { toastError(e); }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("products");
  setupSelectAll();
  setupGlobalActions();
  loadAdminProducts();

  document.getElementById("admin-product-search").addEventListener("input", debounce(() => { 
    productPage = 1; 
    loadAdminProducts(); 
  }, 400));

  document.getElementById("export-csv-btn").addEventListener("click", exportProductsShopifyCsv);
  document.getElementById("import-csv-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importProductsShopifyCsv(file);
    e.target.value = "";
  });
});
