// Header Component
class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="header">
        <div class="nav-container">
          <a href="/" class="nav-brand"><span class="brand-itz">ITZ</span> INAM TECH ZONE</a>
          <nav>
            <a href="/">Home</a>
            <a href="/shop.html">Products</a>
            <a href="/#contact">Contact</a>
          </nav>
        </div>
      </header>
    `;
  }
}
customElements.define('site-header', SiteHeader);

// Footer Component
class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="footer">
        <p>© INAM TECH ZONE. All Rights Reserved.</p>
      </footer>
    `;
  }
}
customElements.define('site-footer', SiteFooter);
