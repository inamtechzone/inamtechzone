const STORE_VERSION = '8.2-cloudflare-only-pages-d1-r2-csv';
const DEFAULT_ADMIN_EMAIL = 'admin@inamtechzone.com';
const DEFAULT_PASSWORD_SALT = 'b4d8a58400399a4999736f6d1851d541';
const DEFAULT_PASSWORD_HASH = 'b53fb56fb70eb3db467f416d152cb7713ad01699b7d3b87930aa3602199f2d77';
const PASSWORD_ITERATIONS = 100000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ALLOWED_FILE_TYPES = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'], ['image/avif', 'avif'],
  ['application/pdf', 'pdf'], ['text/plain', 'txt'], ['text/csv', 'csv'], ['application/json', 'json'],
  ['application/msword', 'doc'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-powerpoint', 'ppt'], ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['application/zip', 'zip'], ['application/x-zip-compressed', 'zip'],
]);

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS store_records (
    collection TEXT NOT NULL,
    record_id TEXT NOT NULL,
    data TEXT NOT NULL CHECK (json_valid(data)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (collection, record_id)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS idx_store_records_collection_updated
   ON store_records (collection, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS store_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
   ON admin_sessions (expires_at)`,
];

const jsonHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  Expires: '0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; font-src 'self' data:; upgrade-insecure-requests",
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

let schemaPromise;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function revisionId() {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function safeText(value, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maxLength);
}

function hexToBytes(hex) {
  const clean = String(hex || '').replace(/[^a-f0-9]/gi, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
}

async function passwordHash(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(saltHex),
    iterations: PASSWORD_ITERATIONS,
  }, key, 256);
  return bytesToHex(bits);
}

function secureEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function metaUpsert(db, key, value, updatedAt = nowIso()) {
  return db.prepare(`INSERT INTO store_meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(key, String(value), updatedAt);
}

function recordUpsert(db, collection, recordId, data, timestamp = nowIso()) {
  return db.prepare(`INSERT INTO store_records (collection, record_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(collection, record_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .bind(collection, String(recordId), JSON.stringify(data), timestamp, timestamp);
}

function recordDelete(db, collection, recordId) {
  return db.prepare('DELETE FROM store_records WHERE collection = ? AND record_id = ?').bind(collection, String(recordId));
}

async function ensureSchema(env) {
  if (!env.DB) throw httpError('Cloudflare D1 binding DB is missing. Run the all-in-one deployment setup.', 503);
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await env.DB.batch(schemaStatements.map((sql) => env.DB.prepare(sql)));
      const { results = [] } = await env.DB.prepare("SELECT key FROM store_meta WHERE key IN ('admin_email', 'catalog_initialized', 'revision')").all();
      const keys = new Set(results.map((row) => row.key));
      const statements = [];
      if (!keys.has('admin_email')) statements.push(metaUpsert(env.DB, 'admin_email', DEFAULT_ADMIN_EMAIL));
      if (!keys.has('catalog_initialized')) statements.push(metaUpsert(env.DB, 'catalog_initialized', 'false'));
      if (!keys.has('revision')) statements.push(metaUpsert(env.DB, 'revision', revisionId()));
      if (statements.length) await env.DB.batch(statements);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function readMeta(db, key, fallback = '') {
  const row = await db.prepare('SELECT value FROM store_meta WHERE key = ?').bind(key).first();
  return row ? row.value : fallback;
}

async function readCollection(db, collection, newestFirst = false) {
  const sql = newestFirst
    ? 'SELECT data FROM store_records WHERE collection = ? ORDER BY updated_at DESC'
    : 'SELECT data FROM store_records WHERE collection = ? ORDER BY created_at ASC';
  const { results = [] } = await db.prepare(sql).bind(collection).all();
  return results.map((row) => {
    try { return JSON.parse(row.data); } catch { return null; }
  }).filter(Boolean);
}

async function findRecord(db, collection, recordId) {
  const row = await db.prepare('SELECT data FROM store_records WHERE collection = ? AND record_id = ?')
    .bind(collection, String(recordId)).first();
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

async function syncMeta(db) {
  const { results = [] } = await db.prepare("SELECT key, value FROM store_meta WHERE key IN ('catalog_initialized', 'revision')").all();
  const meta = Object.fromEntries(results.map((row) => [row.key, row.value]));
  if (meta.catalog_initialized !== 'true') {
    const count = await db.prepare("SELECT COUNT(*) AS total FROM store_records WHERE collection IN ('products', 'categories')").first();
    if (Number(count?.total || 0) > 0) meta.catalog_initialized = 'true';
  }
  return {
    provider: 'Cloudflare Pages + D1 + R2',
    catalogInitialized: meta.catalog_initialized === 'true',
    serverTime: nowIso(),
    revision: meta.revision || '',
  };
}

async function writeMutation(db, statements, catalogInitialized = false) {
  const revision = revisionId();
  const timestamp = nowIso();
  if (catalogInitialized) statements.push(metaUpsert(db, 'catalog_initialized', 'true', timestamp));
  statements.push(metaUpsert(db, 'revision', revision, timestamp));
  await db.batch(statements);
  return syncMeta(db);
}

function decodeDataUrl(value, maxBytes = MAX_IMAGE_BYTES) {
  const matched = String(value || '').match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!matched) throw httpError('The selected file could not be read.');
  const mimeType = matched[1].toLowerCase();
  let binary;
  try { binary = atob(matched[2].replace(/\s/g, '')); } catch { throw httpError('The file data is invalid.'); }
  if (!binary.length || binary.length > maxBytes) throw httpError(`The file must be between 1 byte and ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType };
}

function mediaKey(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  try {
    const url = new URL(source, 'https://store.invalid');
    if (!url.pathname.startsWith('/media/')) return '';
    const key = decodeURIComponent(url.pathname.slice('/media/'.length));
    return key && !key.includes('..') && !key.startsWith('/') ? key : '';
  } catch { return ''; }
}

function productMediaKeys(product) {
  return [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])]
    .map(mediaKey).filter((key, index, list) => Boolean(key) && list.indexOf(key) === index);
}

