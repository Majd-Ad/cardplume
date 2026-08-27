import { toCanvas } from 'html-to-image';
import { BLEED_MM, PT_PER_MM } from './model';

function triggerDownload(filename, href) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  link.click();
}

/* Bleed by stretching the outermost pixel row/column outward. A photo that runs to the trim
   edge keeps running past it, instead of stopping at a band of flat colour. */
export function withBleed(source, bleedPx) {
  if (!bleedPx) return source;
  const out = document.createElement('canvas');
  out.width = source.width + bleedPx * 2;
  out.height = source.height + bleedPx * 2;
  const context = out.getContext('2d');
  const { width: w, height: h } = source;
  context.drawImage(source, 0, 0, w, 1, bleedPx, 0, w, bleedPx);
  context.drawImage(source, 0, h - 1, w, 1, bleedPx, h + bleedPx, w, bleedPx);
  context.drawImage(source, 0, 0, 1, h, 0, bleedPx, bleedPx, h);
  context.drawImage(source, w - 1, 0, 1, h, w + bleedPx, bleedPx, bleedPx, h);
  context.drawImage(source, 0, 0, 1, 1, 0, 0, bleedPx, bleedPx);
  context.drawImage(source, w - 1, 0, 1, 1, w + bleedPx, 0, bleedPx, bleedPx);
  context.drawImage(source, 0, h - 1, 1, 1, 0, h + bleedPx, bleedPx, bleedPx);
  context.drawImage(source, w - 1, h - 1, 1, 1, w + bleedPx, h + bleedPx, bleedPx, bleedPx);
  context.drawImage(source, bleedPx, bleedPx);
  return out;
}

/* The export stage renders the very same CardCanvas the studio shows, so a download can no
   longer disagree with the preview. */
export async function captureSides(stage, sides) {
  if (!stage) throw new Error('Export stage is not ready.');
  if (document.fonts?.ready) await document.fonts.ready;
  const shots = [];
  for (const side of sides) {
    const node = stage.querySelector(`[data-export-side="${side}"]`);
    if (node) shots.push({ side, canvas: await toCanvas(node, { pixelRatio: 4, backgroundColor: null }) });
  }
  if (!shots.length) throw new Error('Nothing to export.');
  return shots;
}

export async function exportPng(shots, name) {
  for (const [index, shot] of shots.entries()) {
    triggerDownload(`${name}-${shot.side}.png`, shot.canvas.toDataURL('image/png'));
    /* Browsers drop back-to-back downloads, so let each one settle. */
    if (index < shots.length - 1) await new Promise((resolve) => { window.setTimeout(resolve, 400); });
  }
  return shots.length;
}

/* pdf-lib is large and most exports are PNG, so it is only fetched when a PDF is asked for. */
export async function exportPdf(shots, name, geometry) {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const trimW = geometry.width * PT_PER_MM;
  const trimH = geometry.height * PT_PER_MM;
  const bleed = BLEED_MM * PT_PER_MM;
  const pageW = trimW + bleed * 2;
  const pageH = trimH + bleed * 2;
  for (const shot of shots) {
    const bleedPx = Math.round((BLEED_MM / geometry.width) * shot.canvas.width);
    const bled = withBleed(shot.canvas, bleedPx);
    /* toBlob rather than fetch(toDataURL(...)): fetching a data: URL counts as a connection,
       so a Content-Security-Policy with a strict connect-src blocks it and PDF export dies in
       production while working perfectly on a dev server with no headers. This also skips
       base64-encoding a 20 MB image only to immediately decode it again. */
    const bytes = await new Promise((resolve, reject) => {
      bled.toBlob(
        (blob) => (blob ? resolve(blob.arrayBuffer()) : reject(new Error('The card could not be rendered for print.'))),
        'image/png',
      );
    });
    const image = await pdf.embedPng(bytes);
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
    /* Crop marks sit in the bleed, pointing at the trim line the guillotine follows. */
    const line = { thickness: 0.4, color: rgb(0, 0, 0) };
    for (const x of [bleed, bleed + trimW]) {
      page.drawLine({ start: { x, y: 0 }, end: { x, y: Math.max(0, bleed - 1) }, ...line });
      page.drawLine({ start: { x, y: pageH }, end: { x, y: pageH - Math.max(0, bleed - 1) }, ...line });
    }
    for (const y of [bleed, bleed + trimH]) {
      page.drawLine({ start: { x: 0, y }, end: { x: Math.max(0, bleed - 1), y }, ...line });
      page.drawLine({ start: { x: pageW, y }, end: { x: pageW - Math.max(0, bleed - 1), y }, ...line });
    }
  }
  const data = await pdf.save();
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  triggerDownload(`${name}-print.pdf`, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return shots.length;
}
