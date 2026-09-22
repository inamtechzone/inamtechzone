export const PRODUCT_CSV_COLUMNS = [
  'id', 'name', 'slug', 'sku', 'category', 'brand', 'model', 'price', 'comparePrice', 'stock',
  'status', 'badge', 'rating', 'reviews', 'color', 'warranty', 'leadTime', 'featured',
  'image', 'image2', 'image3', 'image4', 'image5', 'image6', 'description', 'details',
];

export const PRODUCT_CSV_FILE_NAME = 'INAM-TECH-ZONE-PRODUCTS.csv';
export const PRODUCT_CSV_TEMPLATE_FILE_NAME = 'INAM-TECH-ZONE-PRODUCT-IMPORT-TEMPLATE.csv';
export const MAX_CSV_PRODUCTS = 250;
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const slugify = (value) => String(value || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aliases = {
  id: ['id', 'productid'],
  name: ['name', 'productname', 'title', 'producttitle'],
  slug: ['slug', 'handle'],
  sku: ['sku', 'productsku', 'code', 'itemcode'],
  category: ['category', 'productcategory'],
  brand: ['brand', 'manufacturer'],
  model: ['model', 'modelnumber'],
  price: ['price', 'saleprice', 'sellingprice'],
  comparePrice: ['compareprice', 'compareatprice', 'regularprice', 'mrp'],
  stock: ['stock', 'inventory', 'quantity', 'qty'],
  status: ['status', 'productstatus'],
  badge: ['badge', 'label'],
  rating: ['rating'],
  reviews: ['reviews', 'reviewcount'],
  color: ['color', 'configuration', 'variant'],
  warranty: ['warranty'],
  leadTime: ['leadtime', 'availability', 'deliverytime'],
  featured: ['featured', 'isfeatured'],
  image: ['image', 'image1', 'primaryimage', 'imageurl'],
  image2: ['image2'], image3: ['image3'], image4: ['image4'], image5: ['image5'], image6: ['image6'],
  gallery: ['gallery', 'images'],
  description: ['description', 'productdescription'],
  details: ['details', 'specifications', 'specs'],
};

function detectDelimiter(text) {
  const header = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const counts = [[',', (header.match(/,/g) || []).length], [';', (header.match(/;/g) || []).length], ['\t', (header.match(/\t/g) || []).length]];
  counts.sort((left, right) => right[1] - left[1]);
  return counts[0][1] ? counts[0][0] : ',';
}

function parseRows(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(input);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(cell); cell = ''; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error('CSV file has an unclosed quoted value. Please check the Excel sheet and save it again as CSV UTF-8.');
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function valueFrom(row, field) {
  for (const name of aliases[field] || [field]) {
    const key = normalizeHeader(name);
    if (Object.prototype.hasOwnProperty.call(row, key)) return String(row[key] ?? '').trim();
  }
  return '';
}

function numberFrom(value, fallback, field, rowNumber) {
  if (String(value).trim() === '') return fallback;
  const number = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(number) || number < 0) throw new Error(`Row ${rowNumber}: ${field} must be a valid positive number.`);
  return number;
}

function booleanFrom(value) {
  return ['1', 'true', 'yes', 'y', 'featured', 'active'].includes(String(value || '').trim().toLowerCase());
}

function listFrom(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean); } catch {}
  }
  return text.split(/\||\r?\n|;;/).map((item) => item.trim()).filter(Boolean);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeProductsCsv(products = []) {
  const lines = [PRODUCT_CSV_COLUMNS.join(',')];
  for (const product of products) {
    const images = [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])].filter(Boolean).slice(0, 6);
    const row = {
      id: product?.id || '', name: product?.name || '', slug: product?.slug || '', sku: product?.sku || '',
      category: product?.category || '', brand: product?.brand || '', model: product?.model || '',
      price: Number(product?.price || 0), comparePrice: Number(product?.comparePrice || 0), stock: Number(product?.stock || 0),
      status: product?.status || 'active', badge: product?.badge || '', rating: Number(product?.rating || 0), reviews: Number(product?.reviews || 0),
      color: product?.color || '', warranty: product?.warranty || '', leadTime: product?.leadTime || '', featured: product?.featured === true ? 'TRUE' : 'FALSE',
      image: images[0] || '', image2: images[1] || '', image3: images[2] || '', image4: images[3] || '', image5: images[4] || '', image6: images[5] || '',
      description: product?.description || '', details: (Array.isArray(product?.details) ? product.details : []).join(' | '),
    };
    lines.push(PRODUCT_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(','));
  }
  return lines.join('\r\n');
}

