// --- FIX & IMPROVED LAYOUT SCRIPT ---

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
          <select id="lang-select" class="icon-pill" style="border:1.5px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer">
            <option value="en">EN</option>
            <option value="ur">اردو</option>
            <option value="ar">عربي</option>
          </select>

          <button class="icon-pill" onclick="typeof toggleTheme === 'function' && toggleTheme()" title="Toggle dark mode">🌓</button>

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
          <a href="/shop.html" data-i18n="nav.shop">Shop</a>
          <a href="/track-order.html" data-i18n="nav.trackOrder">Track Order</a>
          <a href="/wishlist.html" data-i18n="nav.wishlist">Wishlist</a>
          <a href="/index.html#contact" data-i18n="nav.contact">Contact</a>
        </div>
      </div>
    </header>`;

  // Language Dropdown Safe Handling
  const langSelect = document.getElementById("lang-select");
  if (langSelect && typeof currentLanguage === "function") {
    langSelect.value = currentLanguage();
    langSelect.addEventListener("change", (e) => {
      if (typeof setLanguage === "function") setLanguage(e.target.value);
    });
  }

  // Mobile Menu Toggle Fix
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener("click", () => {
      mobileMenu.style.display = mobileMenu.style.display === "none" ? "block" : "none";
    });
  }

  // Live Search Input Logic
  const input = document.getElementById("live-search-input");
  const resultsBox = document.getElementById("live-search-results");

  if (input && resultsBox) {
    const fnDebounce = typeof debounce === "function" ? debounce : (fn, ms) => setTimeout(fn, ms);

    input.addEventListener("input", fnDebounce(async () => {
      const q = input.value.trim();
      if (!q) { resultsBox.style.display = "none"; return; }

      try {
        if (typeof apiGet === "function") {
          const data = await apiGet("products.list", { search: q, limit: 6 });
          if (!data || !data.items || !data.items.length) {
            resultsBox.innerHTML = '<div class="live-search-item" style="padding:10px;font-size:13px;color:var(--muted)">No matches</div>';
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
      } catch (e) { /* silent search fail */ }
    }, 350));

    document.addEventListener("click", (e) => {
      if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.style.display = "none";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        window.location.href = "/shop.html?search=" + encodeURIComponent(input.value.trim());
      }
    });
  }

  if (typeof updateCartBadge === "function") updateCartBadge();
}

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

  const newsForm = document.getElementById("newsletter-form");
  if (newsForm) {
    newsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (typeof toast === "function") toast("Thanks for subscribing!", "success");
      e.target.reset();
    });
  }
}

function renderWhatsAppFab() {
  if (document.querySelector(".whatsapp-fab")) return; // اگر پہلے سے موجود ہے تو دوبارہ نہ بنائے

  const s = window.ITZ_SETTINGS || {};
  const globalITZ = window.ITZ || {};
  const number = s.whatsappNumber || globalITZ.WHATSAPP_NUMBER || "923000000000";

  const el = document.createElement("a");
  el.className = "whatsapp-fab";
  el.href = `https://wa.me/${number}?text=${encodeURIComponent("Hi INAM TECH ZONE, I have a question about your products.")}`;
  el.target = "_blank";
  el.rel = "noreferrer";
  el.setAttribute("aria-label", "Chat on WhatsApp");
  el.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0 0 12.03 4C7.5 4 3.82 7.65 3.82 12.15c0 1.44.38 2.85 1.1 4.09L3.75 20l3.86-1.01a8.84 8.84 0 0 0 4.42 1.19h.01c4.53 0 8.21-3.65 8.21-8.15a8.05 8.05 0 0 0-2.65-5.71ZM12.04 18.6a6.9 6.9 0 0 1-3.53-.97l-.25-.15-2.62.68.7-2.53-.16-.26a6.75 6.75 0 0 1-1.05-3.62c0-3.7 3.03-6.72 6.76-6.72a6.7 6.7 0 0 1 4.77 1.97 6.63 6.63 0 0 1 1.97 4.72c0 3.7-3.03 6.72-6.6 6.72Zm3.7-5.03c-.2-.1-1.18-.58-1.36-.65-.18-.07-.32-.1-.45.1-.13.2-.51.65-.63.78-.11.13-.23.15-.43.05-.2-.1-.85-.31-1.62-1-.6-.53-1-1.19-1.12-1.39-.12-.2-.01-.31.09-.4.09-.1.2-.24.3-.36.1-.12.13-.2.2-.34.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34h-.38c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66s.72 1.93.82 2.06c.1.13 1.4 2.15 3.4 3.01.48.2.85.33 1.14.42.48.15.91.13 1.26.08.38-.06 1.18-.48 1.35-.95.16-.46.16-.86.11-.95-.05-.09-.18-.14-.38-.24Z"/></svg>';

  document.body.appendChild(el);
}

async function initLayout() {
  try {
    if (typeof apiGet === "function") {
      window.ITZ_SETTINGS = await apiGet("settings.get", {});
    }
  } catch (e) {
    window.ITZ_SETTINGS = {};
  }

  renderHeader();
  renderFooter();
  renderWhatsAppFab();

  if (typeof applyTranslations === "function") applyTranslations();
}

document.addEventListener("DOMContentLoaded", initLayout);
