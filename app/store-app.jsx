'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categoriesSeed,
  couponSeed,
  customerSeed,
  defaultSettings,
  formatMoney,
  orderSeed,
  productSeed,
  quoteSeed,
} from './store-data';
import {
  MAX_CSV_BYTES,
  parseProductCsv,
  PRODUCT_CSV_FILE_NAME,
  PRODUCT_CSV_TEMPLATE_FILE_NAME,
  serializeProductsCsv,
} from './product-csv';

const storageKey = (name) => `inam-tech-zone:v3:${name}`;
const serverSyncProxy = '/api/store-sync';
const SHARED_DATA_REFRESH_MS = 3000;
const developmentPreview = process.env.NODE_ENV === 'development';
const requiredNavigation = ['Home', 'Products', 'Solutions', 'Services', 'Support'];
const publicRoutes = { home: '/', shop: '/products', solutions: '/solutions', services: '/services', support: '/support' };
const viewForPath = (path) => ({ '/products': 'shop', '/solutions': 'solutions', '/services': 'services', '/support': 'support' }[path] || 'home');
const viewForLink = (label) => ({ home: 'home', featured: 'home', products: 'shop', shop: 'shop', solutions: 'solutions', services: 'services', support: 'support' }[String(label).trim().toLowerCase()] || 'shop');
const uid = (prefix = 'ID') => `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
const categoryIcons = { Hardware: '⬡', 'Power Tools': '⚒', Electrical: 'ϟ', 'CCTV & Surveillance': '◉', 'Solar Energy': '☀', Networking: '⌘', 'Alarm Systems': '◌', 'Access Control': '◆', 'Fire Alarm': '△', Accessories: '＋' };
const productImages = (product) => [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])].filter((url, index, images) => Boolean(url) && images.indexOf(url) === index).slice(0, 6);
const imageFallback = '/itz-logo-transparent.png';
const maxImageBytes = 6 * 1024 * 1024;
const maxCloudFileBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const acceptedCloudFileTypes = new Set([...acceptedImageTypes, 'application/pdf', 'text/plain', 'text/csv', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed']);
const cloudFileMime = (file) => String(file?.type || ({ pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip' }[String(file?.name || '').split('.').pop()?.toLowerCase()] || '')).toLowerCase();

const deliveryRate = (settings) => settings?.deliveryChargesEnabled === false ? 0 : Math.max(0, Number(settings?.flatShippingRate || 0));
const freeDeliveryThreshold = (settings) => Math.max(0, Number(settings?.freeShippingThreshold || 0));
const calculateDeliveryCharge = (subtotal, settings, couponType = '') => {
  const rate = deliveryRate(settings);
  const threshold = freeDeliveryThreshold(settings);
  if (!rate || couponType === 'shipping' || (threshold > 0 && Number(subtotal || 0) >= threshold)) return 0;
  return rate;
};
const deliverySummary = (subtotal, settings, couponType = '') => {
  const charge = calculateDeliveryCharge(subtotal, settings, couponType);
  const threshold = freeDeliveryThreshold(settings);
  if (!charge) return 'Complimentary delivery';
  if (threshold > 0) return `${formatMoney(charge, settings)} delivery · Free from ${formatMoney(threshold, settings)}`;
  return `${formatMoney(charge, settings)} delivery charge`;
};

function imageSources(value) {
  const source = String(value || '').trim();
  return [source || imageFallback, imageFallback].filter((item, index, list) => list.indexOf(item) === index);
}

function StoreImage({ src, alt = '', className = '', decoding = 'async', ...props }) {
  const candidates = useMemo(() => imageSources(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => { setCandidateIndex(0); }, [src]);
  const safeIndex = Math.min(candidateIndex, Math.max(0, candidates.length - 1));
  const currentSource = candidates[safeIndex] || imageFallback;
  const fallback = safeIndex === candidates.length - 1 && currentSource === imageFallback;
  return <img {...props} src={currentSource} alt={alt} decoding={decoding} draggable="false" referrerPolicy="no-referrer" className={`${className} store-image${fallback ? ' store-image-fallback' : ''}`.trim()} onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length - 1))} />;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !acceptedImageTypes.has(String(file.type || '').toLowerCase())) {
      reject(new Error('Choose a JPG, PNG, WebP, GIF or AVIF image.'));
      return;
    }
    if (!file.size || file.size > maxImageBytes) {
      reject(new Error('Each product image must be 6 MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function readCloudFile(file) {
  return new Promise((resolve, reject) => {
    const mimeType = cloudFileMime(file);
    if (!file || !acceptedCloudFileTypes.has(mimeType)) {
      reject(new Error('Allowed files: images, PDF, TXT, CSV, JSON, Word, Excel, PowerPoint and ZIP.'));
      return;
    }
    if (!file.size || file.size > maxCloudFileBytes) {
      reject(new Error('Each cloud file must be 10 MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;,]*;base64,/, `data:${mimeType};base64,`));
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });
}

const formatFileSize = (bytes) => Number(bytes || 0) >= 1024 * 1024
  ? `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`;

function BrandLockup({ settings }) {
  return <span className="brand-lockup"><span className="brand-monogram brand-logo-media"><img src="/itz-logo-transparent.png" alt="" /></span><span className="brand-wordmark">{settings.brandName}</span></span>;
}

function ThemeToggle({ mode, onToggle, className = '' }) {
  const dark = mode === 'dark';
  return <button type="button" className={`theme-toggle ${className}`} onClick={onToggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`}>
    <span className="theme-toggle-track" aria-hidden="true"><i>{dark ? '☀' : '☾'}</i></span>
    <b>{dark ? 'Light' : 'Dark'}</b>
  </button>;
}

function downloadDatasheet(product, settings) {
  const lines = [settings.brandName, 'TECHNICAL PRODUCT DATASHEET', '', product.name, `SKU: ${product.sku}`, `Brand / model: ${product.brand || '—'} / ${product.model || '—'}`, `Category: ${product.category}`, `Warranty: ${product.warranty || 'Contact sales'}`, `Availability: ${product.leadTime || 'Contact sales'}`, '', 'OVERVIEW', product.description, '', 'KEY SPECIFICATIONS', ...(product.details || []).map((item) => `• ${item}`), '', `Generated by ${settings.brandName}`];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${product.slug || product.sku}-datasheet.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadCsvFile(contents, fileName) {
  const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(key));
      if (saved) {
        // Syncing the external browser store is the purpose of this mount effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(JSON.parse(saved));
      }
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey(key), JSON.stringify(value)); } catch {}
  }, [hydrated, key, value]);
  useEffect(() => {
    const updateFromAnotherTab = (event) => {
      if (event.key !== storageKey(key) || !event.newValue) return;
      try { setValue(JSON.parse(event.newValue)); } catch {}
    };
    window.addEventListener('storage', updateFromAnotherTab);
    return () => window.removeEventListener('storage', updateFromAnotherTab);
  }, [key]);
  return [value, setValue, hydrated];
}

function useSessionState(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey(key));
      // Restore only the current-tab administrator session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setValue(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(storageKey(key), JSON.stringify(value)); } catch {}
  }, [hydrated, key, value]);
  return [value, setValue, hydrated];
}

async function apiCall(endpoint, action, payload = {}, token = '') {
  if (!endpoint) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...payload }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({ ok: false, error: `Invalid synchronization response (${response.status})` }));
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || `Server returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Synchronization timed out after 45 seconds. The change was not confirmed; refresh before trying again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function fetchBootstrap(endpoint) {
  const response = await fetch(`${endpoint}?action=bootstrap&_=${Date.now()}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({ ok: false, error: `Invalid synchronization response (${response.status})` }));
  if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
  if (!data.ok) throw new Error(data.error || 'Could not load shared store data.');
  return data;
}

function StoreHeader({ settings, categories, cartCount, wishlistCount, colorMode, currentView, onThemeToggle, onCart, onSearch, onNavigate, onMenu, menuOpen, onQuote, onTrack }) {
  const configured = (settings.headerLinks || []).map((link) => String(link).trim()).filter(Boolean).map((link) => link.toLowerCase() === 'featured' ? 'Home' : link);
  const navigation = [...configured, ...requiredNavigation.filter((required) => !configured.some((link) => link.toLowerCase() === required.toLowerCase()))];
  return <>
    <div className="announcement"><span>{settings.announcement}</span><span className="announcement-note">{settings.announcementNote}</span></div>
    <header className="site-header">
      <button className="mobile-menu-button" onClick={onMenu} aria-label="Toggle menu" aria-expanded={menuOpen}>{menuOpen ? '×' : '☰'}</button>
      <button className="brand button-reset" onClick={() => onNavigate('home')} aria-label={`${settings.brandName} home`}><BrandLockup settings={settings} /></button>
      <nav className={`desktop-nav ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        {navigation.map((link) => { const target = viewForLink(link); return <button className={currentView === target ? 'active' : ''} key={link} onClick={() => onNavigate(target)}>{link}</button>; })}
        <div className="mobile-category-nav"><span>Browse categories</span><label className="mobile-category-select"><select defaultValue="" aria-label="Browse product categories" onChange={(event) => event.target.value && onNavigate('shop', event.target.value)}><option value="" disabled>Select a category</option>{categories.filter((category) => category.active).map((category) => <option value={category.name} key={category.id}>{category.name}</option>)}</select></label></div>
      </nav>
      <div className="header-actions">
        <button className="text-action track-action" onClick={onTrack}>Track order</button>
        <button className="text-action" onClick={onSearch}>Search</button>
        {settings.quoteEnabled && <button className="quote-header" onClick={() => onQuote(null)}>Request quote</button>}
        <ThemeToggle mode={colorMode} onToggle={onThemeToggle} />
        <button className="circle-action" onClick={() => onNavigate('wishlist')} aria-label={`Wishlist with ${wishlistCount} items`}>♡<i>{wishlistCount || ''}</i></button>
        <button className="bag-action" onClick={onCart} aria-label={`Shopping cart with ${cartCount} items`}>Cart <span>{cartCount}</span></button>
      </div>
    </header>
  </>;
}

function Hero({ settings, featured, onShop, onProduct, onQuote }) {
  const heroProduct = featured || productSeed[3];
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="eyebrow">{settings.heroEyebrow}</p>
      <h1 id="hero-title">{settings.heroTitle}<br /><em>{settings.heroAccent}</em></h1>
      <p className="hero-description">{settings.heroDescription}</p>
      <div className="hero-actions">
        <button className="button button-dark" onClick={onShop}>Shop technical range <span>↗</span></button>
        {settings.quoteEnabled && <button className="text-link button-reset" onClick={() => onQuote(heroProduct)}>Request project quote <span>→</span></button>}
      </div>
      <div className="hero-proof"><div><strong>10+</strong><span>Specialist categories</span></div><div><strong>24/7</strong><span>Project assistance</span></div><div><strong>100%</strong><span>Secure checkout</span></div></div>
    </div>
    <div className="hero-visual">
      <StoreImage src={settings.heroImage} alt={heroProduct.name} />
      <div className="image-badge"><span>ITZ</span> Engineered solutions</div>
      <button className="floating-product" onClick={() => onProduct(heroProduct)}><p>{heroProduct.name}</p><span>{formatMoney(heroProduct.price, settings)} · {heroProduct.badge || 'Project grade'} →</span></button>
    </div>
  </section>;
}

function ProductCard({ product, settings, onProduct, onAdd, wished, onWish, onCompare, compared }) {
  return <article className="product-card">
    <div className="product-card-image">
      {product.badge && <span className="product-badge">{product.badge}</span>}
      <button className={`wish-button ${wished ? 'wished' : ''}`} onClick={() => onWish(product.id)} aria-label={`${wished ? 'Remove from' : 'Add to'} wishlist`}>{wished ? '♥' : '♡'}</button>
      <button className="image-button" onClick={() => onProduct(product)}><StoreImage src={product.image} alt={product.name} loading="lazy" /></button>
      <button className="quick-add" onClick={() => onAdd(product)}>Quick add <span>＋</span></button>
    </div>
    <div className="product-card-meta"><p>{product.category} · {product.color}</p><span>★ {product.rating}</span></div>
    <button className="product-title button-reset" onClick={() => onProduct(product)}>{product.name}</button>
    <div className="product-price"><strong>{formatMoney(product.price, settings)}</strong>{product.comparePrice > product.price && <del>{formatMoney(product.comparePrice, settings)}</del>}</div>
    {settings.compareEnabled && <button className={`compare-button ${compared ? 'active' : ''}`} onClick={() => onCompare(product.id)}>{compared ? '✓ Added to compare' : '＋ Compare specifications'}</button>}
  </article>;
}

function HomeView({ settings, products, categories, wishlist, compare, onProduct, onAdd, onWish, onCompare, onShop, onQuote }) {
  const active = products.filter((p) => p.status === 'active');
  return <>
    <Hero settings={settings} featured={active.find((p) => p.slug === '24-port-gigabit-poe-switch')} onShop={onShop} onProduct={onProduct} onQuote={onQuote} />
    <section className="category-strip" aria-label="Shop categories"><span>Shop by category</span>{categories.filter((c) => c.active).map((category) => <button key={category.id} onClick={() => onShop(category.name)}>{category.name}</button>)}</section>
    <section className="category-showcase"><div className="section-heading"><div><p className="eyebrow">Everything for the job</p><h2>Shop by system</h2></div><p>From a single replacement part to a complete site deployment.</p></div><div className="category-grid">{categories.filter((c) => c.active).map((category, index) => <button key={category.id} onClick={() => onShop(category.name)}><span>{categoryIcons[category.name] || '＋'}</span><small>{String(index + 1).padStart(2, '0')}</small><strong>{category.name}</strong><i>Explore range →</i></button>)}</div></section>
    <section className="product-section">
      <div className="section-heading"><div><p className="eyebrow">Professional selection</p><h2>Project-ready essentials</h2></div><button className="text-link button-reset" onClick={() => onShop()}>View all {active.length} products <span>→</span></button></div>
      <div className="product-grid home-grid">{active.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} settings={settings} onProduct={onProduct} onAdd={onAdd} onWish={onWish} onCompare={onCompare} compared={compare.includes(product.id)} wished={wishlist.includes(product.id)} />)}</div>
    </section>
    <section className="solutions-section" id="solutions"><div className="solutions-copy"><p className="eyebrow">INAM project desk</p><h2>One partner.<br /><em>Complete systems.</em></h2><p>Tell us what you are building. Our team can help scope products, check compatibility and prepare a project quote.</p><button className="button button-light" onClick={() => onQuote(null)}>Start a project brief <span>→</span></button></div><div className="solutions-grid">{[['01','CCTV design','Camera, lens, storage and PoE planning.'],['02','Solar systems','Panels, inverter and protection sizing.'],['03','Network rollout','Switching, cabling and rack architecture.'],['04','Life safety','Alarm, access and fire system packages.']].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}</div></section>
    <section className="values-row"><div><span>01</span><strong>Project-grade selection</strong><p>Clear specifications and compatible system components.</p></div><div><span>02</span><strong>Technical guidance</strong><p>Useful answers before, during and after your purchase.</p></div><div><span>03</span><strong>Nationwide fulfillment</strong><p>Secure packing, tracked dispatch and transparent updates.</p></div></section>
  </>;
}

function ShopView({ products, categories, settings, wishlist, compare, onProduct, onAdd, onWish, onCompare, initialCategory }) {
  const [category, setCategory] = useState(initialCategory || 'All');
  const [sort, setSort] = useState('featured');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    let list = products.filter((p) => p.status === 'active' && (category === 'All' || p.category === category) && `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, category, sort, query]);
  return <div className="shop-page page-shell">
    <div className="shop-heading"><p className="eyebrow">Technical catalog</p><h1>Products for <em>real projects.</em></h1><p>{filtered.length} hardware, power, security and connectivity products.</p></div>
    <div className="shop-toolbar">
      <label className="category-dropdown"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter products by category"><option value="All">All categories</option>{categories.filter((c) => c.active).map((c) => <option value={c.name} key={c.id}>{c.name}</option>)}</select></label>
      <div className="shop-tools"><label className="shop-search">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" /></label><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Top rated</option></select></div>
    </div>
    {filtered.length ? <div className="product-grid catalog-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} settings={settings} onProduct={onProduct} onAdd={onAdd} onWish={onWish} onCompare={onCompare} compared={compare.includes(product.id)} wished={wishlist.includes(product.id)} />)}</div> : <div className="empty-state"><span>⌕</span><h2>No products found</h2><p>Try another category or a broader search.</p></div>}
  </div>;
}