function safeObjectName(value, fallback = 'file') {
  const cleaned = safeText(value || fallback, 120).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

async function putR2Object(env, { bytes, mimeType, fileName, prefix }) {
  if (!env.MEDIA) throw httpError('Cloudflare R2 binding MEDIA is missing. Enable R2, then run the all-in-one deployment again.', 503);
  const extension = ALLOWED_FILE_TYPES.get(mimeType);
  if (!extension) throw httpError('This file format is not allowed.');
  const originalName = safeObjectName(fileName, `${prefix}.${extension}`);
  const baseName = originalName.replace(/\.[a-z0-9]{1,8}$/i, '') || prefix;
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName}.${extension}`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { originalName, contentType: mimeType, uploadedBy: 'INAM TECH ZONE Admin' },
  });
  return { ok: true, key, name: originalName, mimeType, size: bytes.byteLength, url: `/media/${encodeURI(key)}` };
}

async function uploadImage(env, body) {
  const decoded = decodeDataUrl(body.dataUrl, MAX_IMAGE_BYTES);
  const mimeType = safeText(body.mimeType || decoded.mimeType, 100).toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType) || mimeType !== decoded.mimeType) throw httpError('Unsupported image format. Use JPG, PNG, WebP, GIF or AVIF.');
  return putR2Object(env, { bytes: decoded.bytes, mimeType, fileName: body.fileName || 'product-image', prefix: 'products' });
}

function safeExternalUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw httpError('Enter a valid direct HTTPS image URL.'); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password) throw httpError('Only public HTTPS image URLs can be imported.');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
    throw httpError('Private or local network URLs cannot be imported.');
  }
  return url;
}

async function importImage(env, body) {
  if (!env.MEDIA) throw httpError('Cloudflare R2 binding MEDIA is missing. Enable R2, then run the all-in-one deployment again.', 503);
  let url = safeExternalUrl(body.sourceUrl);
  let response;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    try { response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) }); }
    catch (error) { throw httpError(error?.name === 'TimeoutError' ? 'The remote image timed out.' : 'The remote image could not be downloaded.', 502); }
    if (response.status >= 300 && response.status < 400 && response.headers.get('Location')) {
      url = safeExternalUrl(new URL(response.headers.get('Location'), url).href);
      continue;
    }
    break;
  }
  if (!response?.ok) throw httpError('The remote server did not provide a downloadable image.', 502);
  const mimeType = safeText(response.headers.get('Content-Type')?.split(';')[0], 100).toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw httpError('The URL does not point to a supported JPG, PNG, WebP, GIF or AVIF image.');
  const declaredSize = Number(response.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_IMAGE_BYTES) throw httpError('The remote image is larger than 6 MB.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw httpError('The remote image must be 6 MB or smaller.');
  let fileName = body.fileName || 'imported-product-image';
  try { fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || fileName); } catch {}
  return putR2Object(env, { bytes, mimeType, fileName, prefix: 'products' });
}

async function deleteMedia(env, keys) {
  if (!keys.length) return { requested: 0, deleted: 0, failed: 0 };
  if (!env.MEDIA) return { requested: keys.length, deleted: 0, failed: keys.length };
  const results = await Promise.allSettled(keys.map((key) => env.MEDIA.delete(key)));
  const deleted = results.filter((result) => result.status === 'fulfilled').length;
  return { requested: keys.length, deleted, failed: keys.length - deleted };
}

async function uploadCloudFile(env, body) {
  const decoded = decodeDataUrl(body.dataUrl, MAX_FILE_BYTES);
  const mimeType = safeText(body.mimeType || decoded.mimeType, 140).toLowerCase();
  if (!ALLOWED_FILE_TYPES.has(mimeType) || mimeType !== decoded.mimeType) throw httpError('Allowed files: images, PDF, TXT, CSV, JSON, Word, Excel, PowerPoint and ZIP.');
  return putR2Object(env, { bytes: decoded.bytes, mimeType, fileName: body.fileName || 'cloud-file', prefix: 'files' });
}

async function listCloudFiles(env) {
  if (!env.MEDIA) throw httpError('Cloudflare R2 binding MEDIA is missing.', 503);
  const result = await env.MEDIA.list({ prefix: 'files/', limit: 500, include: ['httpMetadata', 'customMetadata'] });
  return {
    ok: true,
    files: result.objects.map((object) => ({
      key: object.key,
      name: object.customMetadata?.originalName || object.key.split('/').pop(),
      mimeType: object.httpMetadata?.contentType || object.customMetadata?.contentType || 'application/octet-stream',
      size: object.size,
      uploaded: object.uploaded instanceof Date ? object.uploaded.toISOString() : object.uploaded,
    })),
    truncated: result.truncated,
  };
}

async function downloadCloudFile(env, keyValue) {
  const key = safeText(keyValue, 1024);
  if (!key.startsWith('files/') || key.includes('..')) throw httpError('Invalid Cloudflare file key.');
  if (!env.MEDIA) throw httpError('Cloudflare R2 binding MEDIA is missing.', 503);
  const object = await env.MEDIA.get(key);
  if (!object) throw httpError('Cloud file not found.', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `attachment; filename="${safeObjectName(object.customMetadata?.originalName || key.split('/').pop(), 'download')}"`);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { status: 200, headers });
}

async function deleteCloudFile(env, keyValue) {
  const key = safeText(keyValue, 1024);
  if (!key.startsWith('files/') || key.includes('..')) throw httpError('Invalid Cloudflare file key.');
  if (!env.MEDIA) throw httpError('Cloudflare R2 binding MEDIA is missing.', 503);
  await env.MEDIA.delete(key);
  return { ok: true, deleted: key };
}

async function migrateExternalImages(env) {
  const products = await readCollection(env.DB, 'products');
  const importedUrls = new Map();
  const statements = [];
  let migrated = 0;
  let failed = 0;
  let remaining = 0;
  for (const product of products) {
    const currentImages = [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])].filter(Boolean).slice(0, 6);
    let changed = false;
    const nextImages = [];
    for (const sourceUrl of currentImages) {
      if (isCloudflareImageReference(sourceUrl)) { nextImages.push(sourceUrl); continue; }
      if (importedUrls.has(sourceUrl)) { nextImages.push(importedUrls.get(sourceUrl)); migrated += 1; changed = true; continue; }
      if (importedUrls.size >= 6) { nextImages.push(sourceUrl); remaining += 1; continue; }
      try {
        const result = await importImage(env, { sourceUrl, fileName: `${product.sku || product.id}-image` });
        importedUrls.set(sourceUrl, result.url);
        nextImages.push(result.url);
        migrated += 1;
        changed = true;
      } catch { nextImages.push(sourceUrl); failed += 1; }
    }
    if (changed) {
      const saved = normalizeProduct({ ...product, image: nextImages[0] || '', gallery: nextImages.slice(1) });
      statements.push(recordUpsert(env.DB, 'products', saved.id, saved));
    }
  }
  let settings = {};
  try { settings = JSON.parse(await readMeta(env.DB, 'settings', '{}')); } catch {}
  if (settings.heroImage && !isCloudflareImageReference(settings.heroImage)) {
    if (importedUrls.size < 6) {
      try {
        const result = await importImage(env, { sourceUrl: settings.heroImage, fileName: 'storefront-hero' });
        settings.heroImage = result.url;
        statements.push(metaUpsert(env.DB, 'settings', JSON.stringify(settings)));
        migrated += 1;
      } catch { failed += 1; }
    } else { remaining += 1; }
  }
  const sync = statements.length ? await writeMutation(env.DB, statements, true) : await syncMeta(env.DB);
  return { ok: true, migrated, failed, remaining, syncMeta: sync };
}

function normalizeProduct(product) {
  const images = [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])]
    .map((url) => String(url || '').trim())
    .filter((url, index, list) => Boolean(url) && list.indexOf(url) === index)
    .slice(0, 6);
  return {
    ...(product || {}),
    id: safeText(product?.id, 80),
    name: safeText(product?.name, 240),
    slug: safeText(product?.slug, 240),
    sku: safeText(product?.sku, 100),
    category: safeText(product?.category, 120),
    brand: safeText(product?.brand, 120),
    model: safeText(product?.model, 120),
    price: Number(product?.price || 0),
    comparePrice: Number(product?.comparePrice || 0),
    stock: Math.max(0, Number(product?.stock || 0)),
    rating: Number(product?.rating || 0),
    reviews: Number(product?.reviews || 0),
    featured: product?.featured === true,
    image: String(images[0] || ''),
    gallery: images.slice(1),
    details: Array.isArray(product?.details) ? product.details.slice(0, 50) : [],
    updatedAt: nowIso(),
  };
}

function isCloudflareImageReference(value) {
  const source = String(value || '').trim();
  return source === '/itz-logo-transparent.png' || source.startsWith('/products/') || source.startsWith('/media/products/');
}

function normalizeCategory(category) {
  return {
    ...(category || {}),
    id: safeText(category?.id, 80),
    name: safeText(category?.name, 120),
    slug: safeText(category?.slug, 140),
    active: category?.active !== false,
    updatedAt: nowIso(),
  };
}

function normalizeCoupon(coupon) {
  return {
    ...(coupon || {}),
    code: safeText(coupon?.code, 80).toUpperCase(),
    type: safeText(coupon?.type || 'percent', 30),
    value: Number(coupon?.value || 0),
    uses: Number(coupon?.uses || 0),
    active: coupon?.active !== false,
    updatedAt: nowIso(),
  };
}

async function publicData(db) {
  const [products, categories, coupons, settings, metadata] = await Promise.all([
    readCollection(db, 'products', true),
    readCollection(db, 'categories'),
    readCollection(db, 'coupons'),
    readMeta(db, 'settings', '{}'),
    syncMeta(db),
  ]);
  let parsedSettings = {};
  try { parsedSettings = JSON.parse(settings); } catch {}
  delete parsedSettings.googleDriveClientId;
  delete parsedSettings.driveFolderId;
  parsedSettings.storageProvider = 'Cloudflare Pages + D1 + R2';
  return {
    ok: true,
    products,
    categories,
    coupons: coupons.filter((item) => item.active !== false),
    settings: parsedSettings,
    syncMeta: metadata,
  };
}

async function adminData(db) {
  const [products, categories, orders, customers, quotes, coupons, settings, metadata] = await Promise.all([
    readCollection(db, 'products', true),
    readCollection(db, 'categories'),
    readCollection(db, 'orders', true),
    readCollection(db, 'customers', true),
    readCollection(db, 'quotes', true),
    readCollection(db, 'coupons', true),
    readMeta(db, 'settings', '{}'),
    syncMeta(db),
  ]);
  let parsedSettings = {};
  try { parsedSettings = JSON.parse(settings); } catch {}
  delete parsedSettings.googleDriveClientId;
  delete parsedSettings.driveFolderId;
  parsedSettings.storageProvider = 'Cloudflare Pages + D1 + R2';
  return { ok: true, products, categories, orders, customers, quotes, coupons, settings: parsedSettings, syncMeta: metadata };
}

async function initializeCatalog(db, body) {
  const metadata = await syncMeta(db);
  if (metadata.catalogInitialized) return { ok: true, skipped: true, syncMeta: metadata };
  const statements = [];
  for (const product of body.products || []) {
    const saved = normalizeProduct(product);
    if (saved.id && saved.name && saved.sku && saved.image) statements.push(recordUpsert(db, 'products', saved.id, saved));
  }
  for (const category of body.categories || []) {
    const saved = normalizeCategory(category);
    if (saved.id && saved.name) statements.push(recordUpsert(db, 'categories', saved.id, saved));
  }
  for (const coupon of body.coupons || []) {
    const saved = normalizeCoupon(coupon);
    if (saved.code) statements.push(recordUpsert(db, 'coupons', saved.code, saved));
  }
  const nextMeta = await writeMutation(db, statements, true);
  return { ok: true, initialized: true, syncMeta: nextMeta };
}

async function saveProduct(env, product) {
  const saved = normalizeProduct(product || {});
  if (!saved.id || !saved.name || !saved.sku) throw httpError('Product ID, name and SKU are required.');
  if (!saved.image) throw httpError('At least one product image is required.');
  const savedImages = [saved.image, ...(saved.gallery || [])];
  if (savedImages.some((image) => !isCloudflareImageReference(image))) throw httpError('Import every image into Cloudflare R2 before saving the product.');
  const existing = await findRecord(env.DB, 'products', saved.id);
  const metadata = await writeMutation(env.DB, [recordUpsert(env.DB, 'products', saved.id, saved)], true);
  const removed = existing ? productMediaKeys(existing).filter((key) => !productMediaKeys(saved).includes(key)) : [];
  const otherProducts = (await readCollection(env.DB, 'products')).filter((item) => item.id !== saved.id);
  const sharedKeys = new Set(otherProducts.flatMap(productMediaKeys));
  const mediaCleanup = await deleteMedia(env, removed.filter((key) => !sharedKeys.has(key)));
  return { ok: true, product: saved, mediaCleanup, syncMeta: metadata };
}

async function importProducts(db, sourceProducts) {
  if (!Array.isArray(sourceProducts) || !sourceProducts.length) throw httpError('CSV import contains no products.');
  if (sourceProducts.length > 250) throw httpError('A single CSV import can contain up to 250 products.');
  const existingProducts = await readCollection(db, 'products');
  const existingCategories = await readCollection(db, 'categories');
  const byId = new Map(existingProducts.map((product) => [String(product.id || '').toLowerCase(), product]));
  const bySku = new Map(existingProducts.map((product) => [String(product.sku || '').toLowerCase(), product]));
  const categoryNames = new Set(existingCategories.map((category) => String(category.name || '').toLowerCase()));
  const newCategories = [];
  const seenSkus = new Set();
  const imported = [];
  let created = 0;
  let updated = 0;

  for (let index = 0; index < sourceProducts.length; index += 1) {
    const candidate = normalizeProduct(sourceProducts[index] || {});
    if (!candidate.name || !candidate.sku) throw httpError(`CSV row ${index + 2}: product name and SKU are required.`);
    const skuKey = candidate.sku.toLowerCase();
    if (seenSkus.has(skuKey)) throw httpError(`CSV row ${index + 2}: duplicate SKU ${candidate.sku}.`);
    seenSkus.add(skuKey);
    const existing = byId.get(candidate.id.toLowerCase()) || bySku.get(skuKey);
    const saved = normalizeProduct({ ...sourceProducts[index], id: existing?.id || candidate.id || randomId('PRD'), image: candidate.image || '/itz-logo-transparent.png' });
    const images = [saved.image, ...(saved.gallery || [])];
    if (images.some((image) => !isCloudflareImageReference(image))) throw httpError(`CSV row ${index + 2} (${saved.sku}): use a Cloudflare product image path or leave image blank.`);
    if (existing) updated += 1; else created += 1;
    imported.push(saved);
    byId.set(saved.id.toLowerCase(), saved);
    bySku.set(skuKey, saved);
    const categoryKey = saved.category.toLowerCase();
    if (categoryKey && !categoryNames.has(categoryKey)) {
      const slug = saved.category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `category-${newCategories.length + 1}`;
      newCategories.push(normalizeCategory({ id: `cat-${slug}`, name: saved.category, slug, active: true }));
      categoryNames.add(categoryKey);
    }
  }

  let metadata;
  const records = [
    ...newCategories.map((category) => recordUpsert(db, 'categories', category.id, category)),
    ...imported.map((product) => recordUpsert(db, 'products', product.id, product)),
  ];
  for (let index = 0; index < records.length; index += 75) {
    const statements = records.slice(index, index + 75);
    metadata = await writeMutation(db, statements, true);
  }
  return { ok: true, imported: imported.length, created, updated, categoriesCreated: newCategories.length, products: await readCollection(db, 'products', true), categories: await readCollection(db, 'categories', true), syncMeta: metadata || await syncMeta(db) };
}

async function deleteProduct(env, productId) {
  const product = await findRecord(env.DB, 'products', productId);
  if (!product) throw httpError('Product not found.', 404);
  const otherProducts = (await readCollection(env.DB, 'products')).filter((item) => item.id !== productId);
  const sharedKeys = new Set(otherProducts.flatMap(productMediaKeys));
  const mediaCleanup = await deleteMedia(env, productMediaKeys(product).filter((key) => !sharedKeys.has(key)));
  const metadata = await writeMutation(env.DB, [recordDelete(env.DB, 'products', productId)]);
  return { ok: true, deleted: productId, type: 'product', mediaCleanup, syncMeta: metadata };
}

async function saveCategory(db, category) {
  const saved = normalizeCategory(category || {});
  if (!saved.id || !saved.name) throw httpError('Category ID and name are required.');
  const metadata = await writeMutation(db, [recordUpsert(db, 'categories', saved.id, saved)], true);
  return { ok: true, category: saved, syncMeta: metadata };
}

async function saveCoupon(db, coupon) {
  const saved = normalizeCoupon(coupon || {});
  if (!saved.code) throw httpError('Promotion code is required.');
  const metadata = await writeMutation(db, [recordUpsert(db, 'coupons', saved.code, saved)]);
  return { ok: true, coupon: saved, syncMeta: metadata };
}

async function findCustomerByEmail(db, email) {
  const normalized = String(email || '').trim().toLowerCase();
  const customers = await readCollection(db, 'customers');
  return customers.find((item) => String(item.email || '').trim().toLowerCase() === normalized) || null;
}

async function customerForNewOrder(db, order) {
  if (!order.email) return null;
  const email = String(order.email).trim().toLowerCase();
  const existing = await findCustomerByEmail(db, email);
  return {
    ...(existing || {}),
    id: existing?.id || randomId('CUS'),
    name: order.customer || existing?.name || email,
    email,
    orders: Number(existing?.orders || 0) + 1,
    spent: Number(existing?.spent || 0) + Number(order.total || 0),
    joined: existing?.joined || nowIso().slice(0, 10),
    updatedAt: nowIso(),
  };
}

async function createOrder(db, body) {
  const order = { ...(body.order || {}) };
  if (!order.id) order.id = randomId('ITZ');
  order.id = safeText(order.id, 80);
  if (!/^ITZ-[A-Z0-9-]{8,}$/i.test(order.id)) throw httpError('Invalid checkout request ID.');
  const existing = await findRecord(db, 'orders', order.id);
  if (existing) return { ok: true, orderId: existing.id, order: existing, idempotent: true, syncMeta: await syncMeta(db) };
  const email = safeText(order.email, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError('A valid customer email is required.');
  const requested = Array.isArray(order.lines) ? order.lines.slice(0, 50) : [];
  if (!requested.length) throw httpError('Your cart is empty.');
  const quantities = new Map();
  for (const line of requested) {
    const id = safeText(line?.id || line?.product?.id, 80);
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(line?.qty || 1))));
    if (id) quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  const statements = [];
  const lines = [];
  for (const [productId, quantity] of quantities) {
    const product = await findRecord(db, 'products', productId);
    if (!product || product.status !== 'active') throw httpError('One of the products is no longer available. Refresh your cart and retry.', 409);
    if (Number(product.stock || 0) < quantity) throw httpError(`${product.name} has only ${Number(product.stock || 0)} unit(s) available.`, 409);
    const updatedProduct = normalizeProduct({ ...product, stock: Number(product.stock || 0) - quantity });
    statements.push(recordUpsert(db, 'products', updatedProduct.id, updatedProduct));
    lines.push({ id: product.id, qty: quantity, product: { id: product.id, name: product.name, sku: product.sku, image: product.image, price: Number(product.price || 0), color: product.color || '', brand: product.brand || '', model: product.model || '' } });
  }
  const subtotal = lines.reduce((total, line) => total + Number(line.product.price || 0) * line.qty, 0);
  let settings = {};
  try { settings = JSON.parse(await readMeta(db, 'settings', '{}')); } catch {}
  const couponCode = safeText(order.coupon, 80).toUpperCase();
  const coupon = couponCode ? await findRecord(db, 'coupons', couponCode) : null;
  const activeCoupon = coupon?.active !== false ? coupon : null;
  const discount = activeCoupon?.type === 'percent'
    ? subtotal * Math.max(0, Math.min(100, Number(activeCoupon.value || 0))) / 100
    : activeCoupon?.type === 'fixed' ? Math.min(subtotal, Math.max(0, Number(activeCoupon.value || 0))) : 0;
  const deliveryEnabled = settings.deliveryChargesEnabled !== false;
  const shippingThreshold = Math.max(0, Number(settings.freeShippingThreshold || 0));
  const shippingRate = deliveryEnabled ? Math.max(0, Number(settings.flatShippingRate || 0)) : 0;
  const shipping = !shippingRate || activeCoupon?.type === 'shipping' || (shippingThreshold > 0 && subtotal >= shippingThreshold) ? 0 : shippingRate;
  const tax = Math.max(0, subtotal - discount) * Math.max(0, Number(settings.taxRate || 0)) / 100;
  order.customer = safeText(order.customer, 180);
  order.email = email;
  order.lines = lines;
  order.items = lines.reduce((total, line) => total + line.qty, 0);
  order.subtotal = subtotal;
  order.discount = discount;
  order.shipping = shipping;
  order.tax = tax;
  order.total = Math.max(0, subtotal - discount + shipping + tax);
  order.coupon = activeCoupon?.code || '';
  order.status = 'Processing';
  order.updatedAt = nowIso();
  statements.push(recordUpsert(db, 'orders', order.id, order));
  const customer = await customerForNewOrder(db, order);
  if (customer) statements.push(recordUpsert(db, 'customers', customer.id, customer));
  if (activeCoupon) statements.push(recordUpsert(db, 'coupons', activeCoupon.code, normalizeCoupon({ ...activeCoupon, uses: Number(activeCoupon.uses || 0) + 1 })));
  const metadata = await writeMutation(db, statements);
  return { ok: true, orderId: order.id, order, syncMeta: metadata };
}

async function createQuote(db, body) {
  const quote = { ...(body.quote || {}) };
  if (!quote.id) quote.id = randomId('QT');
  quote.updatedAt = nowIso();
  const metadata = await writeMutation(db, [recordUpsert(db, 'quotes', quote.id, quote)]);
  return { ok: true, quoteId: quote.id, quote, syncMeta: metadata };
}

async function saveOrder(db, order) {
  if (!order?.id) throw httpError('Order ID is required.');
  const saved = { ...order, updatedAt: nowIso() };
  const metadata = await writeMutation(db, [recordUpsert(db, 'orders', saved.id, saved)]);
  return { ok: true, order: saved, syncMeta: metadata };
}

async function deleteOrder(db, orderId) {
  const order = await findRecord(db, 'orders', orderId);
  const statements = [recordDelete(db, 'orders', orderId)];
  if (order?.email) {
    const customer = await findCustomerByEmail(db, order.email);
    if (customer) {
      const orders = (await readCollection(db, 'orders')).filter((item) => item.id !== orderId && String(item.email || '').trim().toLowerCase() === String(order.email).trim().toLowerCase());
      const updated = {
        ...customer,
        orders: orders.length,
        spent: orders.reduce((total, item) => total + Number(item.total || 0), 0),
        updatedAt: nowIso(),
      };
      statements.push(recordUpsert(db, 'customers', updated.id, updated));
    }
  }
  const metadata = await writeMutation(db, statements);
  return { ok: true, deleted: orderId, syncMeta: metadata };
}

async function updateRecord(db, collection, recordId, fields, label) {
  const existing = await findRecord(db, collection, recordId);
  if (!existing) throw httpError(`${label || 'Record'} not found.`, 404);
  const saved = { ...existing, ...fields, updatedAt: nowIso() };
  const metadata = await writeMutation(db, [recordUpsert(db, collection, recordId, saved)]);
  return { ok: true, [label || 'record']: saved, syncMeta: metadata };
}

async function deleteRecordAction(db, collection, recordId, label) {
  const metadata = await writeMutation(db, [recordDelete(db, collection, recordId)]);
  return { ok: true, deleted: recordId, type: label, syncMeta: metadata };
}

async function saveSettings(db, settings) {
  const clean = { ...(settings || {}) };
  const newPassword = String(clean.newAdminPassword || '');
  const confirmPassword = String(clean.confirmAdminPassword || '');
  delete clean.apiEndpoint;
  delete clean.driveFolderId;
  delete clean.newAdminPassword;
  delete clean.confirmAdminPassword;
  delete clean.googleDriveClientId;
  clean.storageProvider = 'Cloudflare Pages + D1 + R2';
  const statements = [metaUpsert(db, 'settings', JSON.stringify(clean))];
  if (clean.adminEmail) statements.push(metaUpsert(db, 'admin_email', String(clean.adminEmail).trim().toLowerCase()));
  if (newPassword) {
    if (newPassword.length < 12) throw httpError('New administrator password must contain at least 12 characters.');
    if (newPassword !== confirmPassword) throw httpError('New password and confirmation do not match.');
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(newPassword, salt);
    statements.push(metaUpsert(db, 'admin_password_salt', salt));
    statements.push(metaUpsert(db, 'admin_password_hash', hash));
  }
  const metadata = await writeMutation(db, statements);
  return { ok: true, settings: clean, passwordChanged: Boolean(newPassword), rows: Object.keys(clean).length, syncMeta: metadata };
}

async function trackOrder(db, body) {
  const id = String(body.orderId || '').trim().toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const orders = await readCollection(db, 'orders');
  const order = orders.find((item) => String(item.id || '').toLowerCase() === id && String(item.email || '').toLowerCase() === email);
  if (!order) throw httpError('Order was not found. Check the order ID and email.', 404);
  return { ok: true, order };
}

async function login(env, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const expectedEmail = String(await readMeta(env.DB, 'admin_email', env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)).toLowerCase();
  const savedSalt = await readMeta(env.DB, 'admin_password_salt', '');
  const savedHash = await readMeta(env.DB, 'admin_password_hash', '');
  const salt = env.ADMIN_PASSWORD_SALT || savedSalt || DEFAULT_PASSWORD_SALT;
  const expectedHash = env.ADMIN_PASSWORD_HASH || savedHash || DEFAULT_PASSWORD_HASH;
  const actualHash = await passwordHash(String(body.password || ''), salt);
  if (email !== expectedEmail || !secureEqual(actualHash, expectedHash)) throw httpError('Email or password is incorrect.', 401);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(tokenHash, email, now + SESSION_TTL_MS, now),
  ]);
  return { ok: true, token, expiresIn: SESSION_TTL_MS / 1000 };
}

async function requireAuth(db, token) {
  if (!token) throw httpError('Your administrator session expired. Sign in again.', 401);
  const tokenHash = await sha256(token);
  const row = await db.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).first();
  if (!row || Number(row.expires_at) <= Date.now()) {
    if (row) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    throw httpError('Your administrator session expired. Sign in again.', 401);
  }
  return row.email;
}

async function serveProductMedia(request, env, pathname) {
  if (!env.MEDIA) return jsonResponse({ ok: false, error: 'Cloudflare R2 binding MEDIA is missing.' }, 503);
  let key = '';
  try { key = decodeURIComponent(pathname.slice('/media/'.length)); } catch { return jsonResponse({ ok: false, error: 'Invalid media path.' }, 400); }
  if (!key.startsWith('products/') || key.includes('..')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Image not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const contentType = headers.get('Content-Type') || object.customMetadata?.contentType || 'application/octet-stream';
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', 'inline');
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

async function handleStoreSync(request, env) {
  try {
    await ensureSchema(env);
    if (request.method === 'GET') {
      const action = new URL(request.url).searchParams.get('action') || 'bootstrap';
      if (action === 'bootstrap') return jsonResponse(await publicData(env.DB));
      return jsonResponse({ ok: true, service: 'INAM TECH ZONE Cloudflare Store API', version: STORE_VERSION, syncMeta: await syncMeta(env.DB) });
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: jsonHeaders });
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
    const requestUrl = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && origin !== requestUrl.origin) throw httpError('Cross-origin store changes are not allowed.', 403);
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_REQUEST_BYTES) throw httpError('Request is too large.', 413);

    let body;
    try { body = JSON.parse(await request.text()); } catch { throw httpError('Invalid JSON request.'); }
    const action = String(body.action || '');

    if (action === 'bootstrap') return jsonResponse(await publicData(env.DB));
    if (action === 'login') return jsonResponse(await login(env, body));
    if (action === 'trackOrder') return jsonResponse(await trackOrder(env.DB, body));
    if (action === 'createOrder') return jsonResponse(await createOrder(env.DB, body));
    if (action === 'createQuote') return jsonResponse(await createQuote(env.DB, body));

    await requireAuth(env.DB, body.token);
    if (action === 'getAdminData') return jsonResponse(await adminData(env.DB));
    if (action === 'initializeCatalog') return jsonResponse(await initializeCatalog(env.DB, body));
    if (action === 'saveProduct') return jsonResponse(await saveProduct(env, body.product));
    if (action === 'importProducts') return jsonResponse(await importProducts(env.DB, body.products));
    if (action === 'deleteProduct') return jsonResponse(await deleteProduct(env, body.productId));
    if (action === 'saveCategory') return jsonResponse(await saveCategory(env.DB, body.category));
    if (action === 'deleteCategory') return jsonResponse(await deleteRecordAction(env.DB, 'categories', body.categoryId, 'category'));
    if (action === 'saveCoupon') return jsonResponse(await saveCoupon(env.DB, body.coupon));
    if (action === 'deleteCoupon') return jsonResponse(await deleteRecordAction(env.DB, 'coupons', body.code, 'coupon'));
    if (action === 'deleteCustomer') return jsonResponse(await deleteRecordAction(env.DB, 'customers', body.customerId, 'customer'));
    if (action === 'deleteQuote') return jsonResponse(await deleteRecordAction(env.DB, 'quotes', body.quoteId, 'quote'));
    if (action === 'updateQuote') return jsonResponse(await updateRecord(env.DB, 'quotes', body.quoteId, { status: body.status }, 'quote'));
    if (action === 'deleteOrder') return jsonResponse(await deleteOrder(env.DB, body.orderId));
    if (action === 'updateOrder') return jsonResponse(await updateRecord(env.DB, 'orders', body.orderId, { status: body.status }, 'order'));
    if (action === 'updateOrderDetails') return jsonResponse(await saveOrder(env.DB, body.order));
    if (action === 'saveSettings') return jsonResponse(await saveSettings(env.DB, body.settings));
    if (action === 'uploadImage') return jsonResponse(await uploadImage(env, body));
    if (action === 'importImage') return jsonResponse(await importImage(env, body));
    if (action === 'uploadFile') return jsonResponse(await uploadCloudFile(env, body));
    if (action === 'listFiles') return jsonResponse(await listCloudFiles(env));
    if (action === 'downloadFile') return downloadCloudFile(env, body.key);
    if (action === 'deleteFile') return jsonResponse(await deleteCloudFile(env, body.key));
    if (action === 'migrateExternalImages') return jsonResponse(await migrateExternalImages(env));
    throw httpError(`Unknown action: ${action}`);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Cloudflare data request failed.' }, Number(error?.status || 400));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/store-sync' || url.pathname === '/api/store-sync/') return handleStoreSync(request, env);
    if (url.pathname.startsWith('/media/products/') && (request.method === 'GET' || request.method === 'HEAD')) return serveProductMedia(request, env, url.pathname);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
    if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
