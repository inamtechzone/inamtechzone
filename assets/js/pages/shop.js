/**
 * pages/shop.js — logic for shop.html
 */

let currentPage = 1;

function readParams() {
  const url = new URL(window.location.href);
  const pathMatch = window.location.pathname.match(/^\/collections\/([^/]+)\/?$/);
  return {
    search: url.searchParams.get("search") || "",
    category: (pathMatch ? decodeURIComponent(pathMatch[1]) : url.searchParams.get("category")) || "",
    brand: url.searchParams.get("brand") || "",
    featured: url.searchParams.get("featured") || "",
    bestSeller: url.searchParams.get("bestSeller") || "",
    newArrival: url.searchParams.get("newArrival") || "",
    flashSale: url.searchParams.get("flashSale") || "",
    sort: url.searchParams.get("sort") || "newest",
    page: Number(url.searchParams.get("page")) || 1,
  };
}

function setParam(key, value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  url.searchParams.delete("page");
  window.history.pushState({}, "", url);
  loadShop();
}

async function loadShop() {
  const params = readParams();
  document.getElementById("shop-grid").innerHTML = skeletonCards(8);
  document.getElementById("min-price").value = params.minPrice || "";
  document.getElementById("max-price").value = params.maxPrice || "";
  document.getElementById("sort-select").value = params.sort;

  try {
    const data = await apiGet("products.list", Object.assign({}, params, {
      minPrice: qs("#min-price").value, maxPrice: qs("#max-price").value,
      inStock: qs("#in-stock-check").checked ? "true" : "", limit: 12,
    }));

    document.getElementById("result-count").textContent = data.total + " products";

    document.getElementById("category-chips").innerHTML =
      `<button class="chip ${!params.category ? "active" : ""}" onclick="setParam('category','')">All categories</button>` +
      data.categories.map((c) => `<button class="chip ${params.category === c.slug ? "active" : ""}" onclick="setParam('category','${c.slug}')">${escapeHtml(c.name)}</button>`).join("");

    document.getElementById("brand-chips").innerHTML =
      `<button class="chip ${!params.brand ? "active" : ""}" onclick="setParam('brand','')">All brands</button>` +
      data.brands.map((b) => `<button class="chip ${params.brand === b.slug ? "active" : ""}" onclick="setParam('brand','${b.slug}')">${escapeHtml(b.name)}</button>`).join("");

    document.getElementById("shop-grid").innerHTML = data.items.length
      ? data.items.map(productCardHtml).join("")
      : '<div class="empty-state" style="grid-column:1/-1"><h3>No products match your filters</h3><p>Try clearing a filter or searching a different term.</p></div>';

    document.getElementById("pagination").innerHTML = paginationHtml(data.page, data.pages, 'onclick="setParam(\'page\',this.dataset.page)"');
  } catch (e) {
    toastError(e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = readParams();
  document.getElementById("search-title").textContent = params.search ? `Search results for "${params.search}"` : "Shop";
  loadShop();

  document.getElementById("apply-filters-btn").addEventListener("click", () => loadShop());
  document.getElementById("sort-select").addEventListener("change", (e) => setParam("sort", e.target.value));
});
