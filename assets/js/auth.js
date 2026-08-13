/**
 * auth.js
 * Admin session helpers shared by every admin/*.html page.
 */

function getAdminInfo() {
  try { return JSON.parse(localStorage.getItem("itz_admin_info") || "null"); } catch (e) { return null; }
}

function isAdminLoggedIn() { return !!itzToken() && !!getAdminInfo(); }

function requireAdminAuth() {
  if (!isAdminLoggedIn()) {
    window.location.href = "/admin/login.html";
    return false;
  }
  return true;
}

async function adminLogin(email, password) {
  const data = await apiPost("auth.login", { email: email, password: password });
  localStorage.setItem("itz_admin_token", data.token);
  localStorage.setItem("itz_admin_info", JSON.stringify(data.admin));
  return data.admin;
}

async function adminLogout() {
  try { await apiPost("auth.logout", {}); } catch (e) { /* ignore */ }
  localStorage.removeItem("itz_admin_token");
  localStorage.removeItem("itz_admin_info");
  window.location.href = "/admin/login.html";
}
