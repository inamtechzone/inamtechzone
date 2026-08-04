/**
 * img-cdn.js
 * Optional Cloudinary "fetch" wrapper for automatic image optimization
 * (WebP conversion, resizing, compression, lazy-friendly responsive sizes)
 * on top of images already stored as plain Google Drive URLs.
 *
 * If Settings > cloudinaryCloudName is empty (the default), cdnUrl() just
 * returns the original Drive URL unchanged — nothing breaks, nothing is
 * required to set up. Set a Cloudinary cloud name to turn this on for free
 * (Cloudinary's free tier fetch-and-transform works against any public URL,
 * no re-upload needed).
 */

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
