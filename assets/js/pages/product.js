// پروڈکٹ ڈیٹا لوڈ ہونے کے بعد یہ فنکشن کال کریں (فرض کریں 'product' آبجیکٹ آپ کا ڈیٹا ہے)
function setupProductActionButtons(product) {
  const currentUrl = window.location.href;
  const whatsappNumber = window.ITZ_SETTINGS?.whatsappNumber || "923001234567"; // اپنا واٹس ایپ نمبر سیٹ کریں

  // 1. WhatsApp Button Setup
  const whatsappBtn = document.getElementById("whatsapp-ask-btn");
  if (whatsappBtn) {
    const waText = encodeURIComponent(
      `السلام علیکم! مجھے اس پروڈکٹ کے بارے میں معلومات چاہیے:\n*${product.name}*\nقیمت: Rs. ${product.price}\nلنک: ${currentUrl}`
    );
    whatsappBtn.href = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${waText}`;
  }

  // 2. Wishlist Toggle Setup
  const wishlistBtn = document.getElementById("wishlist-toggle-btn");
  if (wishlistBtn) {
    updateWishlistButtonUI(product.id);

    wishlistBtn.onclick = () => {
      let wishlist = JSON.parse(localStorage.getItem("itz_wishlist") || "[]");
      const index = wishlist.findIndex((item) => item.id === product.id);

      if (index > -1) {
        wishlist.splice(index, 1);
        if (typeof toast === "function") toast("Removed from wishlist", "info");
      } else {
        wishlist.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || "",
        });
        if (typeof toast === "function") toast("Added to wishlist!", "success");
      }

      localStorage.setItem("itz_wishlist", JSON.stringify(wishlist));
      updateWishlistButtonUI(product.id);
    };
  }

  // 3. Compare Toggle Setup
  const compareBtn = document.getElementById("compare-toggle-btn");
  if (compareBtn) {
    updateCompareButtonUI(product.id);

    compareBtn.onclick = () => {
      let compareList = JSON.parse(localStorage.getItem("itz_compare") || "[]");
      const index = compareList.findIndex((item) => item.id === product.id);

      if (index > -1) {
        compareList.splice(index, 1);
        if (typeof toast === "function") toast("Removed from compare list", "info");
      } else {
        if (compareList.length >= 4) {
          if (typeof toast === "function") toast("You can compare up to 4 products", "error");
          return;
        }
        compareList.push(product);
        if (typeof toast === "function") toast("Added to compare list!", "success");
      }

      localStorage.setItem("itz_compare", JSON.stringify(compareList));
      updateCompareButtonUI(product.id);
    };
  }

  // 4. Share Buttons Dynamic Render
  const shareContainer = document.getElementById("share-buttons");
  if (shareContainer) {
    shareContainer.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="shareNative('${escapeHtml(product.name)}', '${currentUrl}')">📤 Share</button>
      <button class="btn btn-outline btn-sm" onclick="copyProductLink('${currentUrl}')">📋 Copy Link</button>
    `;
  }
}

// Wishlist UI Updater
function updateWishlistButtonUI(productId) {
  const wishlistBtn = document.getElementById("wishlist-toggle-btn");
  if (!wishlistBtn) return;
  const wishlist = JSON.parse(localStorage.getItem("itz_wishlist") || "[]");
  const exists = wishlist.some((item) => item.id === productId);
  wishlistBtn.textContent = exists ? "♥ Remove from wishlist" : "♡ Add to wishlist";
}

// Compare UI Updater
function updateCompareButtonUI(productId) {
  const compareBtn = document.getElementById("compare-toggle-btn");
  if (!compareBtn) return;
  const compareList = JSON.parse(localStorage.getItem("itz_compare") || "[]");
  const exists = compareList.some((item) => item.id === productId);
  compareBtn.textContent = exists ? "✓ In compare list" : "⇄ Compare";
}

// Global Helpers for Share Functions
window.copyProductLink = function (url) {
  navigator.clipboard.writeText(url).then(() => {
    if (typeof toast === "function") toast("Product link copied to clipboard!", "success");
  });
};

window.shareNative = async function (title, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title: title, url: url });
    } catch (e) { /* User cancelled share */ }
  } else {
    window.copyProductLink(url);
  }
};
