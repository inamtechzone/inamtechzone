async function loadReviewsAdmin() {
  document.getElementById("reviews-body").innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const data = await apiGet("reviews.list", {});
    const reviews = data.reviews;
    document.getElementById("reviews-body").innerHTML = reviews.length ? reviews.map((r) => `
      <tr>
        <td>${escapeHtml(r.customerName)}</td>
        <td><span class="rating-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></td>
        <td style="max-width:280px">${escapeHtml(r.comment || "")}</td>
        <td>${formatDate(r.createdAt)}</td>
        <td><span class="badge-pill">${r.status}</span></td>
        <td style="display:flex;gap:6px">
          ${r.status !== "Approved" ? `<button class="btn btn-outline btn-sm" onclick="moderateReview('${r.id}','Approved')">Approve</button>` : ""}
          ${r.status !== "Rejected" ? `<button class="btn btn-outline btn-sm" onclick="moderateReview('${r.id}','Rejected')">Reject</button>` : ""}
          <button class="btn btn-danger btn-sm" onclick="deleteReview('${r.id}')">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No reviews yet.</td></tr>`;
  } catch (e) { toastError(e); }
}

async function moderateReview(id, status) {
  try { await apiPost("reviews.moderate", { id: id, status: status }); toast("Review " + status.toLowerCase(), "success"); loadReviewsAdmin(); }
  catch (e) { toastError(e); }
}

async function deleteReview(id) {
  if (!confirm("Delete this review?")) return;
  try { await apiPost("reviews.delete", { id: id }); toast("Review deleted", "success"); loadReviewsAdmin(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("reviews");
  loadReviewsAdmin();
});
