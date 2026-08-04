document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("backup");
  const me = getAdminInfo();
  if (me.role !== "SuperAdmin") {
    document.getElementById("admin-main").innerHTML = `<div class="empty-state"><h3>Not authorized</h3><p>Only SuperAdmins can export backups.</p></div>`;
    return;
  }

  document.getElementById("export-btn").addEventListener("click", async () => {
    const btn = document.getElementById("export-btn");
    btn.disabled = true; btn.textContent = "Exporting…";
    try {
      const dump = await apiGet("backup.export", {});
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inam-tech-zone-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Backup downloaded", "success");
    } catch (e) { toastError(e); }
    finally { btn.disabled = false; btn.textContent = "Download backup (JSON)"; }
  });

  document.getElementById("fix-images-btn").addEventListener("click", async () => {
    const btn = document.getElementById("fix-images-btn");
    btn.disabled = true; btn.textContent = "Fixing…";
    try {
      const result = await apiPost("products.fixImageUrls", {});
      toast(result.fixed > 0 ? `Fixed images on ${result.fixed} product(s)` : "No products needed fixing — all image URLs are already up to date", "success");
      if (result.errors && result.errors.length) console.warn("Fix errors:", result.errors);
    } catch (e) { toastError(e); }
    finally { btn.disabled = false; btn.textContent = "Fix broken image previews"; }
  });
});
