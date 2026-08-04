/**
 * admin/og-image-generator.js
 * Composites a branded 1200×630 social share image (logo, product photo, name,
 * price/discount badge, website, WhatsApp) entirely client-side with the
 * Canvas API — no image-processing server needed. Runs automatically when an
 * admin saves a product; the result is uploaded to Drive like any other
 * product image and stored as the product's `ogImage` field.
 */

function loadImageEl_(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("No image source"));
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
}

// Draws `img` covering the given rect (like CSS object-fit: cover).
function drawCover_(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect_(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// options: { name, price, discountPrice, imageUrl, category }
// Returns a PNG Blob, or null if there's no product image to work with yet.
async function generateOgImage_(options) {
  if (!options.imageUrl) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext("2d");
  const s = window.ITZ_SETTINGS || {};

  // Background
  ctx.fillStyle = "#0F1530";
  ctx.fillRect(0, 0, 1200, 630);

  // Product photo — right half
  try {
    const productImg = await loadImageEl_(options.imageUrl);
    drawCover_(ctx, productImg, 600, 0, 600, 630);
    // Left-edge gradient so text stays readable over the photo split.
    const grad = ctx.createLinearGradient(500, 0, 700, 0);
    grad.addColorStop(0, "rgba(15,21,48,1)");
    grad.addColorStop(1, "rgba(15,21,48,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(500, 0, 200, 630);
  } catch (e) { /* proceed text-only if the image can't be loaded (e.g. CORS) */ }

  // Logo (optional)
  if (s.logo) {
    try {
      const logoImg = await loadImageEl_(s.logo);
      ctx.drawImage(logoImg, 60, 50, 64, 64);
    } catch (e) { /* skip logo if it fails to load */ }
  }

  ctx.fillStyle = "#FFAE1F";
  ctx.font = "600 22px Arial";
  ctx.fillText((options.category || "").toUpperCase(), s.logo ? 140 : 60, 90);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 48px Arial";
  wrapText_(ctx, options.name || "", 60, 220, 480, 56);

  // Price badge
  const hasDiscount = options.discountPrice && options.discountPrice < options.price;
  const price = hasDiscount ? options.discountPrice : options.price;
  ctx.fillStyle = "#4A4EF0";
  roundRect_(ctx, 60, 400, 260, 64, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 30px Arial";
  ctx.fillText(`Rs ${Number(price).toLocaleString()}`, 78, 442);

  if (hasDiscount) {
    ctx.fillStyle = "#B9BEDA";
    ctx.font = "400 22px Arial";
    ctx.save();
    ctx.font = "400 22px Arial";
    const oldText = `Rs ${Number(options.price).toLocaleString()}`;
    ctx.fillText(oldText, 340, 435);
    const oldWidth = ctx.measureText(oldText).width;
    ctx.strokeStyle = "#B9BEDA";
    ctx.beginPath(); ctx.moveTo(340, 427); ctx.lineTo(340 + oldWidth, 427); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#FF5A5F";
    roundRect_(ctx, 340, 445, 140, 32, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Arial";
    const pct = Math.round((1 - options.discountPrice / options.price) * 100);
    ctx.fillText(`${pct}% OFF`, 360, 467);
  }

  // Footer: store name + WhatsApp
  ctx.fillStyle = "#B9BEDA";
  ctx.font = "500 20px Arial";
  ctx.fillText(s.storeName || "INAM TECH ZONE", 60, 560);
  if (s.whatsappNumber) ctx.fillText(`WhatsApp: ${s.whatsappNumber}`, 60, 590);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
}

function wrapText_(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "" && lines < 3) {
      ctx.fillText(line, x, y);
      line = word + " ";
      y += lineHeight;
      lines++;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

// Uploads a canvas-generated Blob using the same upload.image action as
// regular product photos, without needing a <input type="file"> in between.
async function uploadOgImageBlob_(blob, fileName) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const data = await apiPost("upload.image", { fileName: fileName, mimeType: "image/png", base64: base64 });
  return data.url;
}
