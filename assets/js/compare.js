/**
 * compare.js
 * Product comparison list — same localStorage pattern as the wishlist,
 * capped at 4 products so the comparison table stays readable.
 */

const COMPARE_KEY = "itz_compare";
const COMPARE_LIMIT = 4;

function getCompareList() {
  try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || "[]"); } catch (e) { return []; }
}

function isInCompare(productId) { return getCompareList().includes(productId); }

function toggleCompare(productId) {
  let list = getCompareList();
  if (list.includes(productId)) {
    list = list.filter((id) => id !== productId);
  } else {
    if (list.length >= COMPARE_LIMIT) {
      toast(`You can compare up to ${COMPARE_LIMIT} products at a time`, "error");
      return isInCompare(productId);
    }
    list.push(productId);
  }
  localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
  return list.includes(productId);
}

function removeFromCompare(productId) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(getCompareList().filter((id) => id !== productId)));
}
