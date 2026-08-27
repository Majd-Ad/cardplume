/* The card as data.
 *
 * Every visible thing on a card is one entry in `design.elements`. There are no special,
 * hard-coded slots any more: the name on a business card and a sticker somebody dropped on
 * it are the same kind of record, so both can be moved, resized, rotated, restyled, hidden,
 * reordered or deleted by exactly the same code.
 *
 * Geometry is stored in percentages of the card, never pixels. That is what lets one design
 * survive a switch from an 85x55 mm business card to a square one, and what lets the 460 px
 * preview and the 4x export render from the same numbers.
 */

export const BLEED_MM = 3;
export const SAFE_MM = 4;
export const PT_PER_MM = 72 / 25.4;

export const cardSizes = [
  { id: 'eu', label: 'Business card (EU)', detail: '85 × 55 mm', width: 85, height: 55 },
  { id: 'us', label: 'Business card (US)', detail: '3.5 × 2 in', width: 88.9, height: 50.8 },
  { id: 'iso', label: 'Card / wallet', detail: '85.6 × 54 mm', width: 85.6, height: 53.98 },
  { id: 'square', label: 'Square', detail: '55 × 55 mm', width: 55, height: 55 },
];

export function cardGeometry(design) {
  const preset = cardSizes.find((item) => item.id === design.cardSize) || cardSizes[0];
  const portrait = design.orientation === 'portrait';
  const width = portrait ? preset.height : preset.width;
  const height = portrait ? preset.width : preset.height;
  return { preset, width, height, ratio: width / height };
}

export const colors = [
  { name: 'Citrus', value: '#d9fb8f', ink: '#17221d' },
  { name: 'Blush', value: '#ffc2d7', ink: '#3d1d2d' },
  { name: 'Sunset', value: '#ff7947', ink: '#2b1712' },
  { name: 'Ink', value: '#17221d', ink: '#ffffff' },
  { name: 'Sky', value: '#b9d5ff', ink: '#15233c' },
  { name: 'Cloud', value: '#f5f0e7', ink: '#17221d' },
];

export const stampIcons = [
  { id: 'spark', label: 'Spark', glyph: '✦' },
  { id: 'heart', label: 'Heart', glyph: '♥' },
  { id: 'bolt', label: 'Bolt', glyph: 'ϟ' },
  { id: 'diamond', label: 'Diamond', glyph: '◆' },
  { id: 'dot', label: 'Dot', glyph: '●' },
];

export const kindLabels = { text: 'Text', icon: 'Icon', qr: 'QR code', image: 'Image', shape: 'Shape', blob: 'Circle', stamps: 'Stamp row', counter: 'Counter', stampCount: 'Visit count' };

/* Bumped whenever a stock element is added, so an old draft can be topped up exactly once. */
export const MODEL_VERSION = 3;

let seed = 0;
export const newId = () => `el${Date.now().toString(36)}${(seed += 1).toString(36)}`;

/* Percentages below were measured from the original flow layout so switching to absolute
   positioning did not change how a stock card looks. */
const mono = { font: 'DM Mono', size: 3.02, weight: 400, letterSpacing: 0.6 };
const display = { font: 'Space Grotesk', weight: 700 };

/* `fit` is on for every stock element and off for anything the user adds later. A stock
   layout is measured for the sample copy it ships with, so real content — which is always
   longer than "Amara Faye" — has to be allowed to shrink rather than wrap into the line
   below it. A text box somebody drew themselves is expected to wrap like a text box. */
function element(overrides) {
  return { id: newId(), kind: 'text', side: 'front', x: 4.78, y: 10, w: 40, rotation: 0, hidden: false, locked: false, fit: true, style: {}, ...overrides };
}

/* The accent circle. It used to be a CSS pseudo-element painted onto every card, which meant
   nobody could move, recolour or delete it. It is an ordinary element now. */
const accentBlob = (side = 'front') => element({
  id: side === 'back' ? 'backBlob' : 'blob', side, kind: 'blob',
  x: 60.87, y: -33.63, w: 54.35, style: { opacity: 0.88 },
});

