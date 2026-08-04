const SOURCE_LABELS = { google: "Google", facebook: "Facebook", whatsapp: "WhatsApp", instagram: "Instagram", telegram: "Telegram", linkedin: "LinkedIn", x: "X (Twitter)", direct: "Direct" };
const TYPE_LABELS = { pageview: "Page views", whatsapp_click: "WhatsApp clicks", call_click: "Call clicks", checkout: "Checkouts" };

async function loadAnalytics() {
  const days = document.getElementById("days-select").value;
  try {
    const data = await apiGet("leads.summary", { days: days });

    document.getElementById("stat-total-events").textContent = data.totalEvents;
    document.getElementById("stat-whatsapp-clicks").textContent = data.byType.whatsapp_click || 0;
    document.getElementById("stat-call-clicks").textContent = data.byType.call_click || 0;
    document.getElementById("stat-checkouts").textContent = data.byType.checkout || 0;

    document.getElementById("source-body").innerHTML = Object.keys(data.bySource)
      .sort((a, b) => data.bySource[b] - data.bySource[a])
      .map((s) => `<tr><td>${SOURCE_LABELS[s] || s}</td><td>${data.bySource[s]}</td></tr>`).join("");

    document.getElementById("viewed-body").innerHTML = data.topViewedProducts.length
      ? data.topViewedProducts.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.views}</td></tr>`).join("")
      : `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:16px">No page views recorded yet.</td></tr>`;

    document.getElementById("campaign-body").innerHTML = data.campaigns.length
      ? data.campaigns.map((c) => `<tr><td>${escapeHtml(c.campaign)}</td><td>${c.events}</td></tr>`).join("")
      : `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:16px">No UTM campaigns recorded yet — add ?utm_campaign=... to your ad links.</td></tr>`;
  } catch (e) { toastError(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminLayout("analytics");
  loadAnalytics();
  document.getElementById("days-select").addEventListener("change", loadAnalytics);
});
