// ==========================================
// 1. Theme Engine (Loads instantly to prevent theme flash)
// ==========================================
const savedTheme = localStorage.getItem("app-theme") || "dark";
applyTheme(savedTheme);

// Ensure body class is synchronized once DOM is available
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => applyTheme(savedTheme));
} else {
  applyTheme(savedTheme);
}

// Security Helper: Inline Safe HTML Sanitizer (XSS Protection)
function safeSanitize(str) {
  if (typeof escapeHtml === "function") return escapeHtml(str);
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 2. Parallel Layout Loader with HTML Caching
// ==========================================
const LAYOUT_CACHE_TTL = 30 * 60 * 1000; // 30 Minutes Cache

async function fetchPartial(url) {
  const cacheKey = `itz_tpl_${url}`;
  const cacheTimeKey = `${cacheKey}_time`;
  const cachedHtml = localStorage.getItem(cacheKey);
  const cacheTime = localStorage.getItem(cacheTimeKey);

  // Return instantly from cache if valid
  if (cachedHtml && cacheTime && (Date.now() - parseInt(cacheTime, 10) < LAYOUT_CACHE_TTL)) {
    return cachedHtml;
  }

  // Fetch fresh if no valid cache
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url}`);
    const html = await res.text();
    
    localStorage.setItem(cacheKey, html);
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    return html;
  } catch (err) {
    console.error("Layout Fetch Error:", err);
    return cachedHtml || ""; // Fallback to stale cache if request fails
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const headerContainer = document.getElementById("site-header");
  const footerContainer = document.getElementById("site-footer");
  const tasks = [];

  // Load Header
  if (headerContainer) {
    tasks.push(
      fetchPartial("/components/header.html").then((html) => {
        if (html) {
          headerContainer.innerHTML = html;
          initThemeToggle();
          initCategoriesDropdown(); // Initialize nav items instantly after header injection
        }
      })
    );
  }

  // Load Footer
  if (footerContainer) {
    tasks.push(
      fetchPartial("/components/footer.html").then((html) => {
        if (html) footerContainer.innerHTML = html;
      })
    );
  }

  // Execute all layout fetches in parallel
  await Promise.all(tasks);
});

// ==========================================
// 3. Products / Categories Dropdown Engine (Cached & CDN Optimized)
// ==========================================
async function initCategoriesDropdown() {
  const container = document.getElementById("nav-categories-dropdown");
  if (!container) return;

  try {
    if (typeof apiGet === "function") {
      const cacheKey = "itz_nav_categories_cache";
      const cacheTimeKey = `${cacheKey}_time`;
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(cacheTimeKey);
      let categories = null;

      // Check Cache First
      if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime, 10) < LAYOUT_CACHE_TTL)) {
        try {
          categories = JSON.parse(cachedData);
        } catch (e) {
          categories = null; // Clear on corrupted cache JSON
        }
      }

      // Fetch Fresh API if no cache
      if (!categories) {
        categories = await apiGet("categories.list", {});
        if (Array.isArray(categories) && categories.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify(categories));
          localStorage.setItem(cacheTimeKey, Date.now().toString());
        }
      }

      // Render Dropdown
      if (Array.isArray(categories) && categories.length > 0) {
        container.innerHTML = categories.map((cat) => {
          let imgUrl = cat.icon || cat.image || "";
          
          // Image CDN Optimization (WebP + 50px Tiny Size)
          if (imgUrl && !imgUrl.startsWith("data:") && !imgUrl.startsWith("blob:")) {
            imgUrl = `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}&w=50&q=80&output=webp&il`;
          }

          const safeId = encodeURIComponent(cat.id || "");
          const safeName = safeSanitize(cat.name);
          const safeImg = safeSanitize(imgUrl);

          return `
            <a href="/shop.html?category=${safeId}" class="dropdown-item-link">
              ${
                safeImg 
                  ? `<img src="${safeImg}" alt="${safeName}" loading="lazy" onerror="this.onerror=null; this.replaceWith('📦');">` 
                  : "📦"
              }
              <span>${safeName}</span>
            </a>
          `;
        }).join("");
        return;
      }
    }
    container.innerHTML = `<div class="dropdown-loader">No products found</div>`;
  } catch (err) {
    console.error("Products dropdown error:", err);
    container.innerHTML = `<div class="dropdown-loader" style="color:var(--danger, #ef4444)">Failed to load products</div>`;
  }
}

// ==========================================
// 4. Theme Switcher Engine
// ==========================================
function initThemeToggle() {
  const themeBtn = document.getElementById("themeBtn");
  if (!themeBtn) return;

  updateThemeIcon(localStorage.getItem("app-theme") || "dark");

  // Remove existing listeners to avoid duplicates if header re-renders
  themeBtn.onclick = () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    applyTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
  };
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
  
  if (document.body) {
    document.body.classList.toggle("light-mode", isLight);
  }
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById("themeIcon");
  if (!themeIcon) return;

  if (theme === "light") {
    themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  } else {
    themeIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  }
}
// Automatically Highlight Active Page Link
function highlightActivePage() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-item, .mobile-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && (href === currentPath || (currentPath === "/" && href === "/index.html"))) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// Call after header injection
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(highlightActivePage, 100);
});