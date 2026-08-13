let existingImages = [];
let specRows = [];
let editingId = null;
let categoriesCache = [];
let brandsCache = [];
let currentHandle = "";
let handleCheckTimer = null;

function slugifyClient_(text) {
  return String(text).toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Rough, transparent SEO score — shows exactly which boxes are ticked.
function computeSeoScore_(form) {
  const checks = [
    { label: "SEO title set", pass: !!form.seoTitle.value.trim() },
    { label: "SEO title is 30-60 characters", pass: form.seoTitle.value.trim().length >= 30 && form.seoTitle.value.trim().length <= 60 },
    { label: "SEO description set", pass: !!form.seoDescription.value.trim() },
    { label: "SEO description is 70-160 characters", pass: form.seoDescription.value.trim().length >= 70 && form.seoDescription.value.trim().length <= 160 },
    { label: "At least 1 product image", pass: totalImageCount() > 0 },
    { label: "At least 1 tag", pass: form.tags.value.split(",").map((t) => t.trim()).filter(Boolean).length > 0 },
    { label: "Description is at least 80 characters", pass: form.description.value.trim().length >= 80 },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}

function renderSeoScore_() {
  const form = document.getElementById("product-form");
  const { score, checks } = computeSeoScore_(form);
  const color = score >= 80 ? "var(--success)" : score >= 50 ? "var(--amber)" : "var(--danger)";
  document.getElementById("seo-score-value").textContent = score + "%";
  document.getElementById("seo-score-value").style.color = color;
  document.getElementById("seo-score-checklist").innerHTML = checks.map((c) =>
    `<div style="font-size:12.5px;color:${c.pass ? "var(--success)" : "var(--muted)"}">${c.pass ? "✓" : "○"} ${c.label}</div>`
  ).join("");
}

const MAX_PRODUCT_IMAGES = 10;

function totalImageCount() { return existingImages.length; }

function renderImagePreviews() {
  document.getElementById("image-previews").innerHTML = existingImages.map((url, i) => `
    <div class="image-preview"><img src="${escapeHtml(url)}"><button type="button" onclick="removeExistingImage(${i})">×</button></div>`).join("");
  document.getElementById("image-count-label").textContent = `${totalImageCount()}/${MAX_PRODUCT_IMAGES} used`;
}

function removeExistingImage(i) { existingImages.splice(i, 1); renderImagePreviews(); renderSeoScore_(); }

// --- 1. Add Image by URL ---
async function addImageByUrl(url) {
  if (!url || !url.trim()) return;
  if (totalImageCount() >= MAX_PRODUCT_IMAGES) { toast(`Maximum ${MAX_PRODUCT_IMAGES} images per product`, "error"); return; }

  const input = document.getElementById("image-url-input");
  const btn = document.getElementById("add-image-url-btn");
  btn.disabled = true; btn.textContent = "Adding…";
  try {
    const data = await apiPost("upload.imageFromUrl", { url: url.trim() });
    existingImages.push(data.url);
    renderImagePreviews();
    if (typeof renderSeoScore_ === "function") renderSeoScore_();
    input.value = "";
    toast("Image added", "success");
  } catch (e) {
    toastError(e);
  } finally {
    btn.disabled = false; btn.textContent = "Add URL";
  }
}

// --- 2. Add Local Image Files (Fixed Base64 Prefix Issue) ---
async function addLocalImages(files) {
  if (!files || !files.length) return;

  const availableSlots = MAX_PRODUCT_IMAGES - totalImageCount();
  if (availableSlots <= 0) {
    toast(`Maximum ${MAX_PRODUCT_IMAGES} images per product limit reached`, "error");
    return;
  }

  const filesToProcess = Array.from(files).slice(0, availableSlots);
  const localInput = document.getElementById("local-image-input");

  for (const file of filesToProcess) {
    try {
      const fullDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let finalUrl = fullDataUrl; // Fallback if server upload fails

      // Remove "data:image/jpeg;base64," prefix for server decoding
      const rawBase64 = fullDataUrl.includes(",") ? fullDataUrl.split(",")[1] : fullDataUrl;

      try {
        const res = await apiPost("upload.image", { 
          base64: rawBase64, 
          filename: file.name,
          type: file.type || "image/jpeg",
          mimeType: file.type || "image/jpeg"
        });
        
        if (res && res.url) finalUrl = res.url;
      } catch (e) {
        console.warn("Direct API upload failed, using Data URL fallback:", e);
      }

      existingImages.push(finalUrl);
    } catch (err) {
      toastError(err);
    }
  }

  renderImagePreviews();
  renderSeoScore_();
  if (localInput) localInput.value = "";
  toast("Local image(s) added successfully", "success");
}

function renderSpecRows() {
  document.getElementById("spec-rows").innerHTML = specRows.map((s, i) => `
    <div class="spec-row">
      <input placeholder="Spec name (e.g. Battery)" value="${escapeHtml(s.key)}" oninput="specRows[${i}].key=this.value">
      <input placeholder="Value (e.g. 10000mAh)" value="${escapeHtml(s.value)}" oninput="specRows[${i}].value=this.value">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeSpecRow(${i})">×</button>
    </div>`).join("");
}
function addSpecRow() { specRows.push({ key: "", value: "" }); renderSpecRows(); }
function removeSpecRow(i) { specRows.splice(i, 1); renderSpecRows(); }

async function loadDropdowns() {
  [categoriesCache, brandsCache, window.ITZ_SETTINGS] = await Promise.all([
    apiGet("categories.list", {}), apiGet("brands.list", {}), apiGet("settings.get", {}),
  ]);
  document.getElementById("category-select").innerHTML = categoriesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  document.getElementById("brand-select").innerHTML = `<option value="">No brand</option>` + brandsCache.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
}

async function loadExistingProduct(id) {
  const p = await apiGet("products.get", { id: id });
  const form = document.getElementById("product-form");
  form.name.value = p.name;
  form.description.value = p.description;
  form.price.value = p.price;
  form.discountPrice.value = p.discountPrice || "";
  form.stock.value = p.stock;
  form.sku.value = p.sku;
  form.barcode.value = p.barcode || "";
  form.categoryId.value = p.categoryId;
  form.brandId.value = p.brandId || "";
  form.tags.value = (p.tags || []).join(", ");
  form.seoTitle.value = p.seoTitle || "";
  form.seoDescription.value = p.seoDescription || "";
  form.featured.checked = p.featured;
  form.bestSeller.checked = p.bestSeller;
  form.newArrival.checked = p.newArrival;
  form.flashSale.checked = p.flashSale;
  form.flashSaleEndsAt.value = p.flashSaleEndsAt ? p.flashSaleEndsAt.slice(0, 16) : "";
  form.status.value = p.status || "Active";
  currentHandle = p.handle;
  document.getElementById("handle-display").textContent = p.handle;
  existingImages = p.images || [];
  specRows = p.specifications && p.specifications.length ? p.specifications : [];
  renderImagePreviews();
  renderSpecRows();
  document.getElementById("qr-preview").src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(p.sku)}`;
  document.getElementById("qr-wrap").style.display = "block";
  document.getElementById("short-link-display").textContent = p.shortCode ? `/p/${p.shortCode}` : "";

  if (p.shortCode) {
    const site = (window.ITZ_SETTINGS?.siteUrl || window.location.origin).replace(/\/$/, "");
    const shareUrl = `${site}/p/${p.shortCode}`;
    document.getElementById("share-qr-preview").src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`;
    document.getElementById("share-qr-wrap").style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initAdminLayout("products");
  editingId = new URL(window.location.href).searchParams.get("id");
  document.getElementById("form-title").textContent = editingId ? "Edit product" : "Add product";
  document.getElementById("submit-btn").textContent = editingId ? "Save changes" : "Create product";
  document.getElementById("handle-section-new").style.display = editingId ? "none" : "block";
  document.getElementById("handle-section-existing").style.display = editingId ? "block" : "none";

  try {
    await loadDropdowns();
    if (editingId) await loadExistingProduct(editingId);
    else addSpecRow();
    renderSeoScore_();
  } catch (e) { toastError(e); }

  const nameInput = document.querySelector('[name="name"]');
  const handleInput = document.getElementById("handle-input-new");
  let handleManuallyEdited = false;

  if (!editingId) {
    const checkHandleAvailability = debounce(async (handle) => {
      if (!handle) return;
      try {
        const result = await apiGet("products.checkHandle", { handle: handle, excludeId: "" });
        const statusEl = document.getElementById("handle-status-new");
        statusEl.textContent = result.valid ? "✓ Available" : "✕ " + result.reason;
        statusEl.style.color = result.valid ? "var(--success)" : "var(--danger)";
      } catch (e) { /* non-fatal */ }
    }, 400);

    nameInput.addEventListener("input", () => {
      if (!handleManuallyEdited) {
        handleInput.value = slugifyClient_(nameInput.value);
        checkHandleAvailability(handleInput.value);
      }
      renderSeoScore_();
    });
    handleInput.addEventListener("input", () => {
      handleManuallyEdited = true;
      handleInput.value = slugifyClient_(handleInput.value);
      checkHandleAvailability(handleInput.value);
    });
  }

  ["seoTitle", "seoDescription", "tags", "description"].forEach((name) => {
    document.querySelector(`[name="${name}"]`)?.addEventListener("input", renderSeoScore_);
  });

  document.getElementById("add-spec-btn").addEventListener("click", addSpecRow);

  // --- URL Image Event Listeners ---
  document.getElementById("add-image-url-btn")?.addEventListener("click", () => addImageByUrl(document.getElementById("image-url-input").value));
  document.getElementById("image-url-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addImageByUrl(e.target.value); }
  });

  // --- Local Image File Event Listener ---
  document.getElementById("local-image-input")?.addEventListener("change", (e) => {
    addLocalImages(e.target.files);
  });

  document.getElementById("product-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (totalImageCount() === 0) return toast("Add at least 1 product image", "error");

    const form = ev.target;
    const btn = document.getElementById("submit-btn");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
      const images = existingImages.slice(0, MAX_PRODUCT_IMAGES);
      const validSpecs = specRows.filter((s) => s.key.trim() && s.value.trim());

      const payload = {
        name: form.name.value,
        description: form.description.value,
        price: Number(form.price.value),
        discountPrice: form.discountPrice.value ? Number(form.discountPrice.value) : "",
        stock: Number(form.stock.value),
        sku: form.sku.value,
        barcode: form.barcode.value,
        categoryId: form.categoryId.value,
        brandId: form.brandId.value,
        tags: form.tags.value.split(",").map((t) => t.trim()).filter(Boolean),
        specifications: validSpecs,
        seoTitle: form.seoTitle.value,
        seoDescription: form.seoDescription.value,
        featured: form.featured.checked,
        bestSeller: form.bestSeller.checked,
        newArrival: form.newArrival.checked,
        flashSale: form.flashSale.checked,
        flashSaleEndsAt: form.flashSaleEndsAt.value ? new Date(form.flashSaleEndsAt.value).toISOString() : "",
        status: form.status.value,
        images: images,
      };
      if (!editingId && handleInput.value.trim()) payload.handle = handleInput.value.trim();

      try {
        const categoryName = (categoriesCache.find((c) => c.id === form.categoryId.value) || {}).name || "";
        const ogBlob = await generateOgImage_({
          name: form.name.value, price: Number(form.price.value),
          discountPrice: form.discountPrice.value ? Number(form.discountPrice.value) : null,
          imageUrl: images[0], category: categoryName,
        });
        if (ogBlob) payload.ogImage = await uploadOgImageBlob_(ogBlob, (form.sku.value || "product") + "-og.png");
      } catch (ogErr) { console.warn("OG image generation skipped:", ogErr); }

      if (editingId) { payload.id = editingId; await apiPost("products.update", payload); toast("Product updated", "success"); }
      else { await apiPost("products.create", payload); toast("Product created", "success"); }

      window.location.href = "/admin/products.html";
    } catch (err) {
      toastError(err);
      btn.disabled = false; btn.textContent = editingId ? "Save changes" : "Create product";
    }
  });
});
