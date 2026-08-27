/* Every path where a file or a piece of user text becomes CSS, markup or a URL goes through
 * here first.
 *
 * The app is client-only today, so most of this is self-inflicted: you can only attack your
 * own browser. That stops being true the moment a design is shared, exported for someone
 * else, or loaded from a link — and these are the exact values that would travel. Validating
 * at the door is far cheaper than auditing every render path later.
 */

/* --- names that end up inside CSS ------------------------------------------ */

/* An uploaded font's name is interpolated into a quoted CSS string twice: once in the
 * @font-face rule and once in a font-family value. A file called
 *   x'; } body{display:none} .y{'.ttf
 * is a perfectly legal filename and would close the quote, close the rule, and inject
 * whatever it likes into the page. Strip rather than escape: no real typeface is named with
 * braces and semicolons, so there is nothing legitimate to preserve.
 */
export function safeFontName(raw, fallback = 'Uploaded font') {
  const cleaned = String(raw ?? '')
    .replace(/[^A-Za-z0-9 _-]+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  return cleaned || fallback;
}

/* The one way a family name is allowed to reach a font-family value. */
export const cssFontFamily = (name, fallback = 'sans-serif') => {
  const safe = safeFontName(name, '');
  return safe ? `'${safe}', ${fallback}` : fallback;
};

/* url() only ever receives a base64 data: URL that this module built. */
const DATA_URL = /^data:[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*;base64,[A-Za-z0-9+/]*={0,2}$/i;
export const isDataUrl = (value) => typeof value === 'string' && value.length <= 12e6 && DATA_URL.test(value);

/* --- limits ---------------------------------------------------------------- */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FONT_BYTES = 2 * 1024 * 1024;
/* The cap that matters is decoded pixels, not file size: a 40 KB PNG can legally decode to
 * 30000x30000, which is 3.6 GB of bitmap and a hung tab. */
export const MAX_IMAGE_PIXELS = 40e6;

/* --- file signatures ------------------------------------------------------- */

/* file.type comes from the extension, so it says whatever the file is named. The first bytes
 * are the only part of an upload that describes what it actually is. `null` means "any byte". */
const IMAGE_TYPES = [
  { type: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { type: 'image/gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { type: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
];

const FONT_TYPES = [
  { type: 'font/ttf', magic: [0x00, 0x01, 0x00, 0x00] },
  { type: 'font/ttf', magic: [0x74, 0x72, 0x75, 0x65] },        /* 'true' */
  { type: 'font/collection', magic: [0x74, 0x74, 0x63, 0x66] }, /* 'ttcf' */
  { type: 'font/otf', magic: [0x4f, 0x54, 0x54, 0x4f] },        /* 'OTTO' */
  { type: 'font/woff', magic: [0x77, 0x4f, 0x46, 0x46] },       /* 'wOFF' */
  { type: 'font/woff2', magic: [0x77, 0x4f, 0x46, 0x32] },      /* 'wOF2' */
];

const head = async (file, count) => new Uint8Array(await file.slice(0, count).arrayBuffer());
const matches = (bytes, magic) => magic.every((byte, index) => byte === null || bytes[index] === byte);
const identify = (bytes, table) => table.find((entry) => matches(bytes, entry.magic)) || null;

/* --- dimensions, read from the header rather than from a decoded bitmap ----- */

const be32 = (b, at) => (b[at] << 24 | b[at + 1] << 16 | b[at + 2] << 8 | b[at + 3]) >>> 0;
const le16 = (b, at) => b[at] | (b[at + 1] << 8);
const le24 = (b, at) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

/* A JPEG's size lives in a SOF marker somewhere after the header, so the segment chain has
 * to be walked. DHT/DAC/RST/SOS are skipped, and the scan stops at image data. */
function jpegSize(b) {
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) { at += 1; continue; }
    const marker = b[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    if (marker === 0xda || marker === 0xd9) return null;              /* start of scan */
    const length = (b[at + 2] << 8) | b[at + 3];
    /* SOF0-SOF15, minus the four that are not frame headers */
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: (b[at + 7] << 8) | b[at + 8], height: (b[at + 5] << 8) | b[at + 6] };
    }
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/* Returns null when the format is one we cannot read cheaply — the caller then falls back to
 * the post-decode check, which is a backstop rather than the main defence. */
function declaredSize(bytes, type) {
  if (type === 'image/png') return { width: be32(bytes, 16), height: be32(bytes, 20) };
  if (type === 'image/gif') return { width: le16(bytes, 6), height: le16(bytes, 8) };
  if (type === 'image/jpeg') return jpegSize(bytes);
  if (type === 'image/webp') {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X') return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
    if (chunk === 'VP8L') {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ') return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  return null;
}

function base64(bytes) {
  let binary = '';
  const chunk = 0x8000;   /* String.fromCharCode blows the stack on a whole 5 MB buffer */
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/* The MIME in the data URL is the one the signature proved, never the one the file claimed. */
async function asDataUrl(file, type) {
  return `data:${type};base64,${base64(new Uint8Array(await file.arrayBuffer()))}`;
}

function decode(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not a readable image.'));
    image.src = src;
  });
}

/* --- SVG ------------------------------------------------------------------- */

const looksLikeSvg = (bytes) => /^\s*(<\?xml|<!--|<svg)/i.test(new TextDecoder().decode(bytes));

/* SVG is markup, so a signature check proves nothing — it has to be sanitised. DOMPurify is
 * loaded only when an SVG actually arrives, so the 20 KB never reaches anyone else's bundle.
 * Beyond its SVG profile: no <use>/<image>/<foreignObject> and no href of any kind, so a
 * pasted logo cannot reach back out to the network. */
async function sanitiseSvg(file) {
  const { default: DOMPurify } = await import('dompurify');
  const clean = DOMPurify.sanitize(await file.text(), {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'use', 'image'],
    FORBID_ATTR: ['href', 'xlink:href'],
  });
  if (!/<svg[\s>]/i.test(clean)) throw new Error('That SVG could not be read.');
  return `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(clean)))}`;
}

/* --- the two entry points -------------------------------------------------- */

const TOO_BIG = 'That image is over 40 megapixels — please use a smaller one.';

export async function readImageFile(file) {
  if (!file) throw new Error('No file chosen.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Please use an image smaller than 5 MB.');
  /* 64 KB is enough to walk a JPEG's segment chain to its frame header. */
  const bytes = await head(file, 65536);
  const type = identify(bytes, IMAGE_TYPES);
  if (!type && !looksLikeSvg(bytes)) throw new Error('That file is not a PNG, JPEG, WebP, GIF or SVG.');

  /* The size check has to happen on the header, before anything decodes: a 20 KB PNG can
     legally declare 30000x30000, and by the time an <img> fires onload the tab has already
     allocated the 3.6 GB. The post-decode check below only backstops formats not read here. */
  if (type) {
    const declared = declaredSize(bytes, type.type);
    if (declared && declared.width * declared.height > MAX_IMAGE_PIXELS) throw new Error(TOO_BIG);
  }

  const src = type ? await asDataUrl(file, type.type) : await sanitiseSvg(file);
  const image = await decode(src);
  const width = image.naturalWidth || 1;
  const height = image.naturalHeight || 1;
  if (width * height > MAX_IMAGE_PIXELS) throw new Error(TOO_BIG);
  return { src, width, height };
}

export async function readFontFile(file) {
  if (!file) throw new Error('No file chosen.');
  if (file.size > MAX_FONT_BYTES) throw new Error('Please use a font file under 2 MB.');
  const type = identify(await head(file, 8), FONT_TYPES);
  if (!type) throw new Error('That is not a TrueType, OpenType or WOFF font file.');
  return {
    name: safeFontName(String(file.name).replace(/\.(ttf|ttc|otf|woff2?)$/i, '')),
    src: await asDataUrl(file, type.type),
  };
}
