let activityPage = 1;

async function loadActivityLog() {
  document.getElementById("activity-body").innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const data = await apiGet("activitylog.list", { page: activityPage, limit: 30 });
    document.getElementById("activity-body").innerHTML = data.items.length ? data.items.map((a) => `
      <tr>
        <td>${formatDate(a.createdAt)}</td>
        <td>${escapeHtml(a.adminName || "System")}</td>
        <td>${escapeHtml(a.action)}</td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted)">${escapeHtml(a.details || "")}</td>
      </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No activity yet.</td></tr>`;
    document.getElementById("activity-pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="activityPage=Number(this.dataset.page);loadActivityLog()"');
  } catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("activity");
  loadActivityLog();
});
