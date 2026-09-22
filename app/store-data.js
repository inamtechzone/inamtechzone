export const defaultSettings = {
  brandName: 'INAM TECH ZONE', brandMark: 'ITZ',
  announcement: 'Free delivery on qualified project orders',
  announcementNote: 'Trade pricing · Technical support · Genuine-grade solutions',
  headerLinks: ['Home', 'Products', 'Solutions', 'Services', 'Support'],
  heroEyebrow: 'Power · Security · Control', heroTitle: 'Technology built', heroAccent: 'for every project.',
  heroDescription: 'Professional hardware, electrical, surveillance, solar and networking solutions—with expert guidance from selection to installation.',
  heroImage: '/products/alarm-system.jpg',
  primaryColor: '#0b1628', accentColor: '#2457d6', backgroundColor: '#f3f5f7',
  currency: 'PKR', currencySymbol: 'Rs', deliveryChargesEnabled: true, freeShippingThreshold: 25000, flatShippingRate: 800, taxRate: 0,
  supportEmail: 'sales@inamtechzone.com', supportPhone: '+92 300 000 0000', whatsapp: '+92 300 000 0000',
  businessHours: 'Monday–Saturday · 9:00 AM–7:00 PM', address: 'Pakistan · Nationwide project delivery',
  footerHeadline: 'Build smarter with INAM TECH ZONE.',
  footerText: 'Product updates, technical guides and project pricing—straight to your inbox.',
  footerCopyright: '© 2026 INAM TECH ZONE. All rights reserved.',
  instagram: 'https://instagram.com', facebook: 'https://facebook.com', youtube: 'https://youtube.com',
  apiEndpoint: '', storageProvider: 'Cloudflare Pages + D1 + R2', adminEmail: 'admin@inamtechzone.com', maintenanceMode: false,
  codEnabled: true, cardEnabled: true, bankEnabled: true, quoteEnabled: true, compareEnabled: true,
  technicalDownloadsEnabled: true, projectPricingEnabled: true,
};

export const categoriesSeed = [
  ['hardware', 'Hardware'], ['tools', 'Power Tools'], ['electrical', 'Electrical'], ['cctv', 'CCTV & Surveillance'],
  ['solar', 'Solar Energy'], ['networking', 'Networking'], ['alarm', 'Alarm Systems'], ['access', 'Access Control'],
  ['fire', 'Fire Alarm'], ['accessories', 'Accessories'],
].map(([id, name]) => ({ id: `cat-${id}`, name, slug: name.toLowerCase().replace(/&/g, '').replace(/\W+/g, '-').replace(/^-|-$/g, ''), active: true }));

const bundledImages = {
  'photo-1504148455328-c376907d081c': '/products/brushless-drill.jpg',
  'photo-1557597774-9d273605dfa9': '/products/security-camera.jpg',
  'photo-1508514177221-188b1cf16e9d': '/products/solar-panel.jpg',
  'photo-1558494949-ef010cbdcc31': '/products/network-switch.jpg',
  'photo-1621905251918-48416bd8575a': '/products/hybrid-inverter.jpg',
  'photo-1558618666-fcd25c85cd64': '/products/network-cable.jpg',
  'photo-1563013544-824ae1b704d3': '/products/access-terminal.jpg',
  'photo-1488229297570-58520851e868': '/products/fire-panel.jpg',
  'photo-1558002038-1055907df827': '/products/alarm-system.jpg',
  'photo-1621905252507-b35492cc74b4': '/products/circuit-breaker.jpg',
  'photo-1530124566582-a618bc2615dc': '/products/tool-set.jpg',
};
const img = (id) => bundledImages[id] || '/itz-logo-transparent.png';
const product = (data) => ({ gallery: [], status: 'active', featured: false, rating: 4.8, reviews: 48, ...data });