export function defaultElements(type = 'Business') {
  const loyalty = type === 'Loyalty';
  const front = loyalty
    ? [
      accentBlob(),
      element({ id: 'logo', y: 7.39, w: 30, text: 'CP', bind: 'logoText', style: { ...mono } }),
      element({ id: 'counter', x: 65.57, y: 7.39, w: 30, kind: 'counter', style: { ...mono, align: 'right' } }),
      element({ id: 'title', y: 27.36, w: 62, text: 'ROAST & RITUAL', bind: 'brand', style: { ...display, size: 13.44, letterSpacing: -2.4 } }),
      element({ id: 'subtitle', y: 42.07, w: 50, text: 'YOUR COFFEE CLUB', style: { ...mono, letterSpacing: 0.8 } }),
      element({ id: 'stamps', y: 56.18, w: 58, kind: 'stamps', style: { size: 5.38 } }),
      element({ id: 'stampCount', y: 68.28, w: 40, kind: 'stampCount', style: { ...mono, size: 3.36, letterSpacing: 0 } }),
      element({ id: 'footer', y: 89.13, w: 60, text: '', bind: 'reward', uppercase: true, style: { ...mono } }),
    ]
    : [
      /* Decoration goes first, so it sits lowest: these are big, mostly transparent boxes
         that would otherwise swallow clicks meant for the name sitting on top of them. */
      accentBlob(),
      element({ id: 'shape', x: 61.85, y: 37.06, w: 34.18, kind: 'shape', rotation: -18 }),
      element({ id: 'logo', y: 7.39, w: 30, text: 'CP', bind: 'logoText', style: { ...mono } }),
      element({ id: 'counter', x: 65.57, y: 7.39, w: 30, text: '01 / 01', style: { ...mono, align: 'right' } }),
      element({ id: 'title', y: 38.71, w: 58, text: 'Amara Faye', bind: 'name', style: { ...display, size: 15.79, letterSpacing: -2.4 } }),
      element({ id: 'subtitle', y: 55.58, w: 55, text: 'Creative director', bind: 'role', style: { font: 'Space Grotesk', size: 4.37, weight: 400 } }),
      element({ id: 'footer', y: 89.13, w: 60, text: '', bind: 'website', uppercase: true, style: { ...mono } }),
    ];
  const back = [
    accentBlob('back'),
    element({ id: 'backLabel', side: 'back', y: 9.74, w: 40, text: "LET'S CONNECT", style: { ...mono, letterSpacing: 0.7 } }),
    element({ id: 'backName', side: 'back', y: 20.16, w: 55, text: 'Amara Faye', bind: 'name', style: { ...display, size: 10.42, letterSpacing: -1.5 } }),
    element({ id: 'backRole', side: 'back', y: 30.72, w: 50, text: 'Creative director', bind: 'role', style: { font: 'Space Grotesk', size: 4.03, weight: 400 } }),
    element({ id: 'backEmail', side: 'back', x: 71.67, y: 57, w: 24, bind: 'email', style: { ...mono, letterSpacing: 0.3 } }),
    element({ id: 'backPhone', side: 'back', x: 71.67, y: 62.71, w: 24, bind: 'phone', style: { ...mono, letterSpacing: 0.3 } }),
    element({ id: 'backWebsite', side: 'back', x: 71.67, y: 68.42, w: 24, bind: 'website', style: { ...mono, letterSpacing: 0.3 } }),
    element({ id: 'backQr', side: 'back', y: 72.45, w: 13.04, kind: 'qr' }),
  ];
  return [...front, ...back].map((item, index) => ({ ...item, z: index + 1 }));
}

export const initialDesign = {
  template: 'studio',
  type: 'Business',
  cardSize: 'eu',
  orientation: 'landscape',
  showGuides: false,
  v: MODEL_VERSION,
  name: 'Abdessamad Majdoubi',
  role: 'Creative director',
  email: 'hello@cardplume.tech',
  phone: '+212 723206749',
  website: 'cardplume.tech',
  brand: 'ROAST & RITUAL',
  reward: 'Free coffee after 8 visits',
  logoText: 'CP',
  stamps: 5,
  stampsTotal: 8,
  stampIcon: 'spark',
  stampIconCustom: '',
  qrValue: '',
  color: '#d9fb8f',
  accent: '#ff7947',
  ink: '#17221d',
  font: 'Space Grotesk',
  layout: 'classic',
  finish: 'Soft-touch',
  image: null,
  uploadedFonts: [],
  elements: defaultElements('Business'),
};

