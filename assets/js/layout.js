// --- CENTRAL LAYOUT & THEME LOGIC ---

// 1. Theme Management (Default Light/White)
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    document.body.classList.add("light-mode");
    document.body.classList.remove("dark-mode");
  }
  localStorage.setItem("theme", theme);
  updateThemeButtonUI(theme);
}

function toggleTheme() {
  const currentTheme = localStorage.getItem("theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(newTheme);
}

function updateThemeButtonUI(theme) {
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) {
    // Light mode mein Sun icon, Dark mode mein Moon icon
    btn.innerHTML = theme === "dark" ? "🌙 Dark" : "☀️ Light";
  }
}

// 2. Render Header (Same for all pages)
function renderHeader() {
  const el = document.getElementById("site-header");
  if (!el) return;

  el.innerHTML = `
    <header class="navbar">
      <div class="container navbar-inner">
        <a href="/index.html" class="brand">INAM<span class="accent-dot">.</span>TECH ZONE</a>
        
        <div class="nav-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="live-search-input" placeholder="Search products or category…" autocomplete="off" />
          <div id="live-search-results" class="live-search-results" style="display:none"></div>
        </div>

        <nav class="nav-links">
          <a href="/shop.html" data-i18n="nav.shop">Shop</a>
          <a href="/track-order.html" data-i18n="nav.trackOrder">Track Order</a>
          <a href="/wishlist.html" data-i18n="nav.wishlist">Wishlist</a>
          <a href="/index.html#contact" data-i18n="nav.contact">Contact</a>
        </nav>

        <div style="display:flex;align-items:center;gap:10px">
          <select id="lang-select" class="icon-pill">
            <option value="en">EN</option>
            <option value="ur">اردو</option>
            <option value="ar">عربي</option>
          </select>

          <!-- Light / Dark Mode Button -->
          <button id="theme-toggle-btn" class="icon-pill" onclick="toggleTheme()" title="Toggle Light/Dark Mode">☀️ Light</button>

          <a href="/cart.html" class="icon-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span data-i18n="nav.cart">Cart</span> <span class="cart-badge">0</span>
          </a>

          <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>

      <div id="mobile-menu" class="container" style="display:none;padding-bottom:16px">
        <div style="display:flex;flex-direction:column;gap:10px">
          <a href="/shop.html">Shop</a>
          <a href="/track-order.html">Track Order</a>
          <a href="/wishlist.html">Wishlist</a>
          <a href="/index.html#contact">Contact</a>
        </div>
      </div>
    </header>`;

  // Language Change Listener
  const langSelect = document.getElementById("lang-select");
  if (langSelect && typeof currentLanguage === "function") {
    langSelect.value = currentLanguage();
    langSelect.addEventListener("change", (e) => {
      if (typeof setLanguage === "function") setLanguage(e.target.value);
    });
  }

  // Mobile Menu Toggle Listener
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener("click", () => {
      mobileMenu.style.display = mobileMenu.style.display === "none" ? "block" : "none";
    });
  }

  // Live Search Logic
  const input = document.getElementById("live-search-input");
  const resultsBox = document.getElementById("live-search-results");
  if (input && resultsBox) {
    input.addEventListener("input", async () => {
      const q = input.value.trim();
      if (!q) { resultsBox.style.display = "none"; return; }
      try {
        if (typeof apiGet === "function") {
          const data = await apiGet("products.list", { search: q, limit: 6 });
          if (!data || !data.items || !data.items.length) {
            resultsBox.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--muted)">No matches found</div>';
          } else {
            const esc = typeof escapeHtml === "function" ? escapeHtml : (str) => str || "";
            const fmt = typeof formatMoney === "function" ? formatMoney : (val) => "Rs. " + val;
            resultsBox.innerHTML = data.items.map((p) => `
              <a class="live-search-item" href="/product.html?slug=${encodeURIComponent(p.slug)}" style="display:flex;align-items:center;gap:10px;padding:8px;text-decoration:none;">
                <img src="${esc((p.images && p.images[0]) || "")}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:4px;" />
                <div>
                  <div style="font-weight:600;font-size:13.5px">${esc(p.name)}</div>
                  <div style="font-size:12px;color:var(--muted)">${fmt(p.discountPrice || p.price)}</div>
                </div>
              </a>`).join("");
          }
          resultsBox.style.display = "block";
        }
      } catch (e) {}
    });

    document.addEventListener("click", (e) => {
      if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.style.display = "none";
    });
  }

  // Update button text after render
  const currentTheme = localStorage.getItem("theme") || "light";
  updateThemeButtonUI(currentTheme);
}

// 3. Render Footer (Same for all pages)
function renderFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;

  const s = window.ITZ_SETTINGS || {};
  const globalITZ = window.ITZ || {};
  const esc = typeof escapeHtml === "function" ? escapeHtml : (str) => str || "";

  const whatsappNum = s.whatsappNumber || globalITZ.WHATSAPP_NUMBER || "923000000000";
  const contactEmail = s.contactEmail || "support@inamtechzone.com";
  const storeName = s.storeName || globalITZ.STORE_NAME || "INAM TECH ZONE";

  el.innerHTML = `
    <footer class="footer" id="contact">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand">INAM<span style="color:var(--amber,#f59e0b)">.</span>TECH ZONE</div>
            <p style="font-size:13.5px;margin-top:10px;max-width:320px;line-height:1.6">
              Quality electronics and gadgets, sourced and stocked with care. Fast local delivery and
              straightforward order tracking, every time.
            </p>
            <form id="newsletter-form" style="display:flex;gap:8px;margin-top:16px;max-width:320px">
              <input type="email" required placeholder="Your email" style="flex:1;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;border-radius:8px;padding:9px 12px;font-size:13.5px" />
              <button class="btn btn-secondary btn-sm" type="submit">Join</button>
            </form>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="/shop.html">All Products</a>
            <a href="/track-order.html">Track Order</a>
            <a href="/cart.html">Cart</a>
          </div>
          <div>
            <h4>Get in touch</h4>
            <a href="https://wa.me/${esc(whatsappNum)}" target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a>
            <a href="/admin/login.html">Admin Login</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${esc(storeName)}. <span data-i18n="footer.rights">All rights reserved.</span></span>
          <span>Built for fast, friendly local shopping.</span>
        </div>
      </div>
    </footer>`;
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  initTheme(); // Always starts with White/Light by default unless user changed it
  try {
    if (typeof apiGet === "function") window.ITZ_SETTINGS = await apiGet("settings.get", {});
  } catch (e) { window.ITZ_SETTINGS = {}; }

  renderHeader();
  renderFooter();
  if (typeof applyTranslations === "function") applyTranslations();
});
