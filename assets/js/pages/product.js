/**
 * pages/product.js — logic for product.html
 * Reached two ways:
 *  - New clean URL: /collections/{category}/products/{handle}  (via vercel.json rewrite)
 *  - Legacy URL:    /product.html?slug={handle}  (still works — old shared links,
 *                    QR codes, and social posts keep resolving; once the product
 *                    loads we soft-redirect the address bar to the canonical URL)
 */

let currentProduct = null;
let activeImageIndex = 0;

// Returns the product handle regardless of which URL shape got us here.
function resolveHandleFromLocation_() {
  const match = window.location.pathname.match(/^\/collections\/([^/]+)\/products\/([^/]+)\/?$/);
  if (match) return { handle: decodeURIComponent(match[2]), categoryFromPath: decodeURIComponent(match[1]), isCleanUrl: true };
  const legacy = new URL(window.location.href).searchParams.get("slug")
    || new URL(window.location.href).searchParams.get("id");
  return { handle: legacy, categoryFromPath: null, isCleanUrl: false };
}

function renderGallery(product) {
  const images = product.images && product.images.length ? product.images : [""];
  document.getElementById("gallery-thumbs").innerHTML = images.map((img, i) => `
    <div class="gallery-thumb ${i === activeImageIndex ? "active" : ""}" onclick="setActiveImage(${i})">
      <img src="${escapeHtml(cdnUrl(img, { width: 120 }))}" alt="${escapeHtml(product.name)} ${i + 1}">
    </div>`).join("");
  document.getElementById("gallery-main-img").src = cdnUrl(images[activeImageIndex], { width: 800 }) || "";
}

function setActiveImage(i) {
  activeImageIndex = i;
  renderGallery(currentProduct);
}

function toggleZoom() {
  document.getElementById("gallery-main").classList.toggle("zoomed");
}

function changeQty(delta) {
  const input = document.getElementById("qty-input");
  const next = Math.max(1, Math.min((currentProduct.stock || 99), Number(input.value) + delta));
  input.value = next;
}

async function loadReviews(productId) {
  try {
    const data = await apiGet("reviews.list", { productId: productId });
    document.getElementById("review-summary").innerHTML = data.count
      ? `<span class="rating-stars">${"★".repeat(Math.round(data.average))}${"☆".repeat(5 - Math.round(data.average))}</span> ${data.average} out of 5 (${data.count} review${data.count > 1 ? "s" : ""})`
      : "No reviews yet — be the first!";
    document.getElementById("review-list").innerHTML = data.reviews.map((r) => `
      <div class="review-card">
        <div class="name">${escapeHtml(r.customerName)}</div>
        <div class="rating-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
        <p style="color:var(--muted);font-size:13.5px;margin:6px 0 0">${escapeHtml(r.comment || "")}</p>
      </div>`).join("");
  } catch (e) { /* non-fatal */ }
}

// Updates <title>, meta description, canonical, Open Graph, Twitter Card, and
// injects JSON-LD structured data for the currently-loaded product.
//
// IMPORTANT SCOPE NOTE: this runs client-side, after the page's JS has
// executed. Googlebot renders JavaScript, so this genuinely helps Google SEO.
// WhatsApp, Facebook, and most other link-preview scrapers do NOT execute
// JavaScript — they only read the raw HTML Vercel serves. That's exactly why
// this project also ships scripts/generate-seo.js: a build-time script that
// pre-renders real static HTML (with these same tags already baked in) at
// /collections/{category}/products/{handle}/index.html. Run it after every
// product change (see README) so social previews stay accurate. This
// function still runs on top of that prerendered page once JS loads, keeping
// price/stock/description current between rebuilds.
function applyProductSeo_(product) {
  const s = window.ITZ_SETTINGS || {};
  const site = (s.siteUrl || "").replace(/\/$/, "");
  const url = site + product.canonicalPath;
  const title = product.seoTitle || `${product.name} — ${s.storeName || "INAM TECH ZONE"}`;
  const description = product.seoDescription || (product.description || "").slice(0, 160);
  const image = product.images && product.images[0] ? product.images[0] : (s.logo || "");
  const price = product.discountPrice || product.price;

  document.title = title;
  setMeta_('meta[name="description"]', description);
  setLink_('link[rel="canonical"]', url);
  setMeta_('meta[property="og:type"]', "product", "property");
  setMeta_('meta[property="og:title"]', title, "property");
  setMeta_('meta[property="og:description"]', description, "property");
  setMeta_('meta[property="og:url"]', url, "property");
  setMeta_('meta[property="og:image"]', product.ogImage || image, "property");
  setMeta_('meta[name="twitter:card"]', "summary_large_image");
  setMeta_('meta[name="twitter:title"]', title);
  setMeta_('meta[name="twitter:description"]', description);
  setMeta_('meta[name="twitter:image"]', product.ogImage || image);
  setMeta_('meta[name="robots"]', product.status === "Disabled" ? "noindex,nofollow" : "index,follow");

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Product",
      name: product.name, description: description, sku: product.sku,
      image: product.images, brand: { "@type": "Brand", name: product.brand || s.storeName },
      offers: {
        "@type": "Offer", url: url, priceCurrency: "PKR", price: price,
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site + "/" },
        { "@type": "ListItem", position: 2, name: product.category, item: site + "/collections/" + product.categoryHandle },
        { "@type": "ListItem", position: 3, name: product.name, item: url },
      ],
    },
  ];
  injectJsonLd_(jsonLd);
}

