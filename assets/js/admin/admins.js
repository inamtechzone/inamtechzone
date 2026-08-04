async function loadAdmins() {
  document.getElementById("admins-body").innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const admins = await apiPost("admins.list", {});
    const me = getAdminInfo();
    document.getElementById("admins-body").innerHTML = admins.map((a) => `
      <tr>
        <td>${escapeHtml(a.name)}</td>
        <td>${escapeHtml(a.email)}</td>
        <td><span class="badge-pill">${a.role}</span></td>
        <td><span class="badge-pill">${a.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="toggleAdminStatus('${a.id}','${a.status}')" ${a.id === me.id ? "disabled" : ""}>${a.status === "Disabled" ? "Enable" : "Disable"}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAdmin('${a.id}','${escapeHtml(a.name)}')" ${a.id === me.id ? "disabled" : ""}>Delete</button>
        </td>
      </tr>`).join("");
  } catch (e) { toastError(e); }
}

async function toggleAdminStatus(id, status) {
  try { await apiPost("admins.update", { id: id, status: status === "Disabled" ? "Active" : "Disabled" }); loadAdmins(); }
  catch (e) { toastError(e); }
}

async function deleteAdmin(id, name) {
  if (!confirm(`Delete admin "${name}"?`)) return;
  try { await apiPost("admins.delete", { id: id }); toast("Admin removed", "success"); loadAdmins(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("admins");
  const me = getAdminInfo();
  if (me.role !== "SuperAdmin") {
    document.getElementById("admin-main").innerHTML = `<div class="empty-state"><h3>Not authorized</h3><p>Only SuperAdmins can manage admin users.</p></div>`;
    return;
  }
  loadAdmins();

  document.getElementById("admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await apiPost("admins.create", { name: form.name.value, email: form.email.value, password: form.password.value, role: form.role.value });
      toast("Admin created", "success");
      form.reset();
      loadAdmins();
    } catch (err) { toastError(err); }
  });
});