export const productSeed = [
  product({ id: 'prd-brushless-drill', slug: '20v-brushless-drill-kit', name: '20V Brushless Drill Kit', category: 'Power Tools', brand: 'ProLine', model: 'BLD-20X', price: 48900, comparePrice: 54900, stock: 24, sku: 'ITZ-TOL-001', badge: 'Pro Pick', rating: 4.9, reviews: 128, color: 'Industrial Black', featured: true, image: img('photo-1504148455328-c376907d081c'), description: 'A professional brushless drill and impact driver kit engineered for all-day installation work.', details: ['20V brushless motor', '2 × 4.0Ah batteries', '13mm metal chuck', 'Two-year warranty'], warranty: '2 years', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-ai-camera', slug: '4k-ai-poe-camera', name: '4K AI PoE Security Camera', category: 'CCTV & Surveillance', brand: 'VisionPro', model: 'VP-8MP-AI', price: 32900, comparePrice: 37900, stock: 42, sku: 'ITZ-CCTV-014', badge: 'Bestseller', reviews: 96, color: 'Weatherproof White', featured: true, image: img('photo-1557597774-9d273605dfa9'), description: 'Professional 4K surveillance with AI human detection, true WDR and dependable night vision.', details: ['8MP 4K sensor', 'AI human detection', '50m IR night vision', 'IP67 weather protection'], warranty: '2 years', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-solar-panel', slug: '550w-mono-solar-panel', name: '550W Mono Solar Panel', category: 'Solar Energy', brand: 'SolarCore', model: 'SC-550M', price: 46500, comparePrice: 51500, stock: 65, sku: 'ITZ-SOL-022', badge: 'Tier 1', rating: 4.9, reviews: 71, color: 'Black Frame', featured: true, image: img('photo-1508514177221-188b1cf16e9d'), description: 'High-efficiency monocrystalline module for residential, commercial and off-grid solar projects.', details: ['550W rated output', '21.3% module efficiency', 'Half-cut cell technology', '25-year performance warranty'], warranty: '12-year product / 25-year output', leadTime: '2–4 working days' }),
  product({ id: 'prd-poe-switch', slug: '24-port-gigabit-poe-switch', name: '24-Port Gigabit PoE+ Switch', category: 'Networking', brand: 'NetCore', model: 'NC-24P-370', price: 82900, comparePrice: 89900, stock: 16, sku: 'ITZ-NET-008', badge: 'Project Ready', rating: 4.9, reviews: 54, color: 'Rackmount Black', featured: true, image: img('photo-1558494949-ef010cbdcc31'), description: 'Managed gigabit PoE+ switching for IP cameras, access points, VoIP and reliable business networks.', details: ['24 × Gigabit PoE+ ports', '370W PoE budget', 'VLAN and QoS management', 'Rackmount hardware included'], warranty: '3 years', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-hybrid-inverter', slug: '5kw-hybrid-solar-inverter', name: '5kW Hybrid Solar Inverter', category: 'Solar Energy', brand: 'SolarCore', model: 'H5K-48V', price: 289000, comparePrice: 315000, stock: 9, sku: 'ITZ-SOL-031', badge: 'Smart Energy', reviews: 43, color: 'Graphite', featured: true, image: img('photo-1621905251918-48416bd8575a'), description: 'Hybrid inverter with dual MPPT, battery-ready operation and intelligent energy monitoring.', details: ['5kW pure sine output', 'Dual MPPT controller', 'Wi-Fi energy monitoring', 'Lithium and lead-acid support'], warranty: '5 years', leadTime: '2–4 working days' }),
  product({ id: 'prd-cat6-cable', slug: 'cat6-outdoor-cable-305m', name: 'CAT6 Outdoor Network Cable · 305m', category: 'Networking', brand: 'NetCore', model: 'NC-C6-OUT', price: 38500, comparePrice: 42000, stock: 38, sku: 'ITZ-NET-019', badge: 'Installer Pack', rating: 4.7, reviews: 65, color: 'UV Black', image: img('photo-1558618666-fcd25c85cd64'), description: 'Full-copper outdoor CAT6 cable for dependable gigabit links, IP cameras and structured cabling.', details: ['305m pull box', '23AWG solid copper', 'UV-resistant PE jacket', 'Fluke test compliant'], warranty: '1 year', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-access-terminal', slug: 'biometric-access-terminal', name: 'Face & Fingerprint Access Terminal', category: 'Access Control', brand: 'SecureEntry', model: 'SE-FACE-PRO', price: 75900, comparePrice: 84900, stock: 14, sku: 'ITZ-ACS-012', badge: 'Touchless', rating: 4.9, reviews: 36, color: 'Midnight', featured: true, image: img('photo-1563013544-824ae1b704d3'), description: 'Fast multi-factor attendance and access control terminal for offices, sites and secure facilities.', details: ['Face, fingerprint, card and PIN', '3,000-user capacity', 'TCP/IP and Wi-Fi', 'Access relay included'], warranty: '2 years', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-fire-panel', slug: 'addressable-fire-alarm-panel', name: 'Addressable Fire Alarm Control Panel', category: 'Fire Alarm', brand: 'SafeGuard', model: 'SG-2L-250', price: 185000, comparePrice: 205000, stock: 6, sku: 'ITZ-FIR-004', badge: 'Life Safety', rating: 4.9, reviews: 22, color: 'Safety Red', featured: true, image: img('photo-1488229297570-58520851e868'), description: 'Two-loop intelligent fire detection panel with event logging and programmable cause-and-effect control.', details: ['2 addressable loops', '250 devices per loop', 'LCD event display', 'EN54-oriented design'], warranty: '2 years', leadTime: 'Project order · 5–7 days' }),
  product({ id: 'prd-alarm-kit', slug: 'wireless-smart-alarm-kit', name: 'Wireless Smart Alarm Kit', category: 'Alarm Systems', brand: 'SecureEntry', model: 'SE-ALARM-8', price: 64900, comparePrice: 72500, stock: 18, sku: 'ITZ-ALM-021', badge: 'Smart Security', rating: 4.7, reviews: 58, color: 'Arctic White', image: img('photo-1558002038-1055907df827'), description: 'App-connected wireless intrusion kit for homes, offices and retail environments.', details: ['8-zone starter bundle', 'Mobile push notifications', 'Battery backup', 'Expandable to 64 sensors'], warranty: '2 years', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-breaker', slug: '63a-smart-circuit-breaker', name: '63A Smart Circuit Breaker', category: 'Electrical', brand: 'VoltEdge', model: 'VE-63-WIFI', price: 14900, comparePrice: 16900, stock: 76, sku: 'ITZ-ELC-063', badge: 'Energy Monitor', rating: 4.6, reviews: 47, color: 'DIN White', image: img('photo-1621905252507-b35492cc74b4'), description: 'DIN-rail smart protection with remote switching, scheduling and live energy measurement.', details: ['63A rated current', 'Voltage and energy metering', 'Over/under-voltage protection', '2.4GHz Wi-Fi control'], warranty: '1 year', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-tool-set', slug: '108-piece-professional-tool-set', name: '108-Piece Professional Tool Set', category: 'Hardware', brand: 'ProLine', model: 'PL-108M', price: 52900, comparePrice: 58900, stock: 21, sku: 'ITZ-HDW-108', badge: 'Workshop Set', reviews: 82, color: 'Chrome / Black', image: img('photo-1530124566582-a618bc2615dc'), description: 'Comprehensive mechanic and installation set organized in a heavy-duty molded case.', details: ['Chrome vanadium steel', '1/4 and 1/2 inch drive', 'Metric socket range', 'Heavy-duty carry case'], warranty: 'Lifetime hand-tool warranty', leadTime: 'Ready to dispatch' }),
  product({ id: 'prd-nvr-kit', slug: '8-channel-6mp-nvr-kit', name: '8-Channel 6MP NVR Camera Kit', category: 'CCTV & Surveillance', brand: 'VisionPro', model: 'VP-NVR8-6K', price: 248000, comparePrice: 275000, stock: 11, sku: 'ITZ-CCTV-028', badge: 'Complete Kit', rating: 4.9, reviews: 69, color: 'Professional White', featured: true, image: img('photo-1557597774-9d273605dfa9'), description: 'Complete eight-camera PoE surveillance bundle for commercial-grade recording and remote monitoring.', details: ['8 × 6MP PoE cameras', '8-channel H.265+ NVR', '4TB surveillance drive', 'Remote mobile viewing'], warranty: '2 years', leadTime: '2–4 working days' }),
];

export const orderSeed = [
  { id: 'ITZ-1084', date: '2026-08-22', customer: 'Ahsan Builders', email: 'procurement@example.com', total: 321800, subtotal: 321000, shipping: 800, discount: 0, status: 'Processing', payment: 'Paid', items: 4, courier: '', trackingNumber: '', estimatedDelivery: '2026-08-28', shippingAddress: { address: 'Industrial Estate Road', city: 'Lahore', region: 'Punjab', postal: '54000', country: 'Pakistan', phone: '+92 300 111 2026' }, lines: [{ id: productSeed[0].id, qty: 2, product: productSeed[0] }, { id: productSeed[1].id, qty: 2, product: productSeed[1] }], timeline: [{ stage: 'Confirmed', date: '2026-08-22T10:12:00', note: 'Payment verified and order confirmed.' }, { stage: 'Processing', date: '2026-08-23T09:20:00', note: 'Products reserved for quality inspection.' }] },
  { id: 'ITZ-1083', date: '2026-08-22', customer: 'Zain Networks', email: 'zain@example.com', total: 82900, subtotal: 82900, shipping: 0, discount: 0, status: 'Shipped', payment: 'Paid', items: 1, courier: 'TCS', trackingNumber: 'TCS-ITZ-1083-PK', estimatedDelivery: '2026-08-25', shippingAddress: { address: 'Blue Area', city: 'Islamabad', region: 'ICT', postal: '44000', country: 'Pakistan', phone: '+92 311 222 2026' }, lines: [{ id: productSeed[3].id, qty: 1, product: productSeed[3] }], timeline: [{ stage: 'Confirmed', date: '2026-08-22T08:30:00', note: 'Order confirmed.' }, { stage: 'Processing', date: '2026-08-22T10:15:00', note: 'Stock allocated.' }, { stage: 'Packed', date: '2026-08-22T14:40:00', note: 'Shipment packed and labelled.' }, { stage: 'Shipped', date: '2026-08-23T11:05:00', note: 'Collected by TCS.' }] },
  { id: 'ITZ-1082', date: '2026-08-21', customer: 'Noor Solar', email: 'noor@example.com', total: 514000, subtotal: 514000, shipping: 0, discount: 0, status: 'Delivered', payment: 'Paid', items: 3, courier: 'Leopards', trackingNumber: 'LEO-ITZ-1082', estimatedDelivery: '2026-08-23', shippingAddress: { address: 'University Road', city: 'Peshawar', region: 'Khyber Pakhtunkhwa', postal: '25000', country: 'Pakistan', phone: '+92 333 444 2026' }, lines: [{ id: productSeed[4].id, qty: 1, product: productSeed[4] }, { id: productSeed[2].id, qty: 2, product: productSeed[2] }], timeline: [{ stage: 'Confirmed', date: '2026-08-21T09:00:00', note: 'Order confirmed.' }, { stage: 'Processing', date: '2026-08-21T11:00:00', note: 'Technical compatibility checked.' }, { stage: 'Packed', date: '2026-08-21T16:00:00', note: 'Pallet secured.' }, { stage: 'Shipped', date: '2026-08-22T08:00:00', note: 'Dispatched through Leopards.' }, { stage: 'Delivered', date: '2026-08-23T15:25:00', note: 'Delivery completed.' }] },
  { id: 'ITZ-1081', date: '2026-08-20', customer: 'Bilal Khan', email: 'bilal@example.com', total: 32900, subtotal: 32100, shipping: 800, discount: 0, status: 'On hold', payment: 'COD', items: 1, courier: '', trackingNumber: '', estimatedDelivery: '', shippingAddress: { address: 'Satellite Town', city: 'Rawalpindi', region: 'Punjab', postal: '46000', country: 'Pakistan', phone: '+92 321 555 2026' }, lines: [{ id: productSeed[1].id, qty: 1, product: productSeed[1] }], timeline: [{ stage: 'Confirmed', date: '2026-08-20T13:10:00', note: 'COD order received.' }, { stage: 'On hold', date: '2026-08-20T14:00:00', note: 'Awaiting phone verification.' }] },
  { id: 'ITZ-1080', date: '2026-08-19', customer: 'Metro Security', email: 'metro@example.com', total: 248000, subtotal: 248000, shipping: 0, discount: 0, status: 'Delivered', payment: 'Paid', items: 1, courier: 'M&P', trackingNumber: 'MP-ITZ-1080', estimatedDelivery: '2026-08-22', shippingAddress: { address: 'Shahrah-e-Faisal', city: 'Karachi', region: 'Sindh', postal: '75350', country: 'Pakistan', phone: '+92 300 777 2026' }, lines: [{ id: productSeed[11].id, qty: 1, product: productSeed[11] }], timeline: [{ stage: 'Confirmed', date: '2026-08-19T10:00:00', note: 'Order confirmed.' }, { stage: 'Processing', date: '2026-08-19T12:00:00', note: 'Recorder and cameras tested.' }, { stage: 'Packed', date: '2026-08-20T09:00:00', note: 'Fragile shipment packed.' }, { stage: 'Shipped', date: '2026-08-20T15:00:00', note: 'Collected by M&P.' }, { stage: 'Delivered', date: '2026-08-22T12:35:00', note: 'Signed delivery completed.' }] },
];

export const customerSeed = [
  { id: 'CUS-1001', name: 'Ahsan Builders', email: 'procurement@example.com', orders: 6, spent: 1248000, joined: 'May 12, 2026' },
  { id: 'CUS-1002', name: 'Zain Networks', email: 'zain@example.com', orders: 3, spent: 487000, joined: 'Jun 08, 2026' },
  { id: 'CUS-1003', name: 'Noor Solar', email: 'noor@example.com', orders: 8, spent: 2094000, joined: 'Feb 24, 2026' },
  { id: 'CUS-1004', name: 'Bilal Khan', email: 'bilal@example.com', orders: 2, spent: 222000, joined: 'Aug 02, 2026' },
];

export const couponSeed = [
  { code: 'WELCOME10', type: 'percent', value: 10, active: true, uses: 42 },
  { code: 'PROJECT5000', type: 'fixed', value: 5000, active: true, uses: 17 },
  { code: 'FREESHIP', type: 'shipping', value: 0, active: true, uses: 31 },
];

export const quoteSeed = [
  { id: 'QT-2041', date: '2026-08-23', customer: 'Falcon Enterprises', email: 'projects@example.com', phone: '+92 300 123 4567', company: 'Falcon Enterprises', projectType: 'CCTV & Surveillance', product: '8-Channel 6MP NVR Camera Kit', quantity: 3, status: 'New' },
  { id: 'QT-2040', date: '2026-08-22', customer: 'Hamza Ahmed', email: 'hamza@example.com', phone: '+92 311 123 4567', company: 'HA Solutions', projectType: 'Solar Energy', product: '5kW Hybrid Solar Inverter', quantity: 2, status: 'Contacted' },
];

export function formatMoney(value, settings = defaultSettings) {
  try {
    const locale = settings.currency === 'PKR' ? 'en-PK' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: settings.currency || 'PKR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch {
    return `${settings.currencySymbol || 'Rs'} ${Number(value || 0).toFixed(0)}`;
  }
}
