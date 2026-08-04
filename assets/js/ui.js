/**
 * ui.js
 * Small shared UI helpers: toasts, escaping, currency/date formatting,
 * loading/skeleton rendering. No framework — plain DOM.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(amount) {
  const currency = (window.ITZ_SETTINGS && window.ITZ_SETTINGS.currency) || ITZ.CURRENCY;
  return currency + " " + Number(amount || 0).toLocaleString();
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

let toastTimer;
function toast(message, type) {
  let el = document.getElementById("itz-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "itz-toast";
    el.className = "itz-toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "itz-toast show " + (type === "error" ? "error" : type === "success" ? "success" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "itz-toast"; }, 3200);
}

function toastError(err) {
  toast(err && err.message ? err.message : "Something went wrong", "error");
}

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function skeletonCards(count) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += '<div class="skeleton-card"><div class="skeleton skeleton-thumb"></div>' +
      '<div class="skeleton skeleton-line" style="width:80%"></div>' +
      '<div class="skeleton skeleton-line" style="width:50%"></div>' +
      '<div class="skeleton skeleton-line" style="width:40%"></div></div>';
  }
  return html;
}

function paginationHtml(page, pages, onClickAttr) {
  if (pages <= 1) return "";
  let html = '<div class="pagination">';
  html += `<button ${page <= 1 ? "disabled" : ""} data-page="${page - 1}" ${onClickAttr}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="${i === page ? "active" : ""}" data-page="${i}" ${onClickAttr}>${i}</button>`;
  }
  html += `<button ${page >= pages ? "disabled" : ""} data-page="${page + 1}" ${onClickAttr}>›</button>`;
  html += "</div>";
  return html;
}

// Basic client-side debounce for search inputs.
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay || 400);
  };
}

// Applies dark mode from localStorage on page load.
(function initTheme() {
  const saved = localStorage.getItem("itz_theme");
  if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
})();

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("itz_theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("itz_theme", "dark");
  }
}
