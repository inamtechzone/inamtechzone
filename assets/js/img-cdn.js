function cdnUrl(originalUrl, options) {
  const s = window.ITZ_SETTINGS || {};
  if (!s.cloudinaryCloudName || !originalUrl) return originalUrl;
  options = options || {};
  const transforms = ["f_auto", "q_auto"]; // auto format (incl. WebP/AVIF) + auto quality
  if (options.width) transforms.push("w_" + options.width);
  if (options.height) transforms.push("h_" + options.height);
  if (options.width || options.height) transforms.push("c_fill");
  return `https://res.cloudinary.com/${s.cloudinaryCloudName}/image/fetch/${transforms.join(",")}/${encodeURIComponent(originalUrl)}`;
}