export function parseProductCsv(text, existingProducts = [], makeId) {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error('CSV contains no product rows. Download the template and add at least one product.');
  const headers = rows.shift().map(normalizeHeader);
  if (!headers.includes('name') && !headers.includes('productname') && !headers.includes('title') && !headers.includes('producttitle')) throw new Error('CSV is missing the name column. Use the provided INAM TECH ZONE template.');
  if (!headers.includes('sku') && !headers.includes('productsku') && !headers.includes('code') && !headers.includes('itemcode')) throw new Error('CSV is missing the SKU column. Use the provided INAM TECH ZONE template.');
  if (rows.length > MAX_CSV_PRODUCTS) throw new Error(`A single CSV can contain up to ${MAX_CSV_PRODUCTS} products.`);

  const byId = new Map(existingProducts.map((product) => [String(product.id || '').toLowerCase(), product]));
  const bySku = new Map(existingProducts.map((product) => [String(product.sku || '').toLowerCase(), product]));
  const csvSkus = new Set();
  const createId = typeof makeId === 'function' ? makeId : (rowNumber) => `PRD-IMPORT-${Date.now()}-${rowNumber}`;

  return rows.map((values, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
    const name = valueFrom(row, 'name');
    const sku = valueFrom(row, 'sku');
    if (!name) throw new Error(`Row ${rowNumber}: product name is required.`);
    if (!sku) throw new Error(`Row ${rowNumber}: SKU is required.`);
    const skuKey = sku.toLowerCase();
    if (csvSkus.has(skuKey)) throw new Error(`Row ${rowNumber}: duplicate SKU ${sku} exists in this CSV.`);
    csvSkus.add(skuKey);
    const providedId = valueFrom(row, 'id');
    const existing = byId.get(providedId.toLowerCase()) || bySku.get(skuKey) || {};
    const gallery = listFrom(valueFrom(row, 'gallery'));
    const images = [valueFrom(row, 'image'), valueFrom(row, 'image2'), valueFrom(row, 'image3'), valueFrom(row, 'image4'), valueFrom(row, 'image5'), valueFrom(row, 'image6'), ...gallery]
      .filter((image, imageIndex, all) => Boolean(image) && all.indexOf(image) === imageIndex).slice(0, 6);
    const statusValue = valueFrom(row, 'status').toLowerCase();
    const status = ['active', 'draft', 'archived'].includes(statusValue) ? statusValue : 'active';
    return {
      ...existing,
      id: existing.id || providedId || createId(rowNumber),
      name,
      slug: valueFrom(row, 'slug') || slugify(name),
      sku,
      category: valueFrom(row, 'category') || existing.category || 'Accessories',
      brand: valueFrom(row, 'brand'), model: valueFrom(row, 'model'),
      price: numberFrom(valueFrom(row, 'price'), 0, 'price', rowNumber),
      comparePrice: numberFrom(valueFrom(row, 'comparePrice'), 0, 'compare price', rowNumber),
      stock: numberFrom(valueFrom(row, 'stock'), 0, 'stock', rowNumber),
      status, badge: valueFrom(row, 'badge'),
      rating: numberFrom(valueFrom(row, 'rating'), 5, 'rating', rowNumber),
      reviews: numberFrom(valueFrom(row, 'reviews'), 0, 'reviews', rowNumber),
      color: valueFrom(row, 'color') || 'Standard', warranty: valueFrom(row, 'warranty'),
      leadTime: valueFrom(row, 'leadTime') || 'Ready to dispatch', featured: booleanFrom(valueFrom(row, 'featured')),
      image: images[0] || '/itz-logo-transparent.png', gallery: images.slice(1),
      description: valueFrom(row, 'description'), details: listFrom(valueFrom(row, 'details')),
    };
  });
}