/* Elements a card type does not use are dropped, so a business card is not carrying an
   invisible stamp row around. Anything the user added themselves always survives. */
export function elementsForSide(design, side) {
  const loyalty = design.type === 'Loyalty';
  const skip = loyalty ? ['shape'] : ['stamps', 'stampCount'];
  return (design.elements || [])
    .filter((item) => item.side === side && !skip.includes(item.id))
    .sort((a, b) => (a.z || 0) - (b.z || 0));
}

export function findElement(design, id) { return (design.elements || []).find((item) => item.id === id) || null; }

/* Text that mirrors a design field (name, email, …) reads through to that field, so the
   side panel and the element stay in step no matter which one is edited. */
export function elementText(design, element) {
  const raw = element.bind ? design[element.bind] ?? '' : element.text ?? '';
  return element.uppercase ? String(raw).toUpperCase() : String(raw);
}

export function labelFor(design, element) {
  if (!element) return '';
  if (element.kind === 'text') { const text = elementText(design, element); return `Text — ${text.slice(0, 22) || 'empty'}`; }
  if (element.kind === 'icon') return element.icon ? `Icon — ${element.icon.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}` : `Icon ${element.glyph || ''}`;
  if (element.kind === 'image') return element.name ? `Image — ${element.name}` : 'Image';
  return kindLabels[element.kind] || element.kind;
}

export const isTextual = (element) => element && (element.kind === 'text' || element.kind === 'icon' || element.kind === 'counter' || element.kind === 'stampCount');

/* Kinds whose height follows their width instead of their content. */
export const isBoxed = (element) => element && (element.kind === 'qr' || element.kind === 'image' || element.kind === 'shape' || element.kind === 'blob');

/* Kinds that are decoration rather than content: they take a fill colour, not an ink colour. */
export const isDecor = (element) => element && (element.kind === 'shape' || element.kind === 'blob');

export function qrLink(design, element) {
  return ((element && element.value) || design.qrValue || design.website || 'cardplume.tech').trim() || ' ';
}

export function isDarkHex(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return false;
  const value = parseInt(match[1], 16);
  return (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) < 140;
}

/* Scanners need dark modules on a light plate, so an inked card gets a light patch behind
   its QR rather than an inverted code no phone will read. */
export function qrPalette(design) {
  return { plate: isDarkHex(design.color) ? '#f5f0e7' : design.color, ink: '#17221d' };
}

/* Designs saved before the element model was introduced stored fixed layer names plus three
   parallel maps (textPositions / hiddenLayers / layerStyles). Fold all of that into elements
   so old drafts open with their edits intact instead of silently resetting. */
