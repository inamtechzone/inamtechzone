/**
 * pages/wishlist.js — logic for wishlist.html
 */

async function loadWishlist() {
  const ids = getWishlist();
  const root = document.getElementById("wishlist-grid");
  if (!ids.length) {
    root.innerHTML = "";
    document.getElementById("wishlist-empty").style.display = "block";
    return;
  }
  root.innerHTML = skeletonCards(ids.length);
  try {
    const items = await Promise.all(ids.map((id) => apiGet("products.get", { id: id }).catch(() => null)));
    const valid = items.filter(Boolean);
    root.innerHTML = valid.length ? valid.map(productCardHtml).join("") : "";
    document.getElementById("wishlist-empty").style.display = valid.length ? "none" : "block";
  } catch (e) {
    toastError(e);
  }
}

document.addEventListener("DOMContentLoaded", loadWishlist);
