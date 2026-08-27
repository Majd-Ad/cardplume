import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  SAFE_MM, cardGeometry, elementsForSide, elementText, isBoxed, isTextual, qrLink, qrPalette, stampIcons,
} from './model';
import { cssFontFamily } from './safety';
import { IconArt } from './icons';

/* A real, scannable QR drawn as one path of dark modules — no external requests. */
export function QrMark({ value, plate, ink }) {
  const model = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value || ' ');
    qr.make();
    return qr;
  }, [value]);
  const count = model.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (model.isDark(row, column)) path += `M${column} ${row}h1v1h-1z`;
    }
  }
  return <svg viewBox={`0 0 ${count} ${count}`} shapeRendering="crispEdges" aria-label="QR code" preserveAspectRatio="none">
    <rect width={count} height={count} fill={plate} />
    <path d={path} fill={ink} />
  </svg>;
}

/* Font sizes are stored as a share of card height, so the card needs to publish its own
   height to CSS. One observer per card keeps preview and export in agreement. */
function useCardHeight(ref) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    /* offsetHeight, not getBoundingClientRect: the card plays a rotateY flip animation and
       a client rect is transform-aware, so it would freeze a skewed height into every
       font size on the card. offsetHeight is the layout box and ignores transforms. */
    const update = () => setHeight(node.offsetHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

function ElementBody({ design, element, palette }) {
  if (element.kind === 'qr') return <QrMark value={qrLink(design, element)} plate={palette.plate} ink={palette.ink} />;
  if (element.kind === 'image') return <img src={element.src} alt={element.name || 'Added image'} />;
  if (element.kind === 'shape') return <span className="shape-mark"><i /><i /></span>;
  if (element.kind === 'blob') return null;   /* the box itself is the shape */
  /* Two kinds of icon: one picked from the library, which is vector node data, and one
     typed by hand, which is just a character and stays editable in place. */
  if (element.kind === 'icon') {
    return element.svg?.length ? <IconArt nodes={element.svg} strokeWidth={element.strokeWidth ?? 2} /> : (element.glyph || '★');
  }
  if (element.kind === 'counter') {
    const total = design.stampsTotal || 8;
    return design.type === 'Loyalty' ? `${Math.min(design.stamps || 0, total)} / ${total} VISITS` : elementText(design, element) || '01 / 01';
  }
  if (element.kind === 'stampCount') {
    const total = design.stampsTotal || 8;
    return `${Math.min(design.stamps || 0, total)} / ${total} VISITS`;
  }
  if (element.kind === 'stamps') {
    const total = design.stampsTotal || 8;
    const glyph = design.stampIconCustom || stampIcons.find((item) => item.id === design.stampIcon)?.glyph || '✦';
    return <span className="stamp-marks">{Array.from({ length: total }, (_, index) => <i key={index} className={index < design.stamps ? 'filled' : ''}>{glyph}</i>)}</span>;
  }
  return elementText(design, element);
}

export default function CardCanvas({
  design, side = 'front', compact = false, guides = false, interactive = false,
  selection = [], onElementPointerDown, cardRef, editing = null, onEditInput, onEditEnd,
}) {
  const localRef = useRef(null);
  const node = cardRef || localRef;
  const height = useCardHeight(node);
  const geometry = cardGeometry(design);
  const palette = qrPalette(design);
  const elements = elementsForSide(design, side).filter((item) => !item.hidden);
  const cardStyle = {
    '--card-bg': design.color,
    '--card-accent': design.accent,
    '--card-ink': design.ink,
    '--card-font': cssFontFamily(design.font),
    '--card-ratio': geometry.ratio,
    '--card-h': `${height}px`,
    '--safe-x': `${(SAFE_MM / geometry.width) * 100}%`,
    '--safe-y': `${(SAFE_MM / geometry.height) * 100}%`,
  };

  return <div ref={node} className={`card-face ${side}-side ${compact ? 'compact-card' : ''}`} style={cardStyle}>
    {design.image && <div className="card-image" style={{ backgroundImage: `url(${design.image})` }} />}
    <div className="card-grain" />
    {guides && design.showGuides && <div className="safe-zone" aria-hidden="true" />}
    {elements.map((element) => {
      const style = element.style || {};
      const box = {
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.w}%`,
        zIndex: element.z,
        rotate: element.rotation ? `${element.rotation}deg` : undefined,
      };
      if (isTextual(element)) {
        if (style.size) box.fontSize = `calc(var(--card-h) * ${style.size / 100})`;
        if (style.font) box.fontFamily = cssFontFamily(style.font);
        if (style.weight) box.fontWeight = style.weight;
        if (style.color) box.color = style.color;
        if (style.align) box.textAlign = style.align;
        if (style.letterSpacing != null) box.letterSpacing = `${style.letterSpacing}px`;
        if (style.lineHeight) box.lineHeight = style.lineHeight;
      }
      if (element.kind === 'stamps' && style.size) box.fontSize = `calc(var(--card-h) * ${style.size / 100})`;
      if (element.kind === 'image' && element.ratio) box.aspectRatio = element.ratio;
      if (style.color && element.kind === 'shape') box.color = style.color;
      if (element.kind === 'blob') {
        box.background = style.color || 'var(--card-accent)';
        box.borderRadius = `${style.radius ?? 50}%`;
      }
      if (style.opacity != null) box.opacity = style.opacity;
      const isEditing = editing?.id === element.id;
      const common = {
        'data-element': element.id,
        className: `ce ce-${element.kind}${selection.includes(element.id) ? ' is-selected' : ''}${element.locked ? ' is-locked' : ''}${isBoxed(element) ? ' is-boxed' : ''}${isEditing ? ' is-editing' : ''}`,
        style: box,
        onPointerDown: interactive && !element.locked && !isEditing ? (event) => onElementPointerDown?.(element.id, event) : undefined,
      };
      /* Editing happens on the card itself, and the node is deliberately left uncontrolled:
         React renders it with no children and fills it once through the ref. Handing React
         the text instead makes it rewrite the node on the re-render each keystroke causes,
         which wipes what was just typed. The -edit key forces a fresh node per session. */
      if (isEditing) {
        return <div
          key={`${element.id}-edit`}
          {...common}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          ref={(node) => {
            if (!node || node.dataset.ready === '1') return;
            node.dataset.ready = '1';
            node.textContent = editing.text;
            node.focus({ preventScroll: true });
            document.getSelection()?.selectAllChildren(node);
          }}
          onInput={(event) => onEditInput?.(event.currentTarget.textContent)}
          onBlur={() => onEditEnd?.()}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) { event.preventDefault(); event.currentTarget.blur(); }
            event.stopPropagation();
          }}
        />;
      }
      return <div key={element.id} {...common}><ElementBody design={design} element={element} palette={palette} /></div>;
    })}
  </div>;
}