export function migrateDesign(input) {
  /* Each top-up is gated on the version the draft was actually saved at, not on "is this the
     current version", so adding a new one never re-runs an older one over a draft that has
     already been through it — and never undoes an edit that top-up was made to allow. */
  const saved = Number(input?.v) || 0;
  const design = { ...initialDesign, ...input, v: MODEL_VERSION };
  if (Array.isArray(design.elements) && design.elements.length) {
    let next = design;
    if (saved < 2) next = withAccentBlob(next);
    if (saved < 3) next = withFitText(next);
    return normalise(next);
  }
  const elements = defaultElements(design.type);
  const positions = design.textPositions || {};
  const hidden = design.hiddenLayers || {};
  const styles = design.layerStyles || {};
  const cardW = 460;
  const cardH = cardW / cardGeometry(design).ratio;
  const merged = elements.map((item) => {
    const offset = positions[item.id];
    const style = { ...item.style, ...(styles[item.id] || {}) };
    if (styles[item.id]?.size) style.size = (styles[item.id].size / cardH) * 100;
    return {
      ...item,
      x: offset ? item.x + (offset.x / cardW) * 100 : item.x,
      y: offset ? item.y + (offset.y / cardH) * 100 : item.y,
      hidden: !!hidden[item.id],
      style,
    };
  });
  const extras = (design.extras || []).map((extra, index) => {
    const offset = positions[extra.id] || { x: 0, y: 0 };
    const kind = extra.kind === 'qr' ? 'qr' : extra.kind === 'image' ? 'image' : extra.kind === 'icon' ? 'icon' : 'text';
    return {
      id: extra.id, kind, side: extra.side || 'front',
      x: (offset.x / cardW) * 100, y: (offset.y / cardH) * 100,
      w: ((extra.size || 60) / cardW) * 100 * (kind === 'text' || kind === 'icon' ? 4 : 1),
      rotation: 0, z: merged.length + index + 1, hidden: !!hidden[extra.id], locked: false,
      text: extra.text, glyph: extra.glyph, value: extra.value, src: extra.src, name: extra.name,
      style: kind === 'text' || kind === 'icon' ? { size: ((extra.size || 16) / cardH) * 100 } : {},
    };
  });
  const next = { ...design, elements: [...merged, ...extras] };
  delete next.textPositions; delete next.hiddenLayers; delete next.layerStyles; delete next.extras; delete next.customFont;
  return normalise(next);
}

/* A draft saved before the accent circle became a real element has no record of it. Add one
   per side, underneath everything, and stamp the version — without the stamp, deleting the
   circle would simply bring it back on the next load. */
function withAccentBlob(design) {
  const missing = ['front', 'back'].filter((side) => !design.elements.some((item) => item.kind === 'blob' && item.side === side));
  if (!missing.length) return design;
  return {
    ...design,
    elements: [
      ...missing.map((side, index) => ({ ...accentBlob(side), z: index + 1 })),
      ...design.elements.map((item) => ({ ...item, z: (item.z || 0) + missing.length })),
    ],
  };
}

/* Stock elements in a draft saved before text could shrink were laid out on the assumption
   that it never would, so a long name in one of those drafts is still sitting on top of the
   job title. Switch them over once. Elements the reader added themselves are left wrapping,
   and an explicit choice either way is never overwritten. */
let stockIds = null;
function withFitText(design) {
  stockIds = stockIds || new Set([...defaultElements('Business'), ...defaultElements('Loyalty')].map((item) => item.id));
  return {
    ...design,
    elements: design.elements.map((item) => (item.fit === undefined && stockIds.has(item.id) ? { ...item, fit: true } : item)),
  };
}

function normalise(design) {
  return {
    ...design,
    elements: (design.elements || []).map((item, index) => ({
      rotation: 0, hidden: false, locked: false, style: {}, side: 'front', kind: 'text', ...item,
      z: item.z ?? index + 1,
    })),
  };
}

/* The catalogue itself is plain data in its own file — see templates.js. */
export { templates } from './templates';

/* Applying a template rebuilds the stock elements but keeps anything the user added, so
   trying a different look does not throw away their own stickers, QR codes or text. */
export function applyTemplate(design, template) {
  const type = template.blank ? 'Business' : (template.type === 'Playfair' ? 'Business' : template.type);
  const fresh = defaultElements(type);
  const stockIds = new Set(fresh.map((item) => item.id));
  const mine = (design.elements || []).filter((item) => !stockIds.has(item.id));
  const top = fresh.length;
  return {
    ...design,
    template: template.id,
    type,
    color: template.color,
    accent: template.accent,
    ink: template.ink ?? colors.find((item) => item.value === template.color)?.ink ?? design.ink,
    font: template.font,
    stampsTotal: template.stampsTotal ?? design.stampsTotal,
    stamps: template.stampsTotal ? Math.min(design.stamps, template.stampsTotal) : design.stamps,
    ...(template.blank ? { name: '', role: '', brand: '', reward: '', logoText: '' } : {}),
    elements: [...fresh, ...mine.map((item, index) => ({ ...item, z: top + index + 1 }))],
  };
}
