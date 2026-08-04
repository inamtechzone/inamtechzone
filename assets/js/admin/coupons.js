async function loadCoupons() {
  document.getElementById("coupons-body").innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>`;
  try {
    const coupons = await apiGet("coupons.list", {});
    document.getElementById("coupons-body").innerHTML = coupons.length ? coupons.map((c) => `
      <tr>
        <td style="font-family:var(--font-mono);font-weight:700">${escapeHtml(c.code)}</td>
        <td>${c.type === "percent" ? c.value + "%" : formatMoney(c.value)}</td>
        <td>${c.minOrderAmount ? formatMoney(c.minOrderAmount) : "—"}</td>
        <td>${c.usedCount || 0}${c.usageLimit ? " / " + c.usageLimit : ""}</td>
        <td>${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "No expiry"}</td>
        <td><span class="badge-pill">${c.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="toggleCouponStatus('${c.id}','${c.status}')">${c.status === "Disabled" ? "Enable" : "Disable"}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCoupon('${c.id}','${escapeHtml(c.code)}')">Delete</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No coupons yet.</td></tr>`;
  } catch (e) { toastError(e); }
}

async function toggleCouponStatus(id, currentStatus) {
  try { await apiPost("coupons.update", { id: id, status: currentStatus === "Disabled" ? "Active" : "Disabled" }); loadCoupons(); }
  catch (e) { toastError(e); }
}

async function deleteCoupon(id, code) {
  if (!confirm(`Delete coupon "${code}"?`)) return;
  try { await apiPost("coupons.delete", { id: id }); toast("Coupon deleted", "success"); loadCoupons(); }
  catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("coupons");
  loadCoupons();

  document.getElementById("coupon-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await apiPost("coupons.create", {
        code: form.code.value, type: form.type.value, value: Number(form.value.value),
        minOrderAmount: Number(form.minOrderAmount.value || 0),
        maxDiscount: form.maxDiscount.value ? Number(form.maxDiscount.value) : "",
        usageLimit: form.usageLimit.value ? Number(form.usageLimit.value) : "",
        expiresAt: form.expiresAt.value ? new Date(form.expiresAt.value).toISOString() : "",
      });
      toast("Coupon created", "success");
      form.reset();
      loadCoupons();
    } catch (err) { toastError(err); }
  });
});
