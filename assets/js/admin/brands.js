let editingBrandId = null;

async function loadBrands() {
  document.getElementById("brands-body").innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const brands = await apiGet("brands.list", {});
    document.getElementById("brands-body").innerHTML = brands.length ? brands.map((b) => `
      <tr>
        <td>${escapeHtml(b.name)}</td>
        <td style="font-family:var(--font-mono)">${escapeHtml(b.slug)}</td>
        <td>${b.productCount}</td>
        <td style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="editBrand('${b.id}','${escapeHtml(b.name)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBrand('${b.id}','${escapeHtml(b.name)}')">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No brands yet.</td></tr>`;
  } catch (e) { toastError(e); }
}

function editBrand(id, name) {
  editingBrandId = id;
  document.getElementById("brand-name-input").value = name;
  document.getElementById("brand-form-btn").textContent = "Save changes";
}

async function deleteBrand(id, name) {
  if (!confirm(`Delete brand "${name}"?`)) return;
  try { await apiPost("brands.delete", { id: id }); toast("Brand deleted", "success"); loadBrands(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("brands");
  loadBrands();

  document.getElementById("brand-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("brand-name-input").value.trim();
    if (!name) return;
    try {
      if (editingBrandId) await apiPost("brands.update", { id: editingBrandId, name: name });
      else await apiPost("brands.create", { name: name });
      toast("Saved", "success");
      editingBrandId = null;
      document.getElementById("brand-form-btn").textContent = "Add";
      e.target.reset();
      loadBrands();
    } catch (err) { toastError(err); }
  });
});