function ProductModal({ product, settings, categories, onClose, onAdd, wished, onWish, onQuote, onCompare, compared, onCategory }) {
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(productImages(product)[0] || '');
  const images = productImages(product);
  const imageSignature = images.join('|');
  const activeIndex = Math.max(0, images.indexOf(activeImage || images[0]));
  const showImage = (offset) => {
    if (images.length < 2) return;
    setActiveImage(images[(activeIndex + offset + images.length) % images.length]);
  };
  useEffect(() => {
    // Keep the detail preview aligned with a newly saved primary image or gallery.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveImage(images[0] || '');
  }, [product?.id, imageSignature]);
  useEffect(() => {
    if (!product) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [product, onClose]);
  if (!product) return null;
  return <div className="overlay" role="dialog" aria-modal="true" aria-label={product.name} onMouseDown={onClose}>
    <div className="product-modal" onMouseDown={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close product">×</button>
      <div className={`product-detail-media ${images.length > 1 ? 'has-gallery' : 'single-image'}`}>
        <div className="product-detail-image">
          <div className="product-image-stage">
            <StoreImage className="product-detail-main-image" src={activeImage || images[0]} alt={`${product.name} — image ${activeIndex + 1} of ${images.length}`} loading="eager" fetchPriority="high" />
            {product.badge && <span className="product-stage-badge">{product.badge}</span>}
            {images.length > 1 && <><button type="button" className="gallery-arrow gallery-previous" onClick={() => showImage(-1)} aria-label="Previous product image">‹</button><button type="button" className="gallery-arrow gallery-next" onClick={() => showImage(1)} aria-label="Next product image">›</button><small className="gallery-counter" aria-live="polite">{activeIndex + 1} / {images.length}</small></>}
          </div>
        </div>
        {images.length > 1 && <div className="product-gallery-thumbs" aria-label="Product images">{images.map((image, index) => <button type="button" className={(activeImage || images[0]) === image ? 'active' : ''} key={`${image}-${index}`} onClick={() => setActiveImage(image)} aria-label={`View product image ${index + 1}`} aria-current={(activeImage || images[0]) === image ? 'true' : undefined}><StoreImage className="product-gallery-thumb-image" src={image} alt="" loading="lazy" /></button>)}</div>}
      </div>
      <div className="product-detail-copy">
        <div className="product-breadcrumb"><button onClick={() => onCategory('')}>Products</button><span>/</span><button onClick={() => onCategory(product.category)}>{product.category}</button><span>/</span><b>{product.sku}</b></div>
        <p className="eyebrow">{product.category} · {product.sku}</p><h2>{product.name}</h2><p className="detail-model">{product.brand || 'INAM Select'} · {product.model || product.sku}</p>
        <div className="detail-rating"><span>★★★★★</span> {product.rating} · {product.reviews} reviews</div>
        <div className="detail-price">{formatMoney(product.price, settings)} {product.comparePrice > product.price && <del>{formatMoney(product.comparePrice, settings)}</del>}</div>
        <p className="detail-description">{product.description}</p>
        <div className="detail-choice"><span>Configuration</span><button><i style={{ background: product.color?.includes('Red') ? '#b92323' : '#263548' }} />{product.color}</button></div>
        <ul className="detail-list">{product.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        <div className="spec-table"><span>Warranty<strong>{product.warranty || 'Contact sales'}</strong></span><span>Lead time<strong>{product.leadTime || 'Ready to dispatch'}</strong></span></div>
        <div className="detail-stock"><span className={product.stock < 10 ? 'low' : ''} />{product.stock < 10 ? `Only ${product.stock} left` : 'In stock and ready to ship'}</div>
        <div className="detail-delivery"><span>Delivery</span><strong>{deliverySummary(product.price * qty, settings)}</strong></div>
        <div className="detail-actions"><div className="qty-stepper"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span>{qty}</span><button onClick={() => setQty(qty + 1)}>＋</button></div><button className="button button-dark grow" onClick={() => { onAdd(product, qty); onClose(); }}>Add to bag <span>{formatMoney(product.price * qty, settings)}</span></button><button className={`detail-wish ${wished ? 'wished' : ''}`} onClick={() => onWish(product.id)}>{wished ? '♥' : '♡'}</button></div>
        <div className="detail-secondary">{settings.quoteEnabled && <button onClick={() => onQuote(product)}>Request project pricing</button>}{settings.compareEnabled && <button onClick={() => onCompare(product.id)}>{compared ? '✓ In comparison' : '＋ Compare product'}</button>}{settings.technicalDownloadsEnabled && <button onClick={() => downloadDatasheet(product, settings)}>↓ Download datasheet</button>}</div>
        <div className="detail-services"><span>✓ Verified specifications</span><span>✓ Secure checkout</span><span>✓ Technical support</span></div>
        <label className="detail-category-select"><span>Explore categories</span><select value={product.category} onChange={(event) => onCategory(event.target.value)} aria-label="Open another product category"><option value="">All products</option>{categories.filter((category) => category.active).map((category) => <option value={category.name} key={category.id}>{category.name}</option>)}</select></label>
      </div>
    </div>
  </div>;
}

function QuoteModal({ open, product, categories, settings, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    await onSubmit({ ...Object.fromEntries(new FormData(event.currentTarget)), product: product?.name || '', productId: product?.id || '' });
    setSubmitting(false);
  };
  return <div className="overlay quote-overlay" role="dialog" aria-modal="true" aria-label="Request project quote" onMouseDown={onClose}><form className="quote-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="quote-intro"><p className="eyebrow">INAM project desk</p><h2>Request a professional quote.</h2><p>Share the scope and our team will review product fit, quantity pricing and availability.</p><div><span>01</span> Technical review</div><div><span>02</span> Compatibility check</div><div><span>03</span> Project pricing</div></div><div className="quote-form"><div className="form-grid"><label>Name<input name="customer" required /></label><label>Company<input name="company" /></label><label>Email<input name="email" type="email" required /></label><label>Phone / WhatsApp<input name="phone" type="tel" required /></label><label>Project type<select name="projectType" defaultValue={product?.category || categories[0]?.name}>{categories.filter((item) => item.active).map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label>Required quantity<input name="quantity" type="number" min="1" defaultValue="1" /></label><label className="full">Product / system<input name="productLabel" defaultValue={product?.name || ''} placeholder="Product name or complete system" /></label><label className="full">Project details<textarea name="message" rows="4" placeholder="Site type, quantities, compatibility needs, delivery city…" /></label></div><label className="checkbox-label"><input type="checkbox" required /> I agree to be contacted about this request.</label><button className="button button-dark" disabled={submitting}>{submitting ? 'Sending request…' : 'Send quote request'} <span>→</span></button><small>Response target: within one business day · {settings.supportPhone}</small></div></form></div>;
}

function ComparePanel({ ids, products, settings, onRemove, onClear, onClose, onProduct }) {
  const selected = ids.map((id) => products.find((item) => item.id === id)).filter(Boolean);
  if (!selected.length) return null;
  return <div className="overlay compare-overlay" role="dialog" aria-modal="true" aria-label="Product comparison" onMouseDown={onClose}><section className="compare-panel" onMouseDown={(event) => event.stopPropagation()}><div className="compare-head"><div><p className="eyebrow">Side-by-side</p><h2>Technical comparison</h2><p>Compare up to three products before adding them to your project.</p></div><div><button onClick={onClear}>Clear all</button><button onClick={onClose}>×</button></div></div><div className={`compare-grid count-${selected.length}`}>{selected.map((item) => <article key={item.id}><button className="compare-remove" onClick={() => onRemove(item.id)}>×</button><StoreImage src={item.image} alt={item.name} loading="lazy" /><p>{item.category}</p><button className="compare-title" onClick={() => { onClose(); onProduct(item); }}>{item.name}</button><strong>{formatMoney(item.price, settings)}</strong><dl><div><dt>Brand / model</dt><dd>{item.brand || '—'} · {item.model || '—'}</dd></div><div><dt>Warranty</dt><dd>{item.warranty || 'Contact sales'}</dd></div><div><dt>Availability</dt><dd>{item.leadTime || 'Contact sales'}</dd></div>{(item.details || []).slice(0, 4).map((spec) => <div key={spec}><dt>Specification</dt><dd>{spec}</dd></div>)}</dl></article>)}</div></section></div>;
}

function TrackOrderModal({ open, orders, settings, onClose }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  if (!open) return null;
  const search = async (event) => {
    event.preventDefault(); setSearching(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      let order;
      if (settings.apiEndpoint) {
        const response = await apiCall(settings.apiEndpoint, 'trackOrder', { orderId: fields.orderId, email: fields.email });
        order = response?.order;
      } else {
        order = orders.find((item) => item.id.toLowerCase() === String(fields.orderId).trim().toLowerCase() && item.email.toLowerCase() === String(fields.email).trim().toLowerCase());
      }
      if (!order) throw new Error('Order not found. Check the order ID and email address.');
      setResult(order);
    } catch (searchError) { setResult(null); setError(searchError.message); }
    setSearching(false);
  };
  const currentIndex = result ? Math.max(0, orderStages.indexOf(result.status === 'Processing' ? 'Processing' : result.status)) : 0;
  return <div className="overlay track-order-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}><section className="track-order-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="track-order-intro"><span className="track-logo">ITZ</span><p className="eyebrow">Shipment intelligence</p><h2>Track your order.</h2><p>Enter the same email used at checkout and your INAM TECH ZONE order number.</p><form onSubmit={search}><label>Order number<input name="orderId" required placeholder="ITZ-1083" /></label><label>Email address<input name="email" type="email" required placeholder="you@example.com" /></label><button className="button button-dark" disabled={searching}>{searching ? 'Checking…' : 'Track shipment'} <span>→</span></button>{error && <div className="track-error">{error}</div>}</form></div><div className="track-order-result">{result ? <><div className="track-result-head"><div><p className="eyebrow">Order found</p><h3>{result.id}</h3><span>Placed {result.date} · {result.items} items</span></div><b className={`status ${String(result.status).toLowerCase().replace(' ', '-')}`}>{result.status}</b></div><div className="customer-tracking-stages">{orderStages.map((stage, index) => <div className={index <= currentIndex ? 'complete' : ''} key={stage}><i>{index < currentIndex ? '✓' : index + 1}</i><span><strong>{stage}</strong><small>{index <= currentIndex ? (result.timeline?.find((entry) => entry.stage === stage)?.date?.slice(0, 10) || result.date) : 'Pending'}</small></span></div>)}</div><div className="track-facts"><span>Courier<strong>{result.courier || 'Being assigned'}</strong></span><span>Tracking ID<strong>{result.trackingNumber || 'Not assigned yet'}</strong></span><span>Estimated delivery<strong>{result.estimatedDelivery || 'To be confirmed'}</strong></span><span>Order total<strong>{formatMoney(result.total, settings)}</strong></span></div><div className="track-latest"><span>Latest update</span><strong>{result.timeline?.at(-1)?.note || `Order is ${String(result.status).toLowerCase()}.`}</strong><small>{String(result.timeline?.at(-1)?.date || result.date).replace('T', ' ').slice(0, 16)}</small></div></> : <div className="track-placeholder"><span>◎</span><h3>Live order progress</h3><p>Your confirmed, packed, shipped and delivered milestones will appear here.</p><div><i /><i /><i /><i /><i /></div></div>}</div></section></div>;
}

function CartDrawer({ open, cart, products, settings, onClose, onQty, onRemove, onCheckout }) {
  const lines = cart.map((line) => ({ ...line, product: products.find((p) => p.id === line.id) })).filter((line) => line.product);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const threshold = freeDeliveryThreshold(settings);
  const shipping = calculateDeliveryCharge(subtotal, settings);
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 0;
  return <><div className={`drawer-scrim ${open ? 'show' : ''}`} onClick={onClose} /><aside className={`cart-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
    <div className="drawer-header"><div><p className="eyebrow">Your selection</p><h2>Shopping bag <sup>{lines.reduce((n, l) => n + l.qty, 0)}</sup></h2></div><button onClick={onClose} aria-label="Close bag">×</button></div>
    {threshold > 0 && shipping > 0 ? <div className="shipping-progress"><p>Add {formatMoney(threshold - subtotal, settings)} for complimentary delivery</p><div><span style={{ width: `${progress}%` }} /></div></div> : shipping === 0 ? <div className="shipping-earned">✓ Complimentary delivery on this order</div> : <div className="shipping-charge-banner">Delivery charge: <strong>{formatMoney(shipping, settings)}</strong></div>}
    <div className="cart-lines">{lines.length ? lines.map(({ product, qty }) => <div className="cart-line" key={product.id}><StoreImage src={product.image} alt="" loading="lazy" /><div><p>{product.category}</p><h3>{product.name}</h3><span>{product.color}</span><div className="mini-stepper"><button onClick={() => onQty(product.id, -1)}>−</button><b>{qty}</b><button onClick={() => onQty(product.id, 1)}>＋</button></div></div><div className="cart-line-end"><button onClick={() => onRemove(product.id)}>Remove</button><strong>{formatMoney(product.price * qty, settings)}</strong></div></div>) : <div className="empty-cart"><span>○</span><h3>Your bag is waiting</h3><p>Start with something designed to stay.</p><button className="button button-dark" onClick={onClose}>Continue shopping</button></div>}</div>
    {lines.length > 0 && <div className="cart-summary"><div><span>Subtotal</span><strong>{formatMoney(subtotal, settings)}</strong></div><div className="cart-delivery-line"><span>Delivery charges</span><strong>{shipping ? formatMoney(shipping, settings) : 'Complimentary'}</strong></div><div className="cart-estimated-total"><span>Estimated total</span><strong>{formatMoney(subtotal + shipping, settings)}</strong></div><p>Tax, if enabled, is calculated at checkout.</p><button className="button button-dark" onClick={onCheckout}>Secure checkout <span>→</span></button><small>Encrypted payments · Easy returns · Human support</small></div>}
  </aside></>;
}

function CheckoutView({ cart, products, settings, couponList, onBack, onPlaceOrder }) {
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(null);
  const [payment, setPayment] = useState(settings.codEnabled ? 'cod' : 'card');
  const [submitting, setSubmitting] = useState(false);
  const checkoutRequestRef = useRef(uid('ITZ'));
  const lines = cart.map((line) => ({ ...line, product: products.find((p) => p.id === line.id) })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const discount = applied?.type === 'percent' ? subtotal * applied.value / 100 : applied?.type === 'fixed' ? applied.value : 0;
  const shipping = calculateDeliveryCharge(subtotal, settings, applied?.type);
  const tax = (subtotal - discount) * (settings.taxRate / 100);
  const total = Math.max(0, subtotal - discount + shipping + tax);
  const applyCoupon = () => setApplied(couponList.find((c) => c.active && c.code === coupon.trim().toUpperCase()) || false);
  const submit = async (e) => { e.preventDefault(); setSubmitting(true); const fields = Object.fromEntries(new FormData(e.currentTarget)); try { await onPlaceOrder({ requestId: checkoutRequestRef.current, customer: fields, payment, lines, subtotal, discount, shipping, tax, total, coupon: applied?.code || '' }); } finally { setSubmitting(false); } };
  return <div className="checkout-page">
    <header className="checkout-header"><button className="brand button-reset" onClick={onBack}><BrandLockup settings={settings} /></button><span>Secure checkout</span><button className="button-reset" onClick={onBack}>← Return to store</button></header>
    <div className="checkout-layout"><form className="checkout-form" onSubmit={submit}>
      <div className="checkout-title"><p className="eyebrow">Final step</p><h1>Checkout</h1><p>Complete your details below. Your information is encrypted and protected.</p></div>
      <section className="form-section"><div className="form-section-number">01</div><div className="form-section-body"><h2>Contact</h2><label>Email address<input required name="email" type="email" placeholder="you@example.com" /></label><label className="checkbox-label"><input type="checkbox" defaultChecked /> Keep me informed about new releases</label></div></section>
      <section className="form-section"><div className="form-section-number">02</div><div className="form-section-body"><h2>Delivery</h2><div className="form-grid"><label>First name<input required name="firstName" /></label><label>Last name<input required name="lastName" /></label><label className="full">Street address<input required name="address" /></label><label>City<input required name="city" /></label><label>Province / Region<input required name="region" /></label><label>Postal code<input required name="postal" /></label><label>Country<select name="country" defaultValue="Pakistan"><option>Pakistan</option><option>United Arab Emirates</option><option>Saudi Arabia</option><option>United Kingdom</option><option>United States</option></select></label><label className="full">Phone / WhatsApp<input required name="phone" type="tel" /></label></div></div></section>
      <section className="form-section"><div className="form-section-number">03</div><div className="form-section-body"><h2>Payment</h2><div className="payment-options">{settings.cardEnabled && <button type="button" className={payment === 'card' ? 'selected' : ''} onClick={() => setPayment('card')}><span>Credit / debit card</span><small>Visa · Mastercard · Amex</small></button>}{settings.codEnabled && <button type="button" className={payment === 'cod' ? 'selected' : ''} onClick={() => setPayment('cod')}><span>Cash on delivery</span><small>Pay when your order arrives</small></button>}{settings.bankEnabled && <button type="button" className={payment === 'bank' ? 'selected' : ''} onClick={() => setPayment('bank')}><span>Bank transfer</span><small>Instructions after order</small></button>}</div>{payment === 'card' && <div className="card-fields"><label>Card number<input required placeholder="4242 4242 4242 4242" inputMode="numeric" /></label><label>Expiry<input required placeholder="MM / YY" /></label><label>CVC<input required placeholder="123" /></label><p>Demo checkout: connect your payment gateway web endpoint in Settings before accepting live card payments.</p></div>}</div></section>
      <button className="button button-dark place-order" disabled={submitting || !lines.length}>{submitting ? 'Placing order…' : `Place order · ${formatMoney(total, settings)}`} <span>→</span></button>
    </form><aside className="order-summary"><p className="eyebrow">Order summary</p><h2>{lines.reduce((n, l) => n + l.qty, 0)} items</h2><div className="summary-lines">{lines.map(({ product, qty }) => <div key={product.id}><StoreImage src={product.image} alt="" loading="lazy" /><span><b>{product.name}</b><small>{product.color} · Qty {qty}</small></span><strong>{formatMoney(product.price * qty, settings)}</strong></div>)}</div><div className="checkout-delivery-notice"><span>Delivery charges</span><strong>{deliverySummary(subtotal, settings, applied?.type)}</strong></div><div className="coupon-box"><input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Discount code" /><button onClick={applyCoupon}>Apply</button></div>{applied === false && <p className="coupon-error">That code is not valid.</p>}{applied && <p className="coupon-success">✓ {applied.code} applied</p>}<div className="totals"><p><span>Subtotal</span><b>{formatMoney(subtotal, settings)}</b></p>{discount > 0 && <p><span>Discount</span><b>−{formatMoney(discount, settings)}</b></p>}<p><span>Delivery charges</span><b>{shipping ? formatMoney(shipping, settings) : 'Complimentary'}</b></p><p><span>Estimated tax</span><b>{formatMoney(tax, settings)}</b></p><p className="total"><span>Total</span><b>{formatMoney(total, settings)}</b></p></div></aside></div>
  </div>;
}

function SuccessView({ order, settings, onHome }) {
  return <div className="success-page"><div className="success-mark">✓</div><p className="eyebrow">Order confirmed</p><h1>Thank you, {order?.shippingAddress?.firstName || String(order?.customer || '').split(' ')[0] || 'friend'}.</h1><p>Your order <strong>{order?.id}</strong> has been received. We&apos;ve sent the details to {order?.email || order?.shippingAddress?.email}.</p><div className="success-card"><span>Estimated dispatch</span><strong>Within 48 hours</strong><span>Delivery charges</span><strong>{Number(order?.shipping || 0) ? formatMoney(order.shipping, settings) : 'Complimentary'}</strong><span>Order total</span><strong>{formatMoney(order?.total || 0, settings)}</strong></div><button className="button button-dark" onClick={onHome}>Continue shopping <span>→</span></button></div>;
}

const solutionSystems = [
  { number: '01', icon: '◉', title: 'CCTV & Surveillance', category: 'CCTV & Surveillance', summary: 'Complete camera, recording, storage, viewing and PoE architectures for homes, retail, offices and industrial sites.', details: ['Camera and lens selection', 'NVR storage calculation', 'PoE power budgeting', 'Remote viewing plan'] },
  { number: '02', icon: '☀', title: 'Solar & Power', category: 'Solar Energy', summary: 'Balanced solar packages built around load, available roof area, backup duration and future expansion.', details: ['Load and panel sizing', 'Inverter compatibility', 'Battery planning', 'Protection and cabling'] },
  { number: '03', icon: '⌘', title: 'Business Networking', category: 'Networking', summary: 'Reliable wired and wireless infrastructure for IP cameras, workstations, access points and connected systems.', details: ['Topology planning', 'Switch and PoE selection', 'Rack and patching schedule', 'Structured cabling BOM'] },
  { number: '04', icon: '◆', title: 'Access Control', category: 'Access Control', summary: 'Door access, attendance and identity workflows for secure, auditable movement across your premises.', details: ['Reader and credential plan', 'Door hardware matching', 'Controller capacity', 'Attendance integration'] },
  { number: '05', icon: '△', title: 'Fire & Intrusion Safety', category: 'Fire Alarm', summary: 'Detection, warning and intrusion packages with correctly matched panels, zones, sensors and notification devices.', details: ['Zone and loop planning', 'Detector selection', 'Sounder coverage', 'Backup power sizing'] },
  { number: '06', icon: '⚒', title: 'Electrical & Workshop', category: 'Electrical', summary: 'Professional electrical protection, tools and accessories selected for safe installation and long service life.', details: ['Protection coordination', 'Tool package selection', 'Cable and termination list', 'Site consumables'] },
];

const professionalServices = [
  { icon: '◎', title: 'Technical consultation', category: 'Accessories', text: 'A focused review of your requirement, site constraints, budget and preferred technology.' },
  { icon: '⌖', title: 'Site survey planning', category: 'CCTV & Surveillance', text: 'Survey checklist, coverage priorities and information gathering before system design.' },
  { icon: '▦', title: 'System design & BOQ', category: 'Networking', text: 'Compatible equipment architecture and a practical bill of quantities for procurement.' },
  { icon: '◇', title: 'Product sourcing', category: 'Hardware', text: 'Verified alternatives, availability checks and quantity pricing across the ITZ catalog.' },
  { icon: '⚙', title: 'Installation coordination', category: 'Electrical', text: 'Installer-ready product schedules, connection notes and staged delivery coordination.' },
  { icon: '✓', title: 'Testing & handover guidance', category: 'Access Control', text: 'Commissioning checklists, acceptance points and operator handover documentation.' },
  { icon: '↻', title: 'Maintenance planning', category: 'Fire Alarm', text: 'Preventive maintenance schedules, spare recommendations and lifecycle support.' },
  { icon: '✦', title: 'Upgrade & expansion', category: 'Solar Energy', text: 'Capacity review and compatible expansion paths for an existing technical system.' },
];

function ExperienceHero({ eyebrow, title, accent, description, primaryLabel, onPrimary, secondaryLabel, onSecondary, stats }) {
  return <section className="experience-hero"><div className="experience-hero-copy"><p className="eyebrow">{eyebrow}</p><h1>{title}<br /><em>{accent}</em></h1><p>{description}</p><div className="experience-actions"><button className="button button-light" onClick={onPrimary}>{primaryLabel}<span>→</span></button><button className="experience-link" onClick={onSecondary}>{secondaryLabel}<span>↗</span></button></div></div><div className="experience-hero-panel"><span className="experience-code">ITZ / PROJECT OPERATIONS</span><div className="experience-orbit"><i>ITZ</i><b>Power</b><b>Security</b><b>Control</b></div><div className="experience-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div></section>;
}

function SolutionsPage({ onNavigate, onQuote }) {
  return <div className="experience-page"><ExperienceHero eyebrow="Engineered systems" title="One requirement." accent="A complete solution." description="INAM TECH ZONE connects products, compatibility and practical project planning—so every component works together from day one." primaryLabel="Start your project brief" onPrimary={() => onQuote(null)} secondaryLabel="Browse all products" onSecondary={() => onNavigate('shop')} stats={[["10+", 'technical categories'], ['A–Z', 'system planning'], ['1 day', 'quote response target']]} />
    <section className="experience-section"><div className="experience-heading"><div><p className="eyebrow">Solution portfolio</p><h2>Designed around the job,<br />not a product list.</h2></div><p>Choose a system to explore matching products or send its requirements directly to our project desk.</p></div><div className="solution-system-grid">{solutionSystems.map((system) => <article key={system.number}><div className="solution-card-top"><span>{system.number}</span><i>{system.icon}</i></div><h3>{system.title}</h3><p>{system.summary}</p><ul>{system.details.map((detail) => <li key={detail}>✓ {detail}</li>)}</ul><div><button onClick={() => onNavigate('shop', system.category)}>View products</button><button onClick={() => onQuote({ id: `solution-${system.number}`, name: `${system.title} solution`, category: system.category })}>Get solution quote →</button></div></article>)}</div></section>
    <section className="delivery-process"><div><p className="eyebrow">How we work</p><h2>A clear path from idea to delivery.</h2><p>Every project is organized around requirements, compatibility, availability and a practical handover.</p><button className="button button-dark" onClick={() => onQuote(null)}>Discuss your requirements <span>→</span></button></div><ol>{[['01','Discover','We capture the site, users, performance target, budget and timeline.'],['02','Design','We match products, capacity, power and accessories into one compatible system.'],['03','Validate','Availability, quantities, warranty and alternatives are checked before quotation.'],['04','Deliver','Products are packed, dispatched and supported with clear order tracking.']].map(([number,title,text]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol></section>
    <section className="experience-cta"><div><p className="eyebrow">Project desk</p><h2>Bring us the requirement.<br />We&apos;ll structure the solution.</h2></div><div><button className="button button-light" onClick={() => onQuote(null)}>Request professional quote <span>→</span></button><button onClick={() => onNavigate('services')}>Explore professional services</button></div></section>
  </div>;
}

function ServicesPage({ settings, onNavigate, onQuote }) {
  const phone = String(settings.supportPhone || '').replace(/\s/g, '');
  return <div className="experience-page"><ExperienceHero eyebrow="Professional services" title="Technical support" accent="from scope to handover." description="Practical services for selecting, planning, sourcing and maintaining power, security, networking and control systems." primaryLabel="Request a service" onPrimary={() => onQuote({ id: 'service-request', name: 'Professional service request', category: 'Accessories' })} secondaryLabel="Speak to the team" onSecondary={() => { window.location.href = `tel:${phone}`; }} stats={[["01", 'dedicated project desk'], ['8', 'service capabilities'], ['6', 'system disciplines']]} />
    <section className="experience-section services-section"><div className="experience-heading"><div><p className="eyebrow">Service capabilities</p><h2>Expert input where<br />your project needs it.</h2></div><p>Use a single service or combine the full workflow for a complete technical procurement package.</p></div><div className="service-capability-grid">{professionalServices.map((service, index) => <article key={service.title}><span>{String(index + 1).padStart(2, '0')}</span><i>{service.icon}</i><h3>{service.title}</h3><p>{service.text}</p><button onClick={() => onQuote({ id: `service-${index + 1}`, name: service.title, category: service.category })}>Request this service <b>→</b></button></article>)}</div></section>
    <section className="service-levels"><div><p className="eyebrow">Flexible engagement</p><h2>Choose the level of help you need.</h2></div><div>{[['SELECT','Product selection','Compatibility review, alternatives and availability for a focused purchase.'],['PLAN','System planning','Requirements, architecture and a project-ready bill of quantities.'],['DELIVER','Procurement support','Coordinated sourcing, staged delivery, tracking and handover guidance.']].map(([label,title,text], index) => <article className={index === 1 ? 'featured' : ''} key={label}><span>{label}</span><h3>{title}</h3><p>{text}</p><ul><li>✓ Clear scope</li><li>✓ Technical review</li><li>✓ Actionable recommendation</li></ul><button onClick={() => onQuote({ id: `level-${label}`, name: `${title} service`, category: 'Accessories' })}>Start {label.toLowerCase()} request →</button></article>)}</div></section>
    <section className="service-contact-band"><div><span>Need an urgent product or compatibility answer?</span><h2>Talk directly to the INAM TECH ZONE team.</h2></div><div><a href={`tel:${phone}`}>Call {settings.supportPhone}</a><a href={`mailto:${settings.supportEmail}`}>Email technical desk</a><button onClick={() => onNavigate('support')}>Open support center →</button></div></section>
  </div>;
}

function SupportPage({ settings, onNavigate, onQuote, onTrack }) {
  const [openFaq, setOpenFaq] = useState(0);
  const phone = String(settings.supportPhone || '').replace(/\s/g, '');
  const whatsapp = String(settings.whatsapp || settings.supportPhone || '').replace(/\D/g, '');
  const faqs = [
    ['How quickly will I receive a quotation?', 'Complete requests are targeted within one business day. Complex BOQs may require a short technical call before final pricing.'],
    ['Can you verify product compatibility?', 'Yes. Share existing models, quantities, site conditions and your required outcome. The project desk will review the complete system path.'],
    ['How do I track an order?', 'Select Track order, then enter the order ID and the same email address used during checkout. Courier and milestone updates will appear when assigned.'],
    ['Do products include warranty?', 'Warranty varies by product and is shown on each product detail page. Keep your order information for warranty assessment and support.'],
    ['Can I request quantity or trade pricing?', 'Yes. Use Request quote for project quantities, contractor procurement and complete systems.'],
    ['What should I include in a support request?', 'Include the product model, order ID when relevant, a clear description, site conditions and photos or error details where possible.'],
  ];
  return <div className="experience-page support-page"><section className="support-hero"><div><p className="eyebrow">ITZ support center</p><h1>Answers, tracking and<br /><em>technical assistance.</em></h1><p>Get the right next step for products, orders, quotations, compatibility, warranty and project support.</p><div className="experience-actions"><button className="button button-light" onClick={onTrack}>Track an order <span>→</span></button><button className="experience-link" onClick={() => onQuote(null)}>Open technical request <span>↗</span></button></div></div><aside><span>SUPPORT STATUS</span><strong>Project desk available</strong><p>{settings.businessHours}</p><div><i /> Typical first response within one business day</div></aside></section>
    <section className="support-actions"><button onClick={onTrack}><i>⌖</i><span><strong>Track an order</strong><small>Courier and delivery milestones</small></span><b>→</b></button><button onClick={() => onQuote(null)}><i>▤</i><span><strong>Request a quote</strong><small>Products, systems and services</small></span><b>→</b></button><button onClick={() => onNavigate('shop')}><i>⌕</i><span><strong>Find a product</strong><small>Search the complete catalog</small></span><b>→</b></button><a href={`mailto:${settings.supportEmail}`}><i>✉</i><span><strong>Email support</strong><small>{settings.supportEmail}</small></span><b>↗</b></a></section>
    <section className="support-main"><div className="support-channels"><p className="eyebrow">Contact channels</p><h2>Reach the right desk.</h2><article><i>☎</i><div><strong>Sales & technical desk</strong><span>{settings.supportPhone}</span><small>{settings.businessHours}</small></div><a href={`tel:${phone}`}>Call now</a></article><article><i>◉</i><div><strong>WhatsApp assistance</strong><span>{settings.whatsapp || settings.supportPhone}</span><small>Share model numbers and project details</small></div><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Open WhatsApp</a></article><article><i>✉</i><div><strong>Email support</strong><span>{settings.supportEmail}</span><small>Best for BOQs, documents and detailed requests</small></div><a href={`mailto:${settings.supportEmail}`}>Send email</a></article><article><i>⌖</i><div><strong>Business address</strong><span>{settings.address}</span><small>Contact the team before arranging a visit</small></div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noreferrer">Open map</a></article></div>
      <div className="support-faq"><p className="eyebrow">Frequently asked</p><h2>Quick answers.</h2>{faqs.map(([question, answer], index) => <article className={openFaq === index ? 'open' : ''} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><b>{openFaq === index ? '−' : '＋'}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section>
    <section className="support-policies"><div><span>01</span><h3>Delivery support</h3><p>Order confirmation, secure packing, dispatch details and courier tracking when assigned.</p><button onClick={onTrack}>Track delivery →</button></div><div><span>02</span><h3>Compatibility support</h3><p>Model matching, power requirements, accessories and system-level product checks.</p><button onClick={() => onQuote({ id: 'compatibility-check', name: 'Product compatibility check', category: 'Accessories' })}>Request a check →</button></div><div><span>03</span><h3>Warranty guidance</h3><p>Prepare the order ID, product model, issue description and supporting photos before contact.</p><a href={`mailto:${settings.supportEmail}?subject=Warranty support request`}>Start warranty email →</a></div></section>
    <section className="experience-cta"><div><p className="eyebrow">Still need help?</p><h2>Send the requirement.<br />We&apos;ll guide the next step.</h2></div><div><button className="button button-light" onClick={() => onQuote(null)}>Create support request <span>→</span></button><button onClick={() => onNavigate('services')}>View professional services</button></div></section>
  </div>;
}

function StoreFooter({ settings, onNavigate, onQuote, onTrack }) {
  return <footer className="store-footer"><div className="footer-news"><p className="eyebrow">Technical updates</p><h2>{settings.footerHeadline}</h2><p>{settings.footerText}</p><form onSubmit={(e) => e.preventDefault()}><input type="email" required placeholder="Work email address" aria-label="Email address" /><button aria-label="Subscribe">→</button></form></div><div className="footer-links"><div><h3>Products</h3><button onClick={() => onNavigate('shop', 'Hardware')}>Hardware & tools</button><button onClick={() => onNavigate('shop', 'CCTV & Surveillance')}>CCTV & security</button><button onClick={() => onNavigate('shop', 'Solar Energy')}>Solar & electrical</button><button onClick={() => onNavigate('shop', 'Networking')}>Networking</button></div><div><h3>Solutions & services</h3><button onClick={() => onNavigate('solutions')}>Complete solutions</button><button onClick={() => onNavigate('services')}>Professional services</button><button onClick={() => onQuote(null)}>Request a quote</button><button onClick={onTrack}>Track your order</button></div><div><h3>Support & company</h3><button onClick={() => onNavigate('support')}>Support center</button><a href={`mailto:${settings.supportEmail}`}>Technical support</a><a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`}>{settings.supportPhone}</a><span>{settings.businessHours}</span></div></div><div className="footer-bottom"><strong><BrandLockup settings={settings} /></strong><p>{settings.footerCopyright}</p><div><a href={settings.instagram}>Instagram</a><a href={settings.facebook}>Facebook</a><a href={settings.youtube}>YouTube</a></div></div></footer>;
}

function Toast({ notice, onClose }) {
  const type = notice?.type || 'success';
  const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
  const titles = { success: 'Saved successfully', error: 'Action failed', warning: 'Needs attention', info: 'Update' };
  return <div className={`toast notice-toast ${notice ? 'show' : ''} ${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live="polite"><span className="notice-icon">{icons[type]}</span><div><strong>{notice?.title || titles[type]}</strong><p>{notice?.message || ''}</p></div><button type="button" onClick={onClose} aria-label="Close notification">×</button></div>;
}

function AdminLogin({ settings, onLogin, onCancel }) {
  const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault(); setError(''); try { await onLogin(Object.fromEntries(new FormData(e.currentTarget))); } catch (err) { setError(err.message); } };
  return <div className="admin-login"><div className="login-visual"><button onClick={onCancel}>← Back to store</button><div><span>ITZ / COMMERCE CONTROL</span><h1>Command every<br />part of the store.</h1><p>Catalog, project quotes, orders, customers and every visible brand detail—in one professional workspace.</p></div></div><form onSubmit={submit}><div className="login-brand"><BrandLockup settings={settings} /></div><p className="eyebrow">Administration</p><h2>Welcome back.</h2><p>Sign in to manage your commerce workspace.</p><label>Email<input required name="email" type="email" defaultValue={settings.adminEmail} /></label><label>Password<input required name="password" type="password" defaultValue={!settings.apiEndpoint ? 'inamtech2026' : ''} /></label>{error && <div className="login-error">{error}</div>}<button className="button button-dark">Sign in securely <span>→</span></button>{!settings.apiEndpoint && <small>Local demo access: {settings.adminEmail} / inamtech2026</small>}</form></div>;
}

const adminNav = [
  ['Overview', '◫'], ['Products', '◇'], ['Cloud Files', '▣'], ['Orders', '▤'], ['Quotes', '◈'], ['Categories', '⌘'], ['Customers', '◎'], ['Promotions', '%'], ['Analytics', '↗'], ['Settings', '⚙'],
];

function AdminShell({ settings, section, setSection, onStore, onLogout, orderCount, syncState, onRefresh, children }) {
  const [open, setOpen] = useState(false);
  return <div className="admin-app">
    <aside className={`admin-sidebar ${open ? 'open' : ''}`}><div className="admin-logo"><span className="admin-logo-image"><img src="/itz-logo-transparent.png" alt="ITZ" /></span><span>{settings.brandName}<small>/ CONTROL</small></span></div><nav>{adminNav.map(([name, icon]) => <button key={name} className={section === name ? 'active' : ''} onClick={() => { setSection(name); setOpen(false); }}><i>{icon}</i>{name}{name === 'Orders' && orderCount > 0 && <b>{orderCount}</b>}</button>)}</nav><div className="admin-profile"><span>IT</span><div><strong>INAM Operations</strong><small>Administrator</small></div><button onClick={onLogout} aria-label="Sign out">↪</button></div></aside>
    <div className="admin-main"><header className="admin-header"><button className="admin-menu" onClick={() => setOpen(!open)}>☰</button><div><p>Workspace / {section}</p><h1>{section}</h1></div><div className="admin-header-actions"><div className={`sync-indicator ${syncState.status}`}><i /><span><strong>{syncState.status === 'syncing' ? 'Synchronizing' : syncState.status === 'error' ? 'Sync issue' : syncState.status === 'local' ? 'Device only' : 'Cloudflare synced'}</strong><small>{syncState.message}</small></span><button type="button" onClick={onRefresh} aria-label="Refresh shared data" title="Refresh shared data">↻</button></div><button onClick={onStore}>View store ↗</button></div></header>{children}</div>
  </div>;
}

function AdminOverview({ products, orders, settings, setSection, onOrderSelect, onOrderDelete }) {
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const openOrders = orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length;
  const deliveredOrders = orders.filter((order) => order.status === 'Delivered').length;
  const unitsOrdered = orders.reduce((sum, order) => sum + Number(order.items || 0), 0);
  const metrics = [
    ['Net revenue', formatMoney(revenue, settings), `${orders.length} orders`, 'current shared data'],
    ['Orders', String(orders.length), `${openOrders} open`, 'active fulfillment'],
    ['Units ordered', String(unitsOrdered), `${deliveredOrders} delivered`, 'live order quantity'],
    ['Avg. order', formatMoney(revenue / Math.max(1, orders.length), settings), 'Live value', 'current orders'],
  ];
  const chart = [36, 47, 39, 64, 58, 76, 68, 92, 79, 88, 71, 96, 82, 102];
  return <div className="admin-content"><section className="admin-welcome"><div><p>Sunday, 23 August</p><h2>Good evening, INAM team.</h2><span>Here&apos;s how the technical store is moving today.</span></div><button className="admin-primary" onClick={() => setSection('Products')}>＋ Add product</button></section><div className="metric-grid">{metrics.map((m, i) => <article key={m[0]}><div><span>{m[0]}</span><i>{['↗', '▤', '◎', '◇'][i]}</i></div><strong>{m[1]}</strong><p><b>{m[2]}</b> {m[3]}</p></article>)}</div>
    <div className="dashboard-grid"><section className="admin-card revenue-card"><div className="admin-card-head"><div><h3>Revenue</h3><p>Current synchronized order value</p></div><span className="live-data-label">LIVE DATA</span></div><div className="chart-value"><strong>{formatMoney(revenue, settings)}</strong><span>{orders.length} orders</span></div><div className="bar-chart">{chart.map((height, i) => <div key={i} className={i === 11 ? 'hot' : ''}><span style={{ height: orders.length ? `${Math.max(18, height * Math.min(1, orders.length / 8))}px` : '6px' }} />{i % 2 === 0 && <small>{i + 10}</small>}</div>)}</div></section><section className="admin-card top-products"><div className="admin-card-head"><div><h3>Inventory snapshot</h3><p>Live catalog availability</p></div><button onClick={() => setSection('Products')}>View all</button></div>{products.slice(0, 4).map((p, i) => <div className="top-product" key={p.id}><span>{i + 1}</span><StoreImage src={p.image} alt="" loading="lazy" /><div><strong>{p.name}</strong><small>{p.category} · {p.stock} in stock</small></div><b>{p.stock} units</b></div>)}</section></div>
    <section className="admin-card order-card"><div className="admin-card-head"><div><h3>Recent orders</h3><p>Latest activity across the store</p></div><button onClick={() => setSection('Orders')}>View all orders →</button></div><OrderTable orders={orders.slice(0, 5)} settings={settings} onSelect={onOrderSelect} onDelete={onOrderDelete} /></section>
  </div>;
}

function OrderTable({ orders, settings, onStatus, onSelect, onDelete }) {
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Tracking</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><button className="order-id-button" onClick={() => onSelect?.(order)}>{order.id}</button></td><td><div className="customer-cell"><span>{order.customer.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span><div><strong>{order.customer}</strong><small>{order.email}</small></div></div></td><td>{order.date}</td><td>{order.items}</td><td><strong>{formatMoney(order.total, settings)}</strong></td><td>{onStatus ? <select className={`status ${order.status.toLowerCase().replace(' ', '-')}`} value={order.status} onChange={(e) => onStatus(order.id, e.target.value)}><option>Processing</option><option>On hold</option><option>Packed</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select> : <span className={`status ${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span>}</td><td><span className="tracking-cell">{order.trackingNumber || 'Not assigned'}<small>{order.courier || '—'}</small></span></td><td><div className="table-action-group"><button className="table-view-button" onClick={() => onSelect?.(order)}>View details →</button>{onDelete && <button className="table-delete-button" onClick={() => onDelete(order.id)} aria-label={`Delete order ${order.id}`}>Delete</button>}</div></td></tr>)}</tbody></table></div>;
}

const orderStages = ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered'];

function OrderDetailPanel({ order, settings, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(order);
  const [saving, setSaving] = useState(false);
  if (!order) return null;
  const currentIndex = draft.status === 'Cancelled' || draft.status === 'On hold' ? 1 : Math.max(0, orderStages.indexOf(draft.status === 'Processing' ? 'Processing' : draft.status));
  const set = (key, value) => setDraft((item) => ({ ...item, [key]: value }));
  const save = async () => {
    const event = { stage: draft.status, date: new Date().toISOString(), note: draft.trackingNote || `Order moved to ${draft.status}` };
    setSaving(true);
    try { await onSave({ ...draft, timeline: [...(draft.timeline || []), event] }); } catch {} finally { setSaving(false); }
  };
  return <div className="overlay order-detail-overlay" onMouseDown={onClose}><aside className="order-detail-panel" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Order operations</p><h2>{draft.id}</h2><span>Placed {draft.date} · {draft.items} items · {formatMoney(draft.total, settings)}</span></div><button onClick={onClose}>×</button></header><div className="order-detail-scroll"><section className="tracking-journey"><div className="tracking-journey-head"><div><h3>Fulfillment journey</h3><p>Customer-facing delivery progress</p></div><span className={`status ${String(draft.status).toLowerCase().replace(' ', '-')}`}>{draft.status}</span></div><div className="tracking-stages">{orderStages.map((stage, index) => <div className={index <= currentIndex ? 'complete' : ''} key={stage}><i>{index < currentIndex ? '✓' : index + 1}</i><strong>{stage}</strong><small>{index <= currentIndex ? (draft.timeline?.find((item) => item.stage === stage)?.date?.slice(0, 10) || draft.date) : 'Pending'}</small></div>)}</div></section><div className="order-detail-grid"><section><h3>Customer & delivery</h3><div className="order-contact"><span>{draft.customer.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{draft.customer}</strong><a href={`mailto:${draft.email}`}>{draft.email}</a><a href={`tel:${draft.shippingAddress?.phone || ''}`}>{draft.shippingAddress?.phone || 'Phone not provided'}</a></div></div><address>{draft.shippingAddress ? [draft.shippingAddress.address, draft.shippingAddress.city, draft.shippingAddress.region, draft.shippingAddress.postal, draft.shippingAddress.country].filter(Boolean).join(', ') : 'Delivery address is available in the connected order payload.'}</address><h3>Payment summary</h3><div className="order-money"><p><span>Subtotal</span><b>{formatMoney(draft.subtotal || draft.total, settings)}</b></p><p><span>Shipping</span><b>{formatMoney(draft.shipping || 0, settings)}</b></p><p><span>Discount</span><b>−{formatMoney(draft.discount || 0, settings)}</b></p><p><span>Total · {draft.payment}</span><strong>{formatMoney(draft.total, settings)}</strong></p></div></section><section><h3>Tracking controls</h3><div className="form-grid"><label>Status<select value={draft.status} onChange={(event) => set('status', event.target.value)}><option>Processing</option><option>On hold</option><option>Packed</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></label><label>Courier<input value={draft.courier || ''} onChange={(event) => set('courier', event.target.value)} placeholder="TCS, Leopards, DHL…" /></label><label className="full">Tracking number<input value={draft.trackingNumber || ''} onChange={(event) => set('trackingNumber', event.target.value)} placeholder="Assign shipment tracking ID" /></label><label>Estimated delivery<input type="date" value={draft.estimatedDelivery || ''} onChange={(event) => set('estimatedDelivery', event.target.value)} /></label><label>Internal / customer note<input value={draft.trackingNote || ''} onChange={(event) => set('trackingNote', event.target.value)} placeholder="Shipment collected by courier" /></label></div><button className="admin-primary tracking-save" onClick={save} disabled={saving}>{saving ? 'Synchronizing…' : 'Save tracking update'}</button><h3>Activity timeline</h3><div className="order-timeline">{(draft.timeline || [{ stage: 'Confirmed', date: draft.date, note: 'Order received and payment recorded.' }]).slice().reverse().map((item, index) => <div key={`${item.stage}-${index}`}><i /><span><strong>{item.stage}</strong><p>{item.note || `Order ${item.stage.toLowerCase()}`}</p><small>{String(item.date).replace('T', ' ').slice(0, 16)}</small></span></div>)}</div></section></div><section className="order-items"><h3>Order items</h3>{draft.lines?.length ? draft.lines.map((line) => <div key={line.id}><StoreImage src={line.product?.image || ''} alt="" loading="lazy" /><span><strong>{line.product?.name || line.id}</strong><small>{line.product?.sku || ''} · Qty {line.qty}</small></span><b>{formatMoney((line.product?.price || 0) * line.qty, settings)}</b></div>) : <p className="order-items-empty">Item-level details will appear for live checkout orders and Cloudflare D1 records.</p>}</section></div><footer><button className="danger-button" onClick={() => onDelete(draft.id)} disabled={saving}>Delete order</button><button onClick={onClose}>Close</button><button className="admin-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save order details'}</button></footer></aside></div>;
}

function AdminProducts({ products, settings, onAdd, onEdit, onDelete, onDuplicate, onPreview, onImport }) {
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const csvInput = useRef(null);
  const visible = products.filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try { await onImport(file); } catch {} finally { setImporting(false); }
  };
  return <div className="admin-content"><div className="section-actions product-section-actions"><label className="admin-search">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU or category" /></label><div className="product-data-actions"><button className="admin-secondary" onClick={() => downloadCsvFile(serializeProductsCsv(products), PRODUCT_CSV_FILE_NAME)}>⇩ Export CSV</button><button className="admin-secondary" onClick={() => downloadCsvFile(serializeProductsCsv([]), PRODUCT_CSV_TEMPLATE_FILE_NAME)}>□ Download template</button><button className="admin-secondary" onClick={() => csvInput.current?.click()} disabled={importing}>{importing ? 'Importing & syncing…' : '⇧ Import CSV'}</button><input ref={csvInput} className="csv-file-input" type="file" accept=".csv,text/csv,application/vnd.ms-excel" onChange={importFile} /><button className="admin-primary" onClick={onAdd}>＋ Add new product</button></div></div><div className="csv-help-strip"><span>CSV + Excel ready</span><p>Use the matching template. Existing SKU updates; new SKU creates a product. Maximum 250 rows per import.</p></div><section className="admin-card"><div className="inventory-summary"><span><b>{products.length}</b> Total products</span><span><b>{products.filter((p) => p.status === 'active').length}</b> Active</span><span><b>{products.filter((p) => p.stock < 10).length}</b> Low stock</span><span><b>{products.reduce((s, p) => s + Number(p.stock), 0)}</b> Units in inventory</span></div><div className="table-wrap"><table className="product-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Inventory</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((p) => <tr key={p.id}><td><div className="admin-product"><StoreImage src={p.image} alt="" loading="lazy" /><div><strong>{p.name}</strong><small>{p.brand || 'INAM Select'} · {p.model || p.color}</small></div></div></td><td>{p.sku}</td><td>{p.category}</td><td><strong>{formatMoney(p.price, settings)}</strong></td><td><span className={p.stock < 10 ? 'stock-low' : ''}>{p.stock < 10 ? 'Low · ' : ''}{p.stock}</span></td><td><span className={`status ${p.status}`}>{p.status}</span></td><td><div className="row-actions product-row-actions"><button onClick={() => onPreview(p)}>Preview</button><button onClick={() => onEdit(p)}>Edit</button><button onClick={() => onDuplicate(p)}>Duplicate</button><button className="delete-row" onClick={() => onDelete(p.id)} aria-label={`Delete ${p.name}`}>Delete</button></div></td></tr>)}</tbody></table></div></section></div>;
}

function ProductEditor({ product, categories, onClose, onSave, onUpload, onImport, settings }) {
  const empty = { id: uid('PRD'), name: '', slug: '', category: categories[0]?.name || '', brand: '', model: '', warranty: '', leadTime: 'Ready to dispatch', price: 0, comparePrice: 0, stock: 0, sku: '', status: 'active', badge: 'New', rating: 5, reviews: 0, color: 'Professional', featured: false, image: '', gallery: [], description: '', details: [] };
  const initialImages = productImages(product);
  const [draft, setDraft] = useState(product ? { ...product, image: initialImages[0] || '', gallery: initialImages.slice(1) } : empty);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const updateImages = (images) => setDraft((current) => ({ ...current, image: images[0] || '', gallery: images.slice(1, 6) }));
  const submit = async (e) => {
    e.preventDefault();
    const images = productImages(draft);
    if (!images.length) { setImageError('At least one product image is required.'); return; }
    setImageError('');
    setSaving(true);
    try { await onSave({ ...draft, image: images[0], gallery: images.slice(1), price: Number(draft.price), comparePrice: Number(draft.comparePrice), stock: Number(draft.stock), slug: draft.slug || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), details: Array.isArray(draft.details) ? draft.details : String(draft.details).split('\n').filter(Boolean) }); }
    catch {} finally { setSaving(false); }
  };
  const uploadFiles = async (inputFiles) => {
    const current = productImages(draft);
    const files = Array.from(inputFiles || []).filter((file) => file?.type?.startsWith('image/')).slice(0, Math.max(0, 6 - current.length));
    if (!files.length) { setImageError(current.length >= 6 ? 'Maximum 6 product images are allowed.' : 'Drop or select a supported image file.'); return; }
    setUploading(true); setImageError('');
    const uploaded = [];
    try {
      for (const file of files) uploaded.push(await onUpload(file));
    } catch (error) { setImageError(error.message || 'Image upload failed.'); }
    if (uploaded.length) updateImages([...current, ...uploaded].slice(0, 6));
    setUploading(false);
  };
  const imageFiles = async (e) => { await uploadFiles(e.target.files); e.target.value = ''; };
  const dropImages = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (!uploading && productImages(draft).length < 6) await uploadFiles(event.dataTransfer.files);
  };
  const addImageUrl = async () => {
    const url = imageUrl.trim();
    const images = productImages(draft);
    if (!url || images.length >= 6) return;
    setUploading(true); setImageError('');
    try {
      const cloudflareUrl = await onImport(url);
      updateImages([...images, cloudflareUrl]);
      setImageUrl('');
    } catch (error) { setImageError(error.message || 'Cloudflare could not import this image URL.'); }
    finally { setUploading(false); }
  };
  const removeImage = (url) => updateImages(productImages(draft).filter((image) => image !== url));
  const makePrimary = (url) => updateImages([url, ...productImages(draft).filter((image) => image !== url)]);
  const images = productImages(draft);
  return (
    <div className="overlay editor-overlay" onMouseDown={onClose}>
      <form className="product-editor" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="editor-head">
          <div><p className="eyebrow">Technical catalog editor</p><h2>{product ? 'Edit product' : 'New product'}</h2></div>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="editor-scroll">
          <div className="editor-grid">
            <section>
              <h3>Product information</h3>
              <label>Product title<input required value={draft.name} onChange={(event) => set('name', event.target.value)} /></label>
              <label>Description<textarea rows="5" value={draft.description} onChange={(event) => set('description', event.target.value)} /></label>
              <div className="form-grid">
                <label>Category<select value={draft.category} onChange={(event) => set('category', event.target.value)}>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label>
                <label>Configuration / color<input value={draft.color} onChange={(event) => set('color', event.target.value)} /></label>
                <label>Brand<input value={draft.brand || ''} onChange={(event) => set('brand', event.target.value)} /></label>
                <label>Model<input value={draft.model || ''} onChange={(event) => set('model', event.target.value)} /></label>
                <label>Price ({settings.currency})<input required type="number" min="0" value={draft.price} onChange={(event) => set('price', event.target.value)} /></label>
                <label>Compare-at price<input type="number" min="0" value={draft.comparePrice} onChange={(event) => set('comparePrice', event.target.value)} /></label>
                <label>SKU<input required value={draft.sku} onChange={(event) => set('sku', event.target.value)} /></label>
                <label>Inventory<input required type="number" min="0" value={draft.stock} onChange={(event) => set('stock', event.target.value)} /></label>
                <label>Warranty<input value={draft.warranty || ''} onChange={(event) => set('warranty', event.target.value)} /></label>
                <label>Lead time<input value={draft.leadTime || ''} onChange={(event) => set('leadTime', event.target.value)} /></label>
              </div>
              <label>Technical specifications (one per line)<textarea rows="5" value={Array.isArray(draft.details) ? draft.details.join('\n') : draft.details} onChange={(event) => set('details', event.target.value)} /></label>
            </section>
            <section>
              <h3>Media & visibility</h3>
              <div className="media-counter"><b>Product images</b><span>{images.length} / 6</span></div>
              <label
                className={`image-upload multi-image-upload ${dragging ? 'dragging' : ''} ${images.length >= 6 ? 'disabled' : ''}`}
                onDragEnter={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                onDrop={dropImages}
                aria-disabled={uploading || images.length >= 6}
              >
                <div>
                  <span>{uploading ? '…' : '⇧'}</span>
                  <p>{uploading ? 'Saving securely in Cloudflare R2…' : images.length ? 'Drop or choose more images' : 'Drop images here or choose from device'}</p>
                  <small>JPG, PNG, WebP, GIF or AVIF · max 6 MB each · 1–6 images</small>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={uploading || images.length >= 6} onChange={imageFiles} />
              </label>
              <div className="drive-connection-badge ready">
                <i>✓</i>
                <span>Cloudflare R2 storage active · one shared media source for PC and mobile</span>
              </div>
              {images.length > 0 && <div className="multi-image-grid">{images.map((image, index) => <article className={index === 0 ? 'primary' : ''} key={`${image}-${index}`}><StoreImage src={image} alt={`Product ${index + 1}`} loading="lazy" /><span>{index === 0 ? 'Primary' : `Image ${index + 1}`}</span>{index > 0 && <button type="button" className="make-primary" onClick={() => makePrimary(image)}>Set primary</button>}<button type="button" className="remove-media" onClick={() => removeImage(image)} aria-label={`Remove image ${index + 1}`}>×</button></article>)}</div>}
              <div className="image-url-caption"><b>Or import by URL</b><span>The image is copied into Cloudflare R2 before use</span></div>
              <div className="image-url-row"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Paste a direct HTTPS image URL" disabled={uploading || images.length >= 6} /><button type="button" onClick={addImageUrl} disabled={uploading || !imageUrl.trim() || images.length >= 6}>{uploading ? 'Importing…' : 'Import to R2'}</button></div>
              {imageError && <p className="media-error" role="alert">{imageError}</p>}
              <label>Status<select value={draft.status} onChange={(event) => set('status', event.target.value)}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
              <label>Badge<input value={draft.badge} onChange={(event) => set('badge', event.target.value)} placeholder="New, Bestseller…" /></label>
              <label className="switch-label"><span><b>Featured product</b><small>Show this product in curated areas.</small></span><input type="checkbox" checked={draft.featured} onChange={(event) => set('featured', event.target.checked)} /></label>
            </section>
          </div>
        </div>
        <div className="editor-actions"><button type="button" onClick={onClose}>Cancel</button><button className="admin-primary" disabled={uploading || saving}>{saving ? 'Saving & syncing…' : 'Save product'}</button></div>
      </form>
    </div>
  );
}

function AdminProductPreview({ product, settings, onClose, onEdit }) {
  const images = productImages(product);
  const [previewImage, setPreviewImage] = useState(images[0] || '');
  if (!product) return null;
  return <div className="overlay admin-preview-overlay" onMouseDown={onClose}><section className="admin-product-preview" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="admin-preview-media"><div className="admin-preview-image"><StoreImage className="admin-preview-main-image" src={previewImage || images[0]} alt={product.name} loading="eager" fetchPriority="high" /><span>{product.badge || product.status}</span></div>{images.length > 1 && <div className="admin-preview-thumbs" aria-label="Preview product images">{images.map((image, index) => <button type="button" className={previewImage === image ? 'active' : ''} key={`${image}-${index}`} onClick={() => setPreviewImage(image)} aria-label={`Preview product image ${index + 1}`}><StoreImage src={image} alt="" loading="lazy" /></button>)}</div>}</div><div className="admin-preview-copy"><p className="eyebrow">Storefront preview · {product.category}</p><h2>{product.name}</h2><div className="admin-preview-meta"><span>SKU<strong>{product.sku}</strong></span><span>Brand / model<strong>{product.brand || '—'} · {product.model || '—'}</strong></span><span>Stock<strong>{product.stock} units</strong></span><span>Status<strong>{product.status}</strong></span></div><div className="detail-price">{formatMoney(product.price, settings)} {product.comparePrice > product.price && <del>{formatMoney(product.comparePrice, settings)}</del>}</div><div className="detail-delivery"><span>Delivery</span><strong>{deliverySummary(product.price, settings)}</strong></div><p>{product.description}</p><ul>{(product.details || []).map((detail) => <li key={detail}>{detail}</li>)}</ul><div className="admin-preview-actions"><button onClick={onClose}>Close preview</button><button className="admin-primary" onClick={() => { onClose(); onEdit(product); }}>Edit product</button></div></div></section></div>;
}

function AdminCloudFiles({ settings, token, toast, onSyncState }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const migrationStarted = useRef(false);
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiCall(settings.apiEndpoint, 'listFiles', {}, token);
      setFiles(result?.files || []);
    } catch (error) { toast(error.message || 'Cloudflare files could not be loaded.', 'error', 'File storage error'); }
    finally { setLoading(false); }
  }, [settings.apiEndpoint, token, toast]);
  useEffect(() => {
    if (migrationStarted.current) return;
    migrationStarted.current = true;
    (async () => {
      try {
        const result = await apiCall(settings.apiEndpoint, 'migrateExternalImages', {}, token);
        if (result?.migrated) toast(`${result.migrated} existing product image reference(s) moved into Cloudflare R2.`, 'success', 'Cloudflare migration complete');
        if (result?.failed) toast(`${result.failed} old image(s) need manual re-upload.`, 'warning', 'Image migration review');
      } catch {}
      await loadFiles();
    })();
  }, [loadFiles, settings.apiEndpoint, token, toast]);
  const uploadFiles = async (inputFiles) => {
    const selected = Array.from(inputFiles || []).slice(0, 10);
    if (!selected.length) return;
    setUploading(true);
    onSyncState({ status: 'syncing', message: 'Uploading private files to Cloudflare R2…' });
    try {
      for (const file of selected) {
        const dataUrl = await readCloudFile(file);
        await apiCall(settings.apiEndpoint, 'uploadFile', { fileName: file.name, mimeType: cloudFileMime(file), dataUrl }, token);
      }
      await loadFiles();
      onSyncState({ status: 'connected', message: `${selected.length} file(s) saved in Cloudflare R2` });
      toast(`${selected.length} private file(s) uploaded successfully.`, 'success', 'Cloudflare upload complete');
    } catch (error) {
      onSyncState({ status: 'error', message: error.message || 'Cloud file upload failed' });
      toast(error.message || 'Cloudflare R2 did not accept the file.', 'error', 'Upload failed');
    } finally { setUploading(false); }
  };
  const chooseFiles = async (event) => { await uploadFiles(event.target.files); event.target.value = ''; };
  const dropFiles = async (event) => { event.preventDefault(); setDragging(false); if (!uploading) await uploadFiles(event.dataTransfer.files); };
  const downloadFile = async (file) => {
    try {
      const response = await fetch(settings.apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'downloadFile', token, key: file.key }), cache: 'no-store' });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || 'Download failed.'); }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name || 'download';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) { toast(error.message || 'Cloud file download failed.', 'error', 'Download failed'); }
  };
  const deleteFile = async (file) => {
    if (!confirm(`Delete “${file.name}” from Cloudflare R2?`)) return;
    try {
      await apiCall(settings.apiEndpoint, 'deleteFile', { key: file.key }, token);
      setFiles((current) => current.filter((item) => item.key !== file.key));
      toast(`${file.name} deleted from Cloudflare R2.`, 'success', 'File deleted');
    } catch (error) { toast(error.message || 'Cloud file could not be deleted.', 'error', 'Delete failed'); }
  };
  return <div className="admin-content cloud-files-page"><div className="cloud-files-hero"><div><p className="eyebrow">Private business storage</p><h2>Cloud Files</h2><p>Documents, project sheets, product media and exports stay in your private Cloudflare R2 bucket.</p></div><span><b>{files.length}</b> stored files</span></div><label className={`cloud-file-drop ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropFiles}><i>{uploading ? '…' : '⇧'}</i><strong>{uploading ? 'Uploading securely…' : 'Drop files here or choose from device'}</strong><small>Images, PDF, TXT, CSV, JSON, Word, Excel, PowerPoint or ZIP · max 10 MB each</small><input type="file" multiple disabled={uploading} onChange={chooseFiles} accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf,text/plain,text/csv,application/json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" /></label><section className="admin-card cloud-file-list"><div className="admin-card-head"><div><h3>Secure file library</h3><p>Files are private and require an active administrator session to download.</p></div><button onClick={loadFiles} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>{!loading && !files.length ? <div className="cloud-file-empty"><span>▣</span><b>No private files yet</b><p>Upload your first document using the secure area above.</p></div> : <div className="cloud-file-grid">{files.map((file) => <article key={file.key}><i>{String(file.mimeType).startsWith('image/') ? 'IMG' : String(file.name).split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</i><div><strong>{file.name}</strong><span>{formatFileSize(file.size)} · {file.uploaded ? new Date(file.uploaded).toLocaleDateString() : 'Cloudflare R2'}</span></div><button onClick={() => downloadFile(file)}>Download</button><button className="delete-row" onClick={() => deleteFile(file)}>Delete</button></article>)}</div>}</section></div>;
}

function AdminSettings({ settings, setSettings, onSave, onUpload }) {
  const [tab, setTab] = useState('Brand');
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (dirty) return;
    // Server values may arrive after the settings page first renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(settings);
  }, [dirty, settings]);
  const set = (key, value) => { setDirty(true); setDraft((d) => ({ ...d, [key]: value })); };
  const tabs = ['Brand', 'Header & footer', 'Commerce', 'Integrations'];
  const save = async () => { setSaving(true); try { await onSave(draft); const clean = { ...draft, newAdminPassword: '', confirmAdminPassword: '' }; setDraft(clean); setSettings(clean); setDirty(false); } catch {} finally { setSaving(false); } };
  const uploadHero = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setHeroUploading(true); try { const heroImage = await onUpload(file); set('heroImage', heroImage); } catch {} finally { setHeroUploading(false); } };
  return <div className="admin-content"><div className="settings-layout"><aside className="settings-nav">{tabs.map((name) => <button className={tab === name ? 'active' : ''} key={name} onClick={() => setTab(name)}>{name}<span>→</span></button>)}</aside><section className="admin-card settings-card"><div className="settings-head"><div><p className="eyebrow">Store configuration</p><h2>{tab}</h2><p>Changes update the storefront immediately and save to Cloudflare D1.</p></div><button className="admin-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    {tab === 'Brand' && <div className="settings-section"><h3>Identity & storefront hero</h3><div className="form-grid"><label>Store name<input value={draft.brandName} onChange={(e) => set('brandName', e.target.value)} /></label><label>Logo monogram<input value={draft.brandMark} maxLength="4" onChange={(e) => set('brandMark', e.target.value.toUpperCase())} /></label><label className="full">Hero eyebrow<input value={draft.heroEyebrow} onChange={(e) => set('heroEyebrow', e.target.value)} /></label><label>Hero heading<input value={draft.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} /></label><label>Hero accent line<input value={draft.heroAccent} onChange={(e) => set('heroAccent', e.target.value)} /></label><label className="full">Hero description<textarea rows="3" value={draft.heroDescription} onChange={(e) => set('heroDescription', e.target.value)} /></label><label className="full">Hero image stored on Cloudflare<input value={draft.heroImage} readOnly /><span className="cloud-upload-button">{heroUploading ? 'Uploading to R2…' : 'Choose new hero image'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={uploadHero} disabled={heroUploading} /></span></label><label>Primary color<div className="color-input"><input type="color" value={draft.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} /><input value={draft.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} /></div></label><label>Accent color<div className="color-input"><input type="color" value={draft.accentColor} onChange={(e) => set('accentColor', e.target.value)} /><input value={draft.accentColor} onChange={(e) => set('accentColor', e.target.value)} /></div></label><label>Background color<div className="color-input"><input type="color" value={draft.backgroundColor} onChange={(e) => set('backgroundColor', e.target.value)} /><input value={draft.backgroundColor} onChange={(e) => set('backgroundColor', e.target.value)} /></div></label></div></div>}
    {tab === 'Header & footer' && <div className="settings-section"><h3>Announcement and navigation</h3><div className="form-grid"><label className="full">Announcement bar<input value={draft.announcement} onChange={(e) => set('announcement', e.target.value)} /></label><label className="full">Announcement side note<input value={draft.announcementNote} onChange={(e) => set('announcementNote', e.target.value)} /></label><label className="full">Header links (comma separated)<input value={draft.headerLinks.join(', ')} onChange={(e) => set('headerLinks', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label></div><h3>Footer, contact and social content</h3><div className="form-grid"><label className="full">Newsletter heading<input value={draft.footerHeadline} onChange={(e) => set('footerHeadline', e.target.value)} /></label><label className="full">Newsletter text<textarea rows="3" value={draft.footerText} onChange={(e) => set('footerText', e.target.value)} /></label><label>Support email<input type="email" value={draft.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} /></label><label>Support phone<input value={draft.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} /></label><label>WhatsApp number<input value={draft.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} /></label><label>Business hours<input value={draft.businessHours || ''} onChange={(e) => set('businessHours', e.target.value)} /></label><label className="full">Business address<input value={draft.address} onChange={(e) => set('address', e.target.value)} /></label><label>Instagram URL<input value={draft.instagram} onChange={(e) => set('instagram', e.target.value)} /></label><label>Facebook URL<input value={draft.facebook || ''} onChange={(e) => set('facebook', e.target.value)} /></label><label>YouTube URL<input value={draft.youtube} onChange={(e) => set('youtube', e.target.value)} /></label><label>Copyright text<input value={draft.footerCopyright} onChange={(e) => set('footerCopyright', e.target.value)} /></label></div></div>}
    {tab === 'Commerce' && <div className="settings-section"><h3>Pricing, tax and delivery</h3><div className="form-grid"><label>Currency<select value={draft.currency} onChange={(e) => set('currency', e.target.value)}><option>PKR</option><option>USD</option><option>AED</option><option>SAR</option><option>GBP</option><option>EUR</option></select></label><label>Tax rate (%)<input type="number" min="0" step=".1" value={draft.taxRate} onChange={(e) => set('taxRate', Math.max(0, Number(e.target.value)))} /></label><label>Delivery charge<input type="number" min="0" value={draft.flatShippingRate ?? 0} disabled={draft.deliveryChargesEnabled === false} onChange={(e) => set('flatShippingRate', Math.max(0, Number(e.target.value)))} /><small>Amount charged when an order is below the free-delivery threshold.</small></label><label>Free delivery threshold<input type="number" min="0" value={draft.freeShippingThreshold ?? 0} disabled={draft.deliveryChargesEnabled === false} onChange={(e) => set('freeShippingThreshold', Math.max(0, Number(e.target.value)))} /><small>Set 0 to disable the free-delivery threshold.</small></label></div><div className="toggle-list delivery-toggle"><label><span><b>Enable delivery charges</b><small>Show the configured charge to customers in product details, bag, checkout and order confirmation.</small></span><input type="checkbox" checked={draft.deliveryChargesEnabled !== false} onChange={(e) => set('deliveryChargesEnabled', e.target.checked)} /></label></div><h3>Storefront tools and payment options</h3><div className="toggle-list"><label><span><b>Project quote requests</b><small>Show B2B/project inquiry forms throughout the storefront.</small></span><input type="checkbox" checked={draft.quoteEnabled} onChange={(e) => set('quoteEnabled', e.target.checked)} /></label><label><span><b>Product comparison</b><small>Allow customers to compare up to three technical products.</small></span><input type="checkbox" checked={draft.compareEnabled} onChange={(e) => set('compareEnabled', e.target.checked)} /></label><label><span><b>Technical downloads</b><small>Generate downloadable product datasheets.</small></span><input type="checkbox" checked={draft.technicalDownloadsEnabled} onChange={(e) => set('technicalDownloadsEnabled', e.target.checked)} /></label><label><span><b>Project pricing labels</b><small>Highlight installer and quantity pricing workflows.</small></span><input type="checkbox" checked={draft.projectPricingEnabled} onChange={(e) => set('projectPricingEnabled', e.target.checked)} /></label><label><span><b>Credit / debit card</b><small>Requires your secure payment web endpoint.</small></span><input type="checkbox" checked={draft.cardEnabled} onChange={(e) => set('cardEnabled', e.target.checked)} /></label><label><span><b>Cash on delivery</b><small>Allow payment when the order arrives.</small></span><input type="checkbox" checked={draft.codEnabled} onChange={(e) => set('codEnabled', e.target.checked)} /></label><label><span><b>Bank transfer</b><small>Show transfer instructions after checkout.</small></span><input type="checkbox" checked={draft.bankEnabled} onChange={(e) => set('bankEnabled', e.target.checked)} /></label><label><span><b>Maintenance mode</b><small>Temporarily hide the public storefront.</small></span><input type="checkbox" checked={draft.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} /></label></div></div>}
    {tab === 'Integrations' && <div className="settings-section"><h3>Cloudflare-only infrastructure</h3><div className="integration-note"><span>CF</span><div><b>One Cloudflare system for the complete store</b><p>The storefront, admin API, products, orders, settings, images and private business files stay inside Cloudflare. No Google Drive, OneDrive, Apps Script or external database connection is used.</p></div></div><div className="drive-setup-panel"><div><span>1</span><p><b>Cloudflare Pages</b><small>Responsive storefront, admin panel and protected edge API.</small></p></div><div><span>2</span><p><b>Cloudflare D1</b><small>Authoritative products, inventory, orders, customers, settings and tracking data.</small></p></div><div><span>3</span><p><b>Cloudflare R2</b><small>Product images, hero media and private admin files with automatic cleanup.</small></p></div></div><div className="form-grid"><label className="full">Shared synchronization gateway<input value="Connected → Cloudflare Pages + D1 + R2" readOnly /><small className="managed-setting">Storage bindings are managed during Cloudflare deployment; nothing is connected from this Settings page.</small></label><label>Administrator email<input type="email" value={draft.adminEmail} onChange={(event) => set('adminEmail', event.target.value)} /></label><label>New administrator password<input type="password" minLength="12" value={draft.newAdminPassword || ''} onChange={(event) => set('newAdminPassword', event.target.value)} placeholder="Leave blank to keep current password" /></label><label>Confirm new password<input type="password" minLength="12" value={draft.confirmAdminPassword || ''} onChange={(event) => set('confirmAdminPassword', event.target.value)} placeholder="Repeat the new password" /></label></div><div className="platform-grid"><div><b>Cloudflare Pages</b><span>Application active</span><small>Fast storefront + protected edge API</small></div><div><b>Cloudflare D1</b><span>Authoritative database</span><small>Latest business data on every device</small></div><div><b>Cloudflare R2</b><span>File & image storage</span><small>Cloud media without third-party drives</small></div></div></div>}
  </section></div></div>;
}

function AdminSimple({ section, categories, setCategories, customers, setCustomers, coupons, setCoupons, orders, setOrders, quotes, setQuotes, settings, sync, onOrderSelect, onOrderDelete }) {
  const commit = async (action, payload, apply, successMessage) => { try { await sync(action, payload, successMessage); apply?.(); } catch {} };
  if (section === 'Orders') return <div className="admin-content"><section className="admin-card"><div className="admin-card-head"><div><h3>All orders</h3><p>Preview every order, update fulfillment and manage shipment tracking.</p></div><span className="quote-count">{orders.filter((item) => !['Delivered', 'Cancelled'].includes(item.status)).length} open</span></div><OrderTable orders={orders} settings={settings} onSelect={onOrderSelect} onDelete={onOrderDelete} onStatus={(id, status) => commit('updateOrder', { orderId: id, status }, () => setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order)), `Order ${id} status saved`)} /></section></div>;
  if (section === 'Quotes') return <div className="admin-content"><section className="admin-card"><div className="admin-card-head"><div><h3>Project quote requests</h3><p>Track commercial inquiries from first contact to proposal.</p></div><span className="quote-count">{quotes.filter((item) => item.status === 'New').length} new</span></div><div className="table-wrap"><table><thead><tr><th>Request</th><th>Customer</th><th>Project</th><th>Product / system</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id}><td><strong>{quote.id}</strong><small className="table-subline">{quote.date}</small></td><td><div className="customer-cell"><span>{quote.customer.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{quote.customer}</strong><small>{quote.company || quote.email} · {quote.phone}</small></div></div></td><td>{quote.projectType}</td><td>{quote.product || quote.productLabel || 'Complete system'}</td><td>{quote.quantity || 1}</td><td><select className={`status ${String(quote.status).toLowerCase()}`} value={quote.status} onChange={(event) => { const status = event.target.value; commit('updateQuote', { quoteId: quote.id, status }, () => setQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status } : item)), `Quote ${quote.id} saved successfully`); }}><option>New</option><option>Contacted</option><option>Quoted</option><option>Won</option><option>Closed</option></select></td><td><button className="table-delete-button" onClick={() => { if (!confirm(`Delete quote ${quote.id}?`)) return; commit('deleteQuote', { quoteId: quote.id }, () => setQuotes((current) => current.filter((item) => item.id !== quote.id)), `Quote ${quote.id} deleted`); }}>Delete</button></td></tr>)}</tbody></table></div></section></div>;
  if (section === 'Categories') return <div className="admin-content"><section className="admin-card list-card"><div className="admin-card-head"><div><h3>Product categories</h3><p>Control the storefront&apos;s shop navigation.</p></div><button className="admin-primary" onClick={() => { const category = { id: uid('CAT'), name: 'New category', slug: `new-category-${categories.length + 1}`, active: true }; commit('saveCategory', { category }, () => setCategories((current) => [...current, category]), 'Category created and synchronized'); }}>＋ Add category</button></div>{categories.map((category, index) => <div className="editable-row" key={category.id}><span>{String(index + 1).padStart(2, '0')}</span><input value={category.name} onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, name: event.target.value, slug: event.target.value.toLowerCase().replace(/\W+/g, '-') } : item))} /><small>/{category.slug}</small><label className="mini-switch"><input type="checkbox" checked={category.active} onChange={(event) => { const updated = { ...category, active: event.target.checked }; commit('saveCategory', { category: updated }, () => setCategories((current) => current.map((item) => item.id === category.id ? updated : item)), `${category.name} visibility saved`); }} /></label><div className="record-actions"><button className="record-save-button" onClick={() => commit('saveCategory', { category }, null, `${category.name} saved successfully`)}>Save</button><button className="record-delete-button" title="Delete category" aria-label={`Delete ${category.name}`} onClick={() => { if (!confirm(`Delete category “${category.name}”?`)) return; commit('deleteCategory', { categoryId: category.id }, () => setCategories((current) => current.filter((item) => item.id !== category.id)), `${category.name} deleted`); }}>Delete</button></div></div>)}</section></div>;
  if (section === 'Customers') return <div className="admin-content"><section className="admin-card"><div className="admin-card-head"><div><h3>Customers</h3><p>{customers.length} active customer profiles</p></div><span className="live-data-label">D1 DATA</span></div><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Joined</th><th>Orders</th><th>Total spent</th><th>Segment</th><th>Action</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span>{customer.name.split(' ').map((x) => x[0]).join('')}</span><div><strong>{customer.name}</strong><small>{customer.email}</small></div></div></td><td>{customer.joined}</td><td>{customer.orders}</td><td><strong>{formatMoney(customer.spent, settings)}</strong></td><td><span className="status active">{customer.spent > 1000 ? 'VIP' : 'Returning'}</span></td><td><button className="table-delete-button" onClick={() => { if (!confirm(`Delete customer ${customer.name}?`)) return; commit('deleteCustomer', { customerId: customer.id }, () => setCustomers((current) => current.filter((item) => item.id !== customer.id)), `${customer.name} deleted`); }}>Delete</button></td></tr>)}</tbody></table></div></section></div>;
  if (section === 'Promotions') return <div className="admin-content"><section className="admin-card list-card"><div className="admin-card-head"><div><h3>Discount codes</h3><p>Codes are validated instantly at checkout.</p></div><button className="admin-primary" onClick={() => { const coupon = { code: `ITZ${Date.now().toString(36).slice(-5).toUpperCase()}`, type: 'percent', value: 10, active: true, uses: 0 }; commit('saveCoupon', { coupon }, () => setCoupons((current) => [...current, coupon]), 'Promotion created and synchronized'); }}>＋ Create discount</button></div>{coupons.map((coupon) => <div className="coupon-row" key={coupon.code}><strong>{coupon.code}</strong><select value={coupon.type} onChange={(event) => setCoupons((current) => current.map((item) => item.code === coupon.code ? { ...item, type: event.target.value } : item))}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option><option value="shipping">Free shipping</option></select><input type="number" value={coupon.value} onChange={(event) => setCoupons((current) => current.map((item) => item.code === coupon.code ? { ...item, value: Number(event.target.value) } : item))} /><span>{coupon.uses} uses</span><label className="mini-switch"><input type="checkbox" checked={coupon.active} onChange={(event) => { const updated = { ...coupon, active: event.target.checked }; commit('saveCoupon', { coupon: updated }, () => setCoupons((current) => current.map((item) => item.code === coupon.code ? updated : item)), `${coupon.code} availability saved`); }} /></label><div className="record-actions"><button className="record-save-button" onClick={() => commit('saveCoupon', { coupon }, null, `${coupon.code} saved successfully`)}>Save</button><button className="record-delete-button" title="Delete promotion" aria-label={`Delete ${coupon.code}`} onClick={() => { if (!confirm(`Delete promotion ${coupon.code}?`)) return; commit('deleteCoupon', { code: coupon.code }, () => setCoupons((current) => current.filter((item) => item.code !== coupon.code)), `${coupon.code} deleted`); }}>Delete</button></div></div>)}</section></div>;
  const bars = [58, 74, 68, 82, 63, 92, 88, 105, 94, 118, 102, 128];
  return <div className="admin-content"><div className="metric-grid"><article><div><span>Store sessions</span><i>◎</i></div><strong>38,492</strong><p><b>+21.8%</b> vs prior period</p></article><article><div><span>Product views</span><i>◇</i></div><strong>92,106</strong><p><b>+16.4%</b> vs prior period</p></article><article><div><span>Add-to-cart rate</span><i>＋</i></div><strong>8.42%</strong><p><b>+1.12%</b> vs prior period</p></article><article><div><span>Checkout completion</span><i>✓</i></div><strong>61.7%</strong><p><b>+4.6%</b> vs prior period</p></article></div><section className="admin-card analytics-card"><div className="admin-card-head"><div><h3>Store sessions</h3><p>Traffic trend for the last 12 weeks</p></div><select><option>Last 12 weeks</option></select></div><div className="analytics-bars">{bars.map((b, i) => <div key={i}><span style={{ height: `${b}px` }} /><small>W{i + 1}</small></div>)}</div></section></div>;
}

function AdminApp({ products, setProducts, orders, setOrders, quotes, setQuotes, categories, setCategories, customers, setCustomers, coupons, setCoupons, settings, setSettings, token, setToken, onStore, toast, syncState, onSyncState, onRefresh }) {
  const [section, setSection] = useState('Overview');
  const [editor, setEditor] = useState(null);
  const [productPreview, setProductPreview] = useState(null);
  const [orderPreview, setOrderPreview] = useState(null);
  const sync = async (action, payload, successMessage = 'Changes saved') => {
    if (!settings.apiEndpoint) { onSyncState({ status: 'local', message: 'Cloudflare backend not connected' }); toast(`${successMessage}. Connect Cloudflare D1 to synchronize every device.`, 'warning', 'Saved on this device'); return { local: true }; }
    onSyncState({ status: 'syncing', message: 'Saving to Cloudflare D1…' });
    try {
      const result = await apiCall(settings.apiEndpoint, action, payload, token);
      await onRefresh?.({ silent: true, force: true });
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      onSyncState({ status: 'connected', message: `Saved and synced ${time}` });
      toast(`${successMessage} · available on all connected devices`, 'success');
      return result;
    } catch (error) {
      onSyncState({ status: 'error', message: error.message || 'Could not save to Cloudflare D1' });
      toast(error.message || 'The server did not accept this change.', 'error', 'Synchronization failed');
      throw error;
    }
  };
  const saveProduct = async (draft) => { const exists = products.some((product) => product.id === draft.id); const result = await sync('saveProduct', { product: draft }, exists ? 'Product updated successfully' : 'Product created successfully'); const saved = result?.product || draft; setProducts((current) => exists ? current.map((product) => product.id === saved.id ? saved : product) : [saved, ...current.filter((product) => product.id !== saved.id)]); setEditor(null); setProductPreview((current) => current?.id === saved.id ? saved : current); };
  const importProductsCsv = async (file) => {
    if (!file || !String(file.name || '').toLowerCase().endsWith('.csv')) {
      const error = new Error('Please choose a CSV file saved from Excel.');
      toast(error.message, 'error', 'CSV import stopped');
      throw error;
    }
    if (!file.size || file.size > MAX_CSV_BYTES) {
      const error = new Error('CSV file must be 2 MB or smaller. Split a large catalog into multiple files.');
      toast(error.message, 'error', 'CSV import stopped');
      throw error;
    }
    let imported;
    try {
      imported = parseProductCsv(await file.text(), products, () => uid('PRD'));
    } catch (error) {
      toast(error.message || 'CSV format could not be read.', 'error', 'CSV validation failed');
      throw error;
    }
    const result = await sync('importProducts', { products: imported }, `${imported.length} product${imported.length === 1 ? '' : 's'} imported successfully`);
    if (Array.isArray(result?.products)) setProducts(result.products);
    else {
      const importedIds = new Set(imported.map((product) => product.id));
      setProducts((current) => [...imported, ...current.filter((product) => !importedIds.has(product.id))]);
    }
    if (Array.isArray(result?.categories)) setCategories(result.categories);
    return result;
  };
  const deleteProduct = async (id) => {
    if (!confirm('Delete this product from every connected device?')) return;
    try {
      const result = await sync('deleteProduct', { productId: id }, 'Product deleted successfully');
      setProducts((current) => current.filter((product) => product.id !== id));
      setProductPreview(null);
      if (result?.mediaCleanup?.failed) toast(`${result.mediaCleanup.failed} Cloudflare R2 image file(s) could not be removed. The product itself was deleted on all devices.`, 'warning', 'Media cleanup incomplete');
    } catch {}
  };
  const deleteOrder = async (id) => { if (!confirm(`Delete order ${id}? This cannot be undone.`)) return; const deletedOrder = orders.find((item) => item.id === id); try { await sync('deleteOrder', { orderId: id }, `Order ${id} deleted successfully`); setOrders((current) => current.filter((item) => item.id !== id)); if (deletedOrder?.email) setCustomers((current) => current.map((customer) => customer.email?.toLowerCase() === deletedOrder.email.toLowerCase() ? { ...customer, orders: Math.max(0, Number(customer.orders || 0) - 1), spent: Math.max(0, Number(customer.spent || 0) - Number(deletedOrder.total || 0)) } : customer)); setOrderPreview(null); } catch {} };
  const duplicateProduct = async (product) => { const copy = { ...product, id: uid('PRD'), slug: `${product.slug}-copy`, sku: `${product.sku}-COPY`, name: `${product.name} Copy`, status: 'draft', featured: false }; try { const result = await sync('saveProduct', { product: copy }, 'Product duplicated as draft'); const saved = result?.product || copy; setProducts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); } catch {} };
  const saveOrderDetails = async (draft) => { const result = await sync('updateOrderDetails', { order: draft }, `Order ${draft.id} tracking saved successfully`); const saved = result?.order || draft; setOrders((current) => current.map((item) => item.id === saved.id ? saved : item)); setOrderPreview(saved); };
  const saveSettings = async (next) => {
    if (next.apiEndpoint !== settings.apiEndpoint) { setSettings(next); setToken(''); toast('Cloudflare connection updated. Sign in again.', 'warning', 'Connection updated'); return; }
    const passwordChanged = Boolean(next.newAdminPassword);
    await sync('saveSettings', { settings: next }, passwordChanged ? 'Store settings and administrator password saved successfully' : 'Store settings saved successfully');
    const clean = { ...next, newAdminPassword: '', confirmAdminPassword: '' };
    delete clean.googleDriveClientId;
    setSettings(clean);
    if (passwordChanged) setToken('');
  };
  const upload = async (file) => {
    const dataUrl = await readImageFile(file);
    onSyncState({ status: 'syncing', message: `Uploading ${file.name} to Cloudflare R2…` });
    try {
      const result = await apiCall(settings.apiEndpoint, 'uploadImage', { fileName: file.name, mimeType: file.type, dataUrl }, token);
      onSyncState({ status: 'connected', message: 'Image saved in Cloudflare R2' });
      toast(`${file.name} uploaded and synchronized.`, 'success', 'Cloudflare upload complete');
      return result.url;
    } catch (error) {
      onSyncState({ status: 'error', message: error.message || 'Cloudflare R2 upload failed' });
      toast(error.message || 'Cloudflare R2 did not accept the image.', 'error', 'Image upload failed');
      throw error;
    }
  };
  const importImage = async (sourceUrl) => {
    onSyncState({ status: 'syncing', message: 'Importing image into Cloudflare R2…' });
    try {
      const result = await apiCall(settings.apiEndpoint, 'importImage', { sourceUrl }, token);
      onSyncState({ status: 'connected', message: 'Image copied into Cloudflare R2' });
      toast('External image copied into Cloudflare R2 successfully.', 'success', 'Cloudflare import complete');
      return result.url;
    } catch (error) {
      onSyncState({ status: 'error', message: error.message || 'Cloudflare image import failed' });
      toast(error.message || 'Cloudflare could not import this image URL.', 'error', 'Image import failed');
      throw error;
    }
  };
  let content = <AdminOverview products={products} orders={orders} settings={settings} setSection={setSection} onOrderSelect={setOrderPreview} onOrderDelete={deleteOrder} />;
  if (section === 'Products') content = <AdminProducts products={products} settings={settings} onAdd={() => setEditor('new')} onEdit={setEditor} onDelete={deleteProduct} onDuplicate={duplicateProduct} onPreview={setProductPreview} onImport={importProductsCsv} />;
  if (section === 'Cloud Files') content = <AdminCloudFiles settings={settings} token={token} toast={toast} onSyncState={onSyncState} />;
  if (['Orders', 'Quotes', 'Categories', 'Customers', 'Promotions', 'Analytics'].includes(section)) content = <AdminSimple section={section} categories={categories} setCategories={setCategories} customers={customers} setCustomers={setCustomers} coupons={coupons} setCoupons={setCoupons} orders={orders} setOrders={setOrders} quotes={quotes} setQuotes={setQuotes} settings={settings} sync={sync} onOrderSelect={setOrderPreview} onOrderDelete={deleteOrder} />;
  if (section === 'Settings') content = <AdminSettings settings={settings} setSettings={setSettings} onSave={saveSettings} onUpload={upload} />;
  return <AdminShell settings={settings} section={section} setSection={setSection} onStore={onStore} onLogout={() => setToken('')} orderCount={orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length} syncState={syncState} onRefresh={onRefresh}>{content}{editor && <ProductEditor product={editor === 'new' ? null : editor} categories={categories} settings={settings} onClose={() => setEditor(null)} onSave={saveProduct} onUpload={upload} onImport={importImage} />}{productPreview && <AdminProductPreview key={productPreview.id} product={productPreview} settings={settings} onClose={() => setProductPreview(null)} onEdit={setEditor} />}{orderPreview && <OrderDetailPanel key={`${orderPreview.id}-${orderPreview.updatedAt || ''}`} order={orderPreview} settings={settings} onClose={() => setOrderPreview(null)} onSave={saveOrderDetails} onDelete={deleteOrder} />}</AdminShell>;
}

export default function StoreApp({ initialMode = 'store', initialView = 'home' }) {
  const [products, setProducts, productsReady] = useStoredState('products', productSeed);
  const [orders, setOrders, ordersReady] = useStoredState('orders', orderSeed);
  const [categories, setCategories, categoriesReady] = useStoredState('categories', categoriesSeed);
  const [customers, setCustomers, customersReady] = useStoredState('customers', customerSeed);
  const [coupons, setCoupons, couponsReady] = useStoredState('coupons', couponSeed);
  const [quotes, setQuotes, quotesReady] = useStoredState('quotes', quoteSeed);
  const [storedSettings, setSettings, settingsReady] = useStoredState('settings', defaultSettings);
  const settings = useMemo(() => ({ ...storedSettings, apiEndpoint: serverSyncProxy }), [storedSettings]);
  const localDataReady = productsReady && ordersReady && categoriesReady && customersReady && couponsReady && quotesReady && settingsReady;
  const [cart, setCart] = useStoredState('cart', []);
  const [wishlist, setWishlist] = useStoredState('wishlist', []);
  const [compare, setCompare] = useStoredState('compare', []);
  const [colorMode, setColorMode] = useStoredState('color-mode', 'light');
  const [mode] = useState(initialMode);
  const [view, setView] = useState(initialView);
  const [shopCategory, setShopCategory] = useState('');
  const [product, setProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [quoteRequest, setQuoteRequest] = useState({ open: false, product: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [token, setToken, tokenReady] = useSessionState('admin-token', '');
  const persistentReady = localDataReady && tokenReady;
  const [notice, setNotice] = useState(null);
  const [syncState, setSyncState] = useState({ status: settings.apiEndpoint ? 'syncing' : 'local', message: settings.apiEndpoint ? 'Connecting…' : 'Cloudflare backend not connected' });
  const [serverHydrated, setServerHydrated] = useState(developmentPreview);
  const [serverBootError, setServerBootError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const sharedDataRef = useRef({ products, categories, coupons });
  const storeRequestRef = useRef(0);
  const adminRequestRef = useRef(0);
  const publicRevisionRef = useRef('');
  const adminRevisionRef = useRef('');
  useEffect(() => { sharedDataRef.current = { products, categories, coupons }; }, [products, categories, coupons]);
  useEffect(() => {
    if (!persistentReady) return;
    // A selected product is an ID-backed view of the synchronized catalog, not a stale snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProduct((current) => current ? (products.find((item) => item.id === current.id) || null) : null);
  }, [persistentReady, products]);
  const toast = useCallback((message, type = 'success', title = '') => setNotice({ id: Date.now(), message, type, title }), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.type === 'error' ? 7000 : 4800); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
    document.documentElement.style.colorScheme = colorMode;
  }, [colorMode]);
  const applyStoreData = useCallback((data) => {
    const catalogReady = data.syncMeta?.catalogInitialized === true;
    if (Array.isArray(data.products) && (catalogReady || data.products.length)) setProducts(data.products);
    if (Array.isArray(data.categories) && (catalogReady || data.categories.length)) setCategories(data.categories);
    if (Array.isArray(data.coupons) && (catalogReady || data.coupons.length)) setCoupons(data.coupons);
    if (data.settings && typeof data.settings === 'object') setSettings((current) => ({ ...current, ...data.settings, apiEndpoint: current.apiEndpoint }));
  }, [setCategories, setCoupons, setProducts, setSettings]);
  const refreshStore = useCallback(async ({ notify = false, silent = false } = {}) => {
    if (!persistentReady) return null;
    if (!settings.apiEndpoint) { const message = 'Cloudflare backend not connected'; setSyncState({ status: 'error', message }); setServerBootError(message); return null; }
    const requestId = ++storeRequestRef.current;
    if (!silent) setSyncState({ status: 'syncing', message: 'Reading shared store data…' });
    try {
      const data = await fetchBootstrap(settings.apiEndpoint);
      if (requestId !== storeRequestRef.current) return null;
      const revision = String(data.syncMeta?.revision || data.syncMeta?.serverTime || '');
      if (!revision || publicRevisionRef.current !== revision) {
        applyStoreData(data);
        publicRevisionRef.current = revision;
      }
      setServerHydrated(true);
      setServerBootError('');
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncState({ status: 'connected', message: `Last sync ${time}` });
      if (notify) toast('Latest products, categories and promotions loaded.', 'success', 'Store synchronized');
      return data;
    } catch (error) {
      if (requestId !== storeRequestRef.current) return null;
      setSyncState({ status: 'error', message: error.message || 'Could not reach Cloudflare D1' });
      setServerBootError(error.message || 'Could not reach Cloudflare D1');
      if (notify) toast(error.message || 'Could not reach Cloudflare D1.', 'error', 'Synchronization failed');
      return null;
    }
  }, [applyStoreData, persistentReady, settings.apiEndpoint, toast]);
  const refreshAdmin = useCallback(async ({ notify = false, silent = false, force = false } = {}) => {
    if (!persistentReady) return null;
    if (silent && !force && typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active?.closest?.('.product-editor,.settings-card,.order-detail-panel,.editable-row,.coupon-row')) return null;
    }
    if (mode !== 'admin' || !token || !settings.apiEndpoint) return refreshStore({ notify, silent });
    const requestId = ++adminRequestRef.current;
    if (!silent) setSyncState({ status: 'syncing', message: 'Synchronizing administration data…' });
    try {
      let data = await apiCall(settings.apiEndpoint, 'getAdminData', {}, token);
      if (data.syncMeta?.catalogInitialized === false && sharedDataRef.current.products.length) {
        await apiCall(settings.apiEndpoint, 'initializeCatalog', sharedDataRef.current, token);
        data = await apiCall(settings.apiEndpoint, 'getAdminData', {}, token);
        toast('Existing catalog was published to Cloudflare D1 for all devices.', 'success', 'First synchronization complete');
      }
      if (requestId !== adminRequestRef.current) return null;
      const revision = String(data.syncMeta?.revision || data.syncMeta?.serverTime || '');
      if (!revision || adminRevisionRef.current !== revision) {
        if (Array.isArray(data.products)) setProducts(data.products);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.customers)) setCustomers(data.customers);
        if (Array.isArray(data.quotes)) setQuotes(data.quotes);
        if (Array.isArray(data.coupons)) setCoupons(data.coupons);
        if (data.settings && typeof data.settings === 'object') setSettings((current) => ({ ...current, ...data.settings, apiEndpoint: current.apiEndpoint }));
        adminRevisionRef.current = revision;
      }
      setServerHydrated(true);
      setServerBootError('');
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncState({ status: 'connected', message: `Last sync ${time}` });
      if (notify) toast('Products, orders, quotes and settings are up to date.', 'success', 'All data synchronized');
      return data;
    } catch (error) {
      if (requestId !== adminRequestRef.current) return null;
      if (error.status === 401) {
        setToken('');
        return refreshStore({ notify: true, silent: false });
      }
      setSyncState({ status: 'error', message: error.message || 'Could not reach Cloudflare D1' });
      setServerBootError(error.message || 'Could not reach Cloudflare D1');
      if (!silent || notify) toast(error.message || 'Could not load administration data.', 'error', 'Admin synchronization failed');
      return null;
    }
  }, [mode, persistentReady, refreshStore, setCategories, setCoupons, setCustomers, setOrders, setProducts, setQuotes, setSettings, setToken, settings.apiEndpoint, toast, token]);
  useEffect(() => {
    if (developmentPreview || mode === 'admin' || !persistentReady) return undefined;
    // The first shared-data read intentionally updates the local offline mirror.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStore();
    if (!settings.apiEndpoint) return undefined;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshStore({ silent: true }); }, SHARED_DATA_REFRESH_MS);
    const refreshVisible = () => { if (document.visibilityState === 'visible') refreshStore({ silent: true }); };
    window.addEventListener('focus', refreshVisible); window.addEventListener('online', refreshVisible); document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(interval); window.removeEventListener('focus', refreshVisible); window.removeEventListener('online', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [mode, persistentReady, refreshStore, settings.apiEndpoint]);
  useEffect(() => {
    if (developmentPreview || mode !== 'admin' || !token || !settings.apiEndpoint || !persistentReady) return undefined;
    // Authenticated administration data is loaded immediately after sign-in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAdmin();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refreshAdmin({ silent: true }); }, SHARED_DATA_REFRESH_MS);
    const refreshVisible = () => { if (document.visibilityState === 'visible') refreshAdmin({ silent: true }); };
    window.addEventListener('focus', refreshVisible); window.addEventListener('online', refreshVisible); document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(interval); window.removeEventListener('focus', refreshVisible); window.removeEventListener('online', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [mode, persistentReady, refreshAdmin, settings.apiEndpoint, token]);
  useEffect(() => {
    if (developmentPreview || mode !== 'admin' || token || !persistentReady) return undefined;
    // Load server-owned settings before showing the administrator login page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStore();
    return undefined;
  }, [mode, persistentReady, refreshStore, token]);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const addToCart = (item, qty = 1) => { setCart((lines) => lines.some((l) => l.id === item.id) ? lines.map((l) => l.id === item.id ? { ...l, qty: Math.min(item.stock, l.qty + qty) } : l) : [...lines, { id: item.id, qty }]); toast(`${item.name} added to bag`); };
  const toggleWish = (id) => setWishlist((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const toggleCompare = (id) => setCompare((ids) => { if (ids.includes(id)) return ids.filter((item) => item !== id); if (ids.length >= 3) { toast('You can compare up to three products.', 'info', 'Comparison limit'); return ids; } toast('Product added to technical comparison.', 'success', 'Comparison updated'); return [...ids, id]; });
  const openQuote = (selectedProduct = null) => { setProduct(null); setQuoteRequest({ open: true, product: selectedProduct }); };
  const submitQuote = async (payload) => {
    const request = { id: uid('QT'), date: new Date().toISOString().slice(0, 10), status: 'New', ...payload, product: payload.product || payload.productLabel || 'Complete system', quantity: Number(payload.quantity || 1) };
    try {
      const result = await apiCall(settings.apiEndpoint, 'createQuote', { quote: request });
      const saved = { ...request, id: result?.quoteId || request.id };
      setQuotes((current) => [saved, ...current]); setQuoteRequest({ open: false, product: null });
      toast(`Quote ${saved.id} saved successfully. We will contact you shortly.`, settings.apiEndpoint ? 'success' : 'warning', settings.apiEndpoint ? 'Quote synchronized' : 'Quote saved on this device');
    } catch (error) {
      setQuotes((current) => [request, ...current]); setQuoteRequest({ open: false, product: null });
      toast(`Quote ${request.id} is kept on this device, but server sync failed: ${error.message}`, 'error', 'Quote not synchronized');
    }
  };
  useEffect(() => {
    if (mode === 'admin') return undefined;
    const restoreView = () => { setView(viewForPath(window.location.pathname)); setShopCategory(''); setMenuOpen(false); window.scrollTo(0, 0); };
    window.addEventListener('popstate', restoreView);
    return () => window.removeEventListener('popstate', restoreView);
  }, [mode]);
  const navigate = (next, category = '') => {
    setView(next); setShopCategory(category); setMenuOpen(false);
    const nextPath = publicRoutes[next];
    if (nextPath && window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const checkout = () => { setCartOpen(false); navigate('checkout'); };
  const placeOrder = async (data) => {
    const newOrder = { id: data.requestId || uid('ITZ'), date: new Date().toISOString().slice(0, 10), customer: `${data.customer.firstName} ${data.customer.lastName}`, email: data.customer.email, total: data.total, status: 'Processing', payment: data.payment === 'cod' ? 'COD' : data.payment === 'bank' ? 'Pending' : 'Paid', items: data.lines.reduce((n, line) => n + line.qty, 0), coupon: data.coupon, lines: data.lines, shippingAddress: data.customer, subtotal: data.subtotal, discount: data.discount, shipping: data.shipping, tax: data.tax };
    let savedOrder = newOrder;
    try {
      const result = await apiCall(settings.apiEndpoint, 'createOrder', { order: newOrder });
      if (result?.order) savedOrder = result.order;
      else if (result?.orderId) savedOrder = { ...newOrder, id: result.orderId };
      toast(`Order ${savedOrder.id} saved successfully.`, settings.apiEndpoint ? 'success' : 'warning', settings.apiEndpoint ? 'Order synchronized' : 'Order saved on this device');
    } catch (error) { toast(`Order was not submitted: ${error.message}. Your cart is still available—please retry.`, 'error', 'Checkout not completed'); return false; }
    setOrders((current) => [savedOrder, ...current]); setProducts((current) => current.map((product) => { const line = data.lines.find((item) => item.id === product.id); return line ? { ...product, stock: Math.max(0, product.stock - line.qty) } : product; })); setCart([]);
    setPlacedOrder(savedOrder); setView('success'); window.scrollTo(0, 0);
    return true;
  };
  const login = async ({ email, password }) => { if (settings.apiEndpoint) { const result = await apiCall(settings.apiEndpoint, 'login', { email, password }); setToken(result.token); toast('Secure Cloudflare administration session established.', 'success', 'Signed in successfully'); } else { if (email !== settings.adminEmail || password !== 'inamtech2026') throw new Error('Email or password is incorrect.'); setToken(`local-${Date.now()}`); toast('Admin opened in device-only mode. Connect Cloudflare D1 for shared data.', 'warning', 'Local administration'); } };
  const isDark = colorMode === 'dark';
  const toggleTheme = () => setColorMode(isDark ? 'light' : 'dark');
  const returnToStore = () => { window.location.href = '/'; };
  const theme = {
    '--ink': isDark ? '#eef4ff' : '#07174a',
    '--lime': '#12a8ff',
    '--paper': isDark ? '#080f1b' : (settings.backgroundColor || '#f3f5f7'),
    '--tech-navy': isDark ? '#0b1230' : '#07174a',
    '--tech-deep': isDark ? '#040817' : '#04113c',
    '--tech-yellow': '#086cff',
    '--tech-blue': '#086cff',
    '--brand-violet': '#6827e8',
    '--brand-electric': '#086cff',
    '--brand-cyan': '#31ccff',
    '--brand-gradient': 'linear-gradient(135deg,#061a79 0%,#0877ff 42%,#4b2bd7 72%,#7b25ef 100%)',
    '--brand-glow': '0 14px 36px rgba(38,91,238,.24)',
    '--tech-soft': isDark ? '#101629' : (settings.backgroundColor || '#f3f5f7'),
    '--tech-line': isDark ? 'rgba(185,198,230,.16)' : 'rgba(35,43,66,.13)',
    '--surface': isDark ? '#0d1324' : '#ffffff',
    '--surface-elevated': isDark ? '#131a2e' : '#ffffff',
    '--surface-muted': isDark ? '#101629' : (settings.backgroundColor || '#f3f5f7'),
    '--text-main': isDark ? '#f1f4ff' : '#111525',
    '--text-muted': isDark ? '#aeb7cf' : '#5a6274',
  };
  if (!persistentReady || !serverHydrated) return <div className="data-boot-screen app-theme-root" data-theme={colorMode} style={theme}><BrandLockup settings={settings} />{!serverBootError && <span className="data-boot-spinner" aria-hidden="true" />}<strong>{serverBootError ? 'Shared store is temporarily unavailable' : 'Loading your saved store'}</strong><p>{serverBootError || ''}</p>{serverBootError && <button className="button button-dark" onClick={() => { setServerBootError(''); if (mode === 'admin' && token) refreshAdmin({ notify: true }); else refreshStore({ notify: true }); }}>Retry secure connection</button>}</div>;
  if (mode === 'admin' && !token) return <div className="app-theme-root" data-theme={colorMode} style={theme}><ThemeToggle mode={colorMode} onToggle={toggleTheme} className="admin-theme-fab" /><AdminLogin settings={settings} onLogin={login} onCancel={returnToStore} /><Toast notice={notice} onClose={() => setNotice(null)} /></div>;
  if (mode === 'admin') return <div className="app-theme-root" data-theme={colorMode} style={theme}><ThemeToggle mode={colorMode} onToggle={toggleTheme} className="admin-theme-fab" /><AdminApp products={products} setProducts={setProducts} orders={orders} setOrders={setOrders} quotes={quotes} setQuotes={setQuotes} categories={categories} setCategories={setCategories} customers={customers} setCustomers={setCustomers} coupons={coupons} setCoupons={setCoupons} settings={settings} setSettings={setSettings} token={token} setToken={setToken} onStore={returnToStore} toast={toast} syncState={syncState} onSyncState={setSyncState} onRefresh={refreshAdmin} /><Toast notice={notice} onClose={() => setNotice(null)} /></div>;
  if (settings.maintenanceMode) return <div className="maintenance app-theme-root" data-theme={colorMode} style={theme}><ThemeToggle mode={colorMode} onToggle={toggleTheme} className="page-theme-fab" /><strong>{settings.brandName}</strong><p className="eyebrow">A short pause</p><h1>We&apos;re making the store even better.</h1><p>Please check back soon or contact <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>.</p></div>;
  if (view === 'checkout') return <main className="store-shell standalone-shell" data-theme={colorMode} style={theme}><ThemeToggle mode={colorMode} onToggle={toggleTheme} className="page-theme-fab" /><CheckoutView cart={cart} products={products} settings={settings} couponList={coupons} onBack={() => navigate('shop')} onPlaceOrder={placeOrder} /><Toast notice={notice} onClose={() => setNotice(null)} /></main>;
  if (view === 'success') return <main className="store-shell standalone-shell" data-theme={colorMode} style={theme}><ThemeToggle mode={colorMode} onToggle={toggleTheme} className="page-theme-fab" /><SuccessView order={placedOrder} settings={settings} onHome={() => navigate('home')} /><Toast notice={notice} onClose={() => setNotice(null)} /></main>;
  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));
  return <main className="store-shell" data-theme={colorMode} style={theme}>
    <StoreHeader settings={settings} categories={categories} cartCount={cartCount} wishlistCount={wishlist.length} colorMode={colorMode} currentView={view} onThemeToggle={toggleTheme} onCart={() => setCartOpen(true)} onSearch={() => setSearchOpen(true)} onNavigate={navigate} onMenu={() => setMenuOpen(!menuOpen)} menuOpen={menuOpen} onQuote={openQuote} onTrack={() => setTrackOpen(true)} />
    {view === 'home' && <HomeView settings={settings} products={products} categories={categories} wishlist={wishlist} compare={compare} onProduct={setProduct} onAdd={addToCart} onWish={toggleWish} onCompare={toggleCompare} onShop={(category = '') => navigate('shop', category)} onQuote={openQuote} />}
    {view === 'shop' && <ShopView key={shopCategory} products={products} categories={categories} settings={settings} wishlist={wishlist} compare={compare} onProduct={setProduct} onAdd={addToCart} onWish={toggleWish} onCompare={toggleCompare} initialCategory={shopCategory} />}
    {view === 'solutions' && <SolutionsPage onNavigate={navigate} onQuote={openQuote} />}
    {view === 'services' && <ServicesPage settings={settings} onNavigate={navigate} onQuote={openQuote} />}
    {view === 'support' && <SupportPage settings={settings} onNavigate={navigate} onQuote={openQuote} onTrack={() => setTrackOpen(true)} />}
    {view === 'wishlist' && <div className="wishlist-page page-shell"><div className="shop-heading"><p className="eyebrow">Saved for later</p><h1>Your <em>project shortlist.</em></h1><p>{wishlistProducts.length} products saved for your next order.</p></div>{wishlistProducts.length ? <div className="product-grid catalog-grid">{wishlistProducts.map((p) => <ProductCard key={p.id} product={p} settings={settings} onProduct={setProduct} onAdd={addToCart} onWish={toggleWish} onCompare={toggleCompare} compared={compare.includes(p.id)} wished />)}</div> : <div className="empty-state"><span>♡</span><h2>No products saved yet</h2><p>Use the heart on any product to build your project shortlist.</p><button className="button button-dark" onClick={() => navigate('shop')}>Explore products</button></div>}</div>}
    <StoreFooter settings={settings} onNavigate={navigate} onQuote={openQuote} onTrack={() => setTrackOpen(true)} />
    <ProductModal key={product?.id || 'closed-product'} product={product} settings={settings} categories={categories} onClose={() => setProduct(null)} onAdd={addToCart} wished={product ? wishlist.includes(product.id) : false} onWish={toggleWish} onQuote={openQuote} onCompare={toggleCompare} compared={product ? compare.includes(product.id) : false} onCategory={(category) => { setProduct(null); navigate('shop', category); }} />
    <CartDrawer open={cartOpen} cart={cart} products={products} settings={settings} onClose={() => setCartOpen(false)} onQty={(id, delta) => setCart(cart.map((l) => l.id === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l))} onRemove={(id) => setCart(cart.filter((l) => l.id !== id))} onCheckout={checkout} />
    {settings.compareEnabled && compare.length > 0 && <button className="compare-floating" onClick={() => setCompareOpen(true)}><span>{compare.length}</span> Compare products <i>↗</i></button>}
    <QuoteModal open={quoteRequest.open} product={quoteRequest.product} categories={categories} settings={settings} onClose={() => setQuoteRequest({ open: false, product: null })} onSubmit={submitQuote} />
    <TrackOrderModal open={trackOpen} orders={orders} settings={settings} onClose={() => setTrackOpen(false)} />
    {compareOpen && <ComparePanel ids={compare} products={products} settings={settings} onRemove={toggleCompare} onClear={() => { setCompare([]); setCompareOpen(false); }} onClose={() => setCompareOpen(false)} onProduct={setProduct} />}
    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setSearchOpen(false)}>×</button><p className="eyebrow">Search INAM TECH ZONE</p><div><span>⌕</span><input autoFocus placeholder="Search cameras, inverters, tools, cable…" onKeyDown={(e) => { if (e.key === 'Enter') { setSearchOpen(false); navigate('shop'); } }} /></div><p>Popular: CCTV, solar inverter, PoE switch, power tools, access control</p></div>}
    <Toast notice={notice} onClose={() => setNotice(null)} />
  </main>;
}
