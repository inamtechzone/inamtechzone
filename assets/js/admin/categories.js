let editingCategoryId = null;

async function loadCategories() {
  document.getElementById("categories-body").innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const categories = await apiGet("categories.list", {});
    document.getElementById("categories-body").innerHTML = categories.length ? categories.map((c) => `
      <tr>
        <td>${c.image ? `<img src="${escapeHtml(c.image)}" style="width:32px;height:32px;object-fit:cover;border-radius:6px">` : (c.icon || "—")}</td>
        <td>${escapeHtml(c.name)}</td>
        <td style="font-family:var(--font-mono)">${escapeHtml(c.slug)}</td>
        <td>${c.productCount}</td>
        <td style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="editCategory('${c.id}','${escapeHtml(c.name)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}','${escapeHtml(c.name)}')">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No categories yet.</td></tr>`;
  } catch (e) { toastError(e); }
}

function editCategory(id, name) {
  editingCategoryId = id;
  document.getElementById("category-name-input").value = name;
  document.getElementById("category-form-btn").textContent = "Save changes";
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  try { await apiPost("categories.delete", { id: id }); toast("Category deleted", "success"); loadCategories(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("categories");
  loadCategories();

  document.getElementById("category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("category-name-input").value.trim();
    if (!name) return;
    try {
      if (editingCategoryId) await apiPost("categories.update", { id: editingCategoryId, name: name });
      else await apiPost("categories.create", { name: name });
      toast("Saved", "success");
      editingCategoryId = null;
      document.getElementById("category-form-btn").textContent = "Add";
      e.target.reset();
      loadCategories();
    } catch (err) { toastError(err); }
  });
});
