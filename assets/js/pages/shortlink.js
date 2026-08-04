/**
 * pages/shortlink.js — logic for shortlink.html (/p/{code} smart links)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const match = window.location.pathname.match(/^\/p\/([^/]+)\/?$/);
  const code = match ? match[1] : new URL(window.location.href).searchParams.get("code");

  if (!code) { window.location.href = "/shop.html"; return; }

  try {
    const data = await apiGet("products.resolveShortCode", { code: code });
    trackEvent("pageview", { productId: data.id, landingPage: window.location.pathname });
    window.location.replace(data.path);
  } catch (e) {
    document.getElementById("shortlink-root").innerHTML = `
      <div class="empty-state">
        <h3>Link not found</h3>
        <p>This link may have expired or the product may no longer be available.</p>
        <a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Browse products</a>
      </div>`;
  }
});