function setMeta_(selector, content, attr) {
  attr = attr || "name";
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const name = selector.match(/"([^"]+)"/)[1];
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink_(selector, href) {
  let el = document.querySelector(selector);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

function injectJsonLd_(objects) {
  qsa('script[type="application/ld+json"][data-dynamic]').forEach((el) => el.remove());
  objects.forEach((obj) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-dynamic", "1");
    script.textContent = JSON.stringify(obj);
    document.head.appendChild(script);
  });
}

async function loadProduct() {
  const { handle, isCleanUrl } = resolveHandleFromLocation_();
  if (!handle) { window.location.href = "/shop.html"; return; }

  try {
    const product = await apiGet("products.get", { id: handle });
    currentProduct = product;
    pushRecentlyViewed(product.id);

    // Legacy /product.html?slug=... links land on the canonical clean URL from
    // here on, without breaking the link that was just clicked.
    if (!isCleanUrl && product.canonicalPath && product.canonicalPath.startsWith("/collections/")) {
      window.history.replaceState({}, "", product.canonicalPath);
    }

    applyProductSeo_(product);
    trackEvent("pageview", { productId: product.id, landingPage: window.location.pathname });
    renderGallery(product);

    document.getElementById("product-stock").outerHTML = `<span id="product-stock" class="stock-badge ${product.stock > 0 ? "in" : "out"}">${product.stock > 0 ? "In stock · " + product.stock + " available" : "Out of stock"}</span>`;
    document.getElementById("product-name").textContent = product.name;
    document.getElementById("product-sku").textContent = "SKU " + product.sku;
    document.getElementById("product-category").textContent = product.category;
    const brandEl = document.getElementById("product-brand-wrap");
    if (product.brand) { brandEl.style.display = "inline"; document.getElementById("product-brand").textContent = product.brand; }
    else brandEl.style.display = "none";

    const hasDiscount = product.discountPrice && product.discountPrice < product.price;
    document.getElementById("product-price").textContent = formatMoney(hasDiscount ? product.discountPrice : product.price);
    const oldPriceEl = document.getElementById("product-price-old");
    if (hasDiscount) { oldPriceEl.style.display = "inline"; oldPriceEl.textContent = formatMoney(product.price); }
    else oldPriceEl.style.display = "none";

    document.getElementById("product-description").textContent = product.description;

    if (product.specifications && product.specifications.length) {
      document.getElementById("spec-table-wrap").style.display = "block";
      document.getElementById("spec-table").innerHTML = product.specifications.map((s) =>
        `<tr><td style="font-weight:600;padding:6px 10px;border-bottom:1px solid var(--line)">${escapeHtml(s.key)}</td><td style="padding:6px 10px;border-bottom:1px solid var(--line);color:var(--muted)">${escapeHtml(s.value)}</td></tr>`
      ).join("");
    }

    document.getElementById("qty-input").value = 1;
    document.getElementById("qty-input").max = product.stock;
    document.getElementById("add-cart-btn").disabled = product.stock === 0;
    document.getElementById("buy-now-btn").disabled = product.stock === 0;

    const wishBtn = document.getElementById("wishlist-toggle-btn");
    wishBtn.classList.toggle("active", isWishlisted(product.id));
    wishBtn.textContent = isWishlisted(product.id) ? "♥ Wishlisted" : "♡ Add to wishlist";

    const whatsappNumber = (window.ITZ_SETTINGS && window.ITZ_SETTINGS.whatsappNumber) || ITZ.WHATSAPP_NUMBER;
    document.getElementById("whatsapp-ask-btn").href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi, I'm interested in "${product.name}" (${formatMoney(hasDiscount ? product.discountPrice : product.price)}). Is it available?`)}`;

    const contactPhone = (window.ITZ_SETTINGS && window.ITZ_SETTINGS.contactPhone) || "";
    const callBtn = document.getElementById("call-btn");
    if (contactPhone) { callBtn.href = `tel:${contactPhone.replace(/\s+/g, "")}`; callBtn.style.display = "inline-flex"; }

    const compareBtn = document.getElementById("compare-toggle-btn");
    compareBtn.classList.toggle("active", isInCompare(product.id));
    compareBtn.textContent = isInCompare(product.id) ? "✓ In compare" : "⇄ Compare";

    const s = window.ITZ_SETTINGS || {};
    const shareUrl = product.shortCode
      ? `${(s.siteUrl || window.location.origin).replace(/\/$/, "")}/p/${product.shortCode}`
      : window.location.href;
    renderShareButtons("share-buttons", product, shareUrl);

    if (product.related && product.related.length) {
      document.getElementById("related-section").style.display = "block";
      document.getElementById("related-grid").innerHTML = product.related.map(productCardHtml).join("");
    }

    const recent = getRecentlyViewed().filter((id) => id !== product.id);
    if (recent.length) {
      document.getElementById("recent-section").style.display = "block";
      Promise.all(recent.slice(0, 4).map((id) => apiGet("products.get", { id: id }).catch(() => null)))
        .then((items) => {
          document.getElementById("recent-grid").innerHTML = items.filter(Boolean).map(productCardHtml).join("");
        });
    }

    loadReviews(product.id);
  } catch (e) {
    document.getElementById("product-root").innerHTML = `<div class="empty-state"><h3>Product not found</h3><a href="/shop.html" class="btn btn-primary" style="margin-top:12px">Back to shop</a></div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();

  document.getElementById("qty-minus").addEventListener("click", () => changeQty(-1));
  document.getElementById("qty-plus").addEventListener("click", () => changeQty(1));
  document.getElementById("gallery-main").addEventListener("click", toggleZoom);

  document.getElementById("add-cart-btn").addEventListener("click", () => {
    addToCart(currentProduct, Number(document.getElementById("qty-input").value));
    toast(`Added ${document.getElementById("qty-input").value} × ${currentProduct.name} to cart`, "success");
  });

  document.getElementById("buy-now-btn").addEventListener("click", () => {
    addToCart(currentProduct, Number(document.getElementById("qty-input").value));
    window.location.href = "/checkout.html";
  });

  document.getElementById("wishlist-toggle-btn").addEventListener("click", (e) => {
    const active = toggleWishlist(currentProduct.id);
    e.target.classList.toggle("active", active);
    e.target.textContent = active ? "♥ Wishlisted" : "♡ Add to wishlist";
  });

  document.getElementById("compare-toggle-btn").addEventListener("click", (e) => {
    const active = toggleCompare(currentProduct.id);
    e.target.classList.toggle("active", active);
    e.target.textContent = active ? "✓ In compare" : "⇄ Compare";
    toast(active ? "Added to comparison" : "Removed from comparison");
  });

  document.getElementById("whatsapp-ask-btn").addEventListener("click", () => {
    trackEvent("whatsapp_click", { productId: currentProduct.id, landingPage: window.location.pathname });
  });
  document.getElementById("call-btn").addEventListener("click", () => {
    trackEvent("call_click", { productId: currentProduct.id, landingPage: window.location.pathname });
  });

  document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await apiPost("reviews.create", {
        productId: currentProduct.id,
        customerName: form.customerName.value,
        phone: form.phone.value,
        rating: Number(form.rating.value),
        comment: form.comment.value,
      });
      toast("Thanks! Your review will appear after moderation.", "success");
      form.reset();
    } catch (err) { toastError(err); }
  });
});
