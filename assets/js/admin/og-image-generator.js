/**
 * admin/og-image-generator.js
 * Composites a branded 1200×630 social share image with Canvas API.
 * Uses wsrv.nl proxy to bypass CORS/Tainted Canvas security errors guaranteed!
 */

function loadImageEl_(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("No image source"));
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image: " + src));
    
    // CORS بلاک سے بچنے کے لیے wsrv.nl پراکسی کا استعمال
    const proxiedSrc = src.startsWith("data:") || src.startsWith("blob:")
      ? src
      : `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=png`;

    img.src = proxiedSrc;
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
  canvas.width = 1200; 
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  const s = window.ITZ_SETTINGS || {};

  // 1. Background
  ctx.fillStyle = "#0F1530";
  ctx.fillRect(0, 0, 1200, 630);

  // 2. Product photo — right half
  try {
    const productImg = await loadImageEl_(options.imageUrl);
    drawCover_(ctx, productImg, 600, 0, 600, 630);

    // Left-edge gradient transition
    const grad = ctx.createLinearGradient(500, 0, 700, 0);
    grad.addColorStop(0, "rgba(15,21,48,1)");
    grad.addColorStop(1, "rgba(15,21,48,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(500, 0, 200, 630);
  } catch (e) {
    console.warn("OG Generator: Product photo skipped due to load error", e);
  }

  // 3. Store Logo (optional)
  let logoOffset = 60;
  if (s.logo) {
    try {
      const logoImg = await loadImageEl_(s.logo);
      ctx.drawImage(logoImg, 60, 50, 64, 64);
      logoOffset = 140;
    } catch (e) {
      console.warn("OG Generator: Logo skipped", e);
    }
  }

  // 4. Category
  ctx.fillStyle = "#FFAE1F";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText((options.category || "PRODUCTS").toUpperCase(), logoOffset, 90);

  // 5. Product Name
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 44px Arial, sans-serif";
  wrapText_(ctx, options.name || "", 60, 200, 480, 52);

  // 6. Price Badge
  const hasDiscount = options.discountPrice && Number(options.discountPrice) < Number(options.price);
  const price = hasDiscount ? options.discountPrice : options.price;

  ctx.fillStyle = "#4A4EF0";
  roundRect_(ctx, 60, 400, 260, 64, 12);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText(`Rs ${Number(price).toLocaleString()}`, 80, 443);

  // Discount Badge & Old Price Strikethrough
  if (hasDiscount) {
    ctx.fillStyle = "#B9BEDA";
    ctx.font = "400 22px Arial, sans-serif";
    const oldText = `Rs ${Number(options.price).toLocaleString()}`;
    ctx.fillText(oldText, 340, 435);
    
    const oldWidth = ctx.measureText(oldText).width;
    ctx.strokeStyle = "#B9BEDA";
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(340, 427); 
    ctx.lineTo(340 + oldWidth, 427); 
    ctx.stroke();

    // OFF Badge
    ctx.fillStyle = "#FF5A5F";
    roundRect_(ctx, 340, 445, 130, 32, 8);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 15px Arial, sans-serif";
    const pct = Math.round((1 - options.discountPrice / options.price) * 100);
    ctx.fillText(`${pct}% OFF`, 355, 466);
  }

  // 7. Footer: Store Name & WhatsApp
  ctx.fillStyle = "#B9BEDA";
  ctx.font = "500 20px Arial, sans-serif";
  ctx.fillText(s.storeName || "INAM TECH ZONE", 60, 550);
  if (s.whatsappNumber) {
    ctx.fillText(`WhatsApp: ${s.whatsappNumber}`, 60, 582);
  }

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

/**
 * Converts generated Blob to base64 and uploads to backend
 */
async function uploadOgImageBlob_(blob, fileName) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const data = await apiPost("upload.image", { 
    fileName: fileName, 
    mimeType: "image/png", 
    base64: base64 
  });
  return data.url;
}