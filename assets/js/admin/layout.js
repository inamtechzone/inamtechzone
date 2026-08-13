/**
 * admin/layout.js
 * Shared admin sidebar/shell. Every admin page (except login.html) includes
 * `<div id="admin-shell"><aside id="admin-sidebar"></aside><main id="admin-main">...</main></div>`
 * and calls `initAdminLayout('products')` (etc.) with the current nav key.
 */

const ADMIN_LINKS = [
  { key: "dashboard", label: "Dashboard", href: "/admin/index.html" },
  { key: "products", label: "Products", href: "/admin/products.html" },
  { key: "categories", label: "Categories", href: "/admin/categories.html" },
  { key: "brands", label: "Brands", href: "/admin/brands.html" },
  { key: "orders", label: "Orders", href: "/admin/orders.html" },
  { key: "customers", label: "Customers", href: "/admin/customers.html" },
  { key: "coupons", label: "Coupons", href: "/admin/coupons.html" },
  { key: "reviews", label: "Reviews", href: "/admin/reviews.html" },
  { key: "reports", label: "Reports", href: "/admin/reports.html" },
  { key: "analytics", label: "Analytics", href: "/admin/analytics.html" },
  { key: "admins", label: "Admin Users", href: "/admin/admins.html" },
  { key: "backup", label: "Backup", href: "/admin/backup.html" },
  { key: "activity", label: "Activity Logs", href: "/admin/activity-log.html" },
  { key: "settings", label: "Settings", href: "/admin/settings.html" },
];

function initAdminLayout(activeKey) {
  if (!requireAdminAuth()) return;
  const admin = getAdminInfo();

  document.getElementById("admin-sidebar").innerHTML = `
    <div class="brand" style="display:flex;justify-content:space-between;align-items:center">
      <span>INAM<span style="color:var(--amber)">.</span>ADMIN</span>
      <button id="notif-bell" style="position:relative;background:none;border:none;color:#fff;font-size:18px;cursor:pointer" title="Notifications">
        🔔<span id="notif-badge" style="display:none;position:absolute;top:-6px;right:-8px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;border-radius:999px;min-width:16px;height:16px;align-items:center;justify-content:center">0</span>
      </button>
    </div>
    <div id="notif-panel" style="display:none;background:rgba(255,255,255,0.06);border-radius:8px;padding:10px;margin-bottom:16px;font-size:12.5px;max-height:220px;overflow-y:auto"></div>
    <nav class="admin-nav">
      ${ADMIN_LINKS.filter((l) => l.key !== "admins" || admin.role === "SuperAdmin")
        .filter((l) => l.key !== "backup" || admin.role === "SuperAdmin")
        .map((l) => `<a href="${l.href}" class="${l.key === activeKey ? "active" : ""}">${l.label}</a>`).join("")}
    </nav>
    <div style="margin-top:26px;border-top:1px solid rgba(255,255,255,0.12);padding-top:16px">
      <div style="font-size:12.5px;color:#B9BEDA;margin-bottom:4px">${escapeHtml(admin.name)}</div>
      <div style="font-size:11.5px;color:#7C82A6;margin-bottom:10px;word-break:break-all">${escapeHtml(admin.email)} · ${escapeHtml(admin.role)}</div>
      <button class="btn btn-outline btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.3);width:100%" onclick="adminLogout()">Log out</button>
    </div>`;

  loadAdminNotifications_();
  document.getElementById("notif-bell").addEventListener("click", () => {
    const panel = document.getElementById("notif-panel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
}

async function loadAdminNotifications_() {
  try {
    const data = await apiGet("notifications.list", {});
    const badge = document.getElementById("notif-badge");
    const panel = document.getElementById("notif-panel");
    if (data.count > 0) { badge.style.display = "flex"; badge.textContent = data.count; }
    panel.innerHTML = data.notifications.length
      ? data.notifications.map((n) => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#DEE0FF">${escapeHtml(n.message)}</div>`).join("")
      : `<div style="color:#7C82A6">All clear — no notifications.</div>`;
  } catch (e) { /* notifications are best-effort, never block the page */ }
}
