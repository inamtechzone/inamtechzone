/**
 * sw.js — minimal service worker for PWA support.
 * Caches static shell assets so the storefront still loads (read-only) offline;
 * API calls always go to the network since product/order data must stay live.
 */
const CACHE_NAME = "itz-shell-v1";
const SHELL_ASSETS = [
  "/index.html", "/shop.html", "/product.html", "/cart.html", "/checkout.html",
  "/track-order.html", "/wishlist.html",
  "/assets/css/style.css",
  "/assets/js/config.js", "/assets/js/api.js", "/assets/js/ui.js",
  "/assets/js/storage.js", "/assets/js/layout.js", "/assets/js/auth.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never cache API calls to the Apps Script backend — always fetch live data.
  if (url.hostname.includes("script.google.com")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
