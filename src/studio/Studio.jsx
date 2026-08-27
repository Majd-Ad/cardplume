import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Icon } from '../ui';
import CardCanvas from './CardCanvas';
import { HANDLES, startMove, startResize, startRotate } from './interactions';
import { captureSides, exportPdf, exportPng } from './exporters';
import { ensureGoogleFonts, googleFonts, installUploadedFonts, systemFonts } from './fonts';
import { cssFontFamily, readFontFile, readImageFile } from './safety';
import { IconArt, loadIconLibrary } from './icons';
import { useAccount } from '../AccountUI';
import {
  BLEED_MM, SAFE_MM, applyTemplate, cardGeometry, cardSizes, colors, defaultElements, elementText, elementsForSide,
  findElement, initialDesign, isBoxed, isDecor, isTextual, kindLabels, labelFor, migrateDesign, newId, stampIcons, templates,
} from './model';

const HISTORY_LIMIT = 50;
const HISTORY_DEBOUNCE = 350;

/* Records design snapshots so a whole drag or slider sweep collapses into one undo step. */
function useDesignHistory(design, setDesign) {
  const past = useRef([]);
  const future = useRef([]);
  const latest = useRef(design);
  const burstStart = useRef(null);
  const timer = useRef(0);
  const restoring = useRef(false);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const sync = useCallback(() => setDepth({ undo: past.current.length, redo: future.current.length }), []);

  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = 0; }
    if (burstStart.current === null) return;
    past.current = [...past.current, burstStart.current].slice(-HISTORY_LIMIT);
    burstStart.current = null;
    future.current = [];
  }, []);

  useEffect(() => {
    if (restoring.current) { restoring.current = false; latest.current = design; return; }
    if (design === latest.current) return;
    if (burstStart.current === null) burstStart.current = latest.current;
    latest.current = design;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = 0; flush(); sync(); }, HISTORY_DEBOUNCE);
  }, [design, flush, sync]);

  const step = useCallback((from, to) => {
    flush();
    if (!from.current.length) { sync(); return false; }
    const target = from === past ? from.current[from.current.length - 1] : from.current[0];
    from.current = from === past ? from.current.slice(0, -1) : from.current.slice(1);
    to.current = to === past ? [...to.current, latest.current].slice(-HISTORY_LIMIT) : [latest.current, ...to.current].slice(0, HISTORY_LIMIT);
    restoring.current = true;
    setDesign(target);
    sync();
    return true;
  }, [flush, setDesign, sync]);

  const undo = useCallback(() => step(past, future), [step]);
  const redo = useCallback(() => step(future, past), [step]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { undo, redo, canUndo: depth.undo > 0, canRedo: depth.redo > 0 };
}

/* The library is fetched on first open, so the panel has three states: loading, a grid, and
   the case where the chunk never arrived. */
function IconPicker({ value, onPick }) {
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadIconLibrary().then((items) => { if (alive) setLibrary(items); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const term = query.trim().toLowerCase();
  const matches = library ? (term ? library.filter((item) => item.label.toLowerCase().includes(term)) : library) : [];
  const visible = matches.slice(0, 120);

  if (failed) return <p className="field-error">The icon set could not be loaded. Check your connection and reopen this panel.</p>;
  return <div className="icon-picker">
    <input
      className="font-search" value={query} onChange={(event) => setQuery(event.target.value)}
      placeholder={library ? `Search ${library.length} icons…` : 'Loading icons…'} aria-label="Search icons"
    />
    <div className="icon-grid">
      {visible.map((item) => <button
        key={item.name} type="button" title={item.label}
        className={value === item.name ? 'selected' : ''}
        onClick={() => onPick(item)}
      ><IconArt nodes={item.nodes} /></button>)}
    </div>
    {library && !matches.length && <p className="font-empty">No icon matches “{query}”.</p>}
    {matches.length > visible.length && <p className="panel-helper">Showing {visible.length} of {matches.length} — keep typing to narrow it down.</p>}
  </div>;
}

function FontPicker({ value, uploaded = [], fallbackLabel, onPick, onUpload, error }) {
  const [query, setQuery] = useState('');
  const uploadRef = useRef(null);
  const uploadedNames = uploaded.map((item) => item.name);
  const all = [...uploadedNames, ...googleFonts, ...systemFonts];
  const term = query.trim().toLowerCase();
  const matches = term ? all.filter((name) => name.toLowerCase().includes(term)) : all;
  /* Only fetch what is on screen — pulling every family at once would be absurd. */
  const visible = matches.slice(0, 40);
  useEffect(() => { ensureGoogleFonts(visible.filter((name) => googleFonts.includes(name))); }, [visible.join('|')]);
  useEffect(() => { if (value) ensureGoogleFonts([value]); }, [value]);

  return <div className="font-picker">
    <input className="font-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${all.length} fonts…`} aria-label="Search fonts" />
    <div className="font-list">
      <button className={value ? '' : 'selected'} onClick={() => onPick('')}>{fallbackLabel}</button>
      {visible.map((name) => <button key={name} className={value === name ? 'selected' : ''} style={{ fontFamily: cssFontFamily(name) }} onClick={() => onPick(name)}>{name}{uploadedNames.includes(name) && <em> uploaded</em>}</button>)}
      {!matches.length && <p className="font-empty">No font matches “{query}”. Upload your own below.</p>}
    </div>
    {matches.length > visible.length && <p className="panel-helper">Showing {visible.length} of {matches.length} — keep typing to narrow it down.</p>}
    <button className="button button-outline wide small-button" onClick={() => uploadRef.current?.click()}>Upload a font</button>
    <input ref={uploadRef} type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={(event) => { onUpload(event.target.files?.[0]); event.target.value = ''; }} />
    {error && <p className="field-error">{error}</p>}
  </div>;
}

/* Preview zoom. Rather than scaling the card with a transform, the card is simply rendered
   wider: everything on it is sized in card-percent, so a bigger card is a real, crisp
   re-layout, and pointer maths keeps working without a single division by the zoom. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const DRAFT_KEY = 'cardplume-draft';
const HANDOFF_KEY = 'cardplume-open-project';

/* The app was called Cardverse until the rename. Anything already in this browser under the
   old key is read once and moved across, so nobody loses the card they had open. */
function readDraft() {
  const current = localStorage.getItem(DRAFT_KEY);
  if (current) return current;
  const legacy = localStorage.getItem('cardverse-draft');
  if (legacy) {
    localStorage.setItem(DRAFT_KEY, legacy);
    localStorage.removeItem('cardverse-draft');
  }
  return legacy;
}

export default function CardStudio({ onToast, onRequireAccount }) {
  const { session, projects, saveProject } = useAccount();
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get('type');
  const appliedType = useRef('');
  const [design, setDesign] = useState(() => {
    try { return migrateDesign(JSON.parse(readDraft()) || {}); } catch { return initialDesign; }
  });
  const [tab, setTab] = useState('Design');
  const [side, setSide] = useState('front');
  const [selection, setSelection] = useState([]);
  const [overlay, setOverlay] = useState(null);
  const [guides, setGuides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [menu, setMenu] = useState(null);
  const [exportSide, setExportSide] = useState('front');
  const [exportFormat, setExportFormat] = useState('png');
  const [exporting, setExporting] = useState(false);
  const [fontError, setFontError] = useState('');
  /* Which saved project this canvas is currently standing in for, so Save updates it rather
     than piling up a new copy every time. */
  const [projectId, setProjectId] = useState(null);
  const [projectTitle, setProjectTitle] = useState('');

  const cardRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const menuRef = useRef(null);
  const clipboardRef = useRef([]);
  const exportRef = useRef(null);
  const designRef = useRef(design);
  const selectionRef = useRef(selection);
  const draggedRef = useRef(false);
  const quotaWarned = useRef(false);
  designRef.current = design;
  selectionRef.current = selection;

  const history = useDesignHistory(design, setDesign);
  const geometry = cardGeometry(design);
  const selected = selection.length === 1 ? findElement(design, selection[0]) : null;
  const stepZoom = (direction) => setZoom((current) => {
    const at = ZOOM_STEPS.findIndex((value) => value > current + 0.001 || Math.abs(value - current) < 0.001);
    const from = at < 0 ? ZOOM_STEPS.length - 1 : at;
    return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, from + direction))];
  });

  useEffect(() => {
    const handoff = sessionStorage.getItem(HANDOFF_KEY);
    if (!handoff) return;
    sessionStorage.removeItem(HANDOFF_KEY);
    try {
      const project = JSON.parse(handoff);
      setDesign(migrateDesign(project.design));
      setProjectId(project.id);
      setProjectTitle(project.title);
    } catch { /* a corrupted hand-off is not worth interrupting the studio over */ }
  }, []);

  useEffect(() => { installUploadedFonts(design.uploadedFonts); }, [design.uploadedFonts]);

  /* Ctrl/Cmd + wheel zooms the stage, the way every design tool does. Non-passive because
     the browser's own page zoom has to be prevented. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => Math.min(3, Math.max(0.4, Math.round((current - event.deltaY * 0.0018) * 100) / 100)));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => {
    ensureGoogleFonts([design.font, ...(design.elements || []).map((item) => item.style?.font)], design.uploadedFonts);
  }, [design.font, design.elements, design.uploadedFonts]);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(design)); quotaWarned.current = false; } catch {
      /* Uploaded images and fonts can push the draft past the browser's storage limit.
         Say so once instead of letting auto-save fail in silence. */
      if (!quotaWarned.current) { quotaWarned.current = true; onToast('Auto-save stopped: this design is too large for browser storage.'); }
    }
  }, [design, onToast]);

  useEffect(() => {
    if (requestedType !== 'loyalty' || appliedType.current === requestedType) return;
    setDesign((current) => applyTemplate(current, templates.find((item) => item.id === 'coffee')));
    setTab('Text');
    appliedType.current = requestedType;
  }, [requestedType]);

  /* ---- element operations -------------------------------------------------- */

  const patchElements = useCallback((patch) => setDesign((current) => ({
    ...current,
    elements: current.elements.map((item) => (patch[item.id] ? { ...item, ...patch[item.id] } : item)),
  })), []);

  const updateElement = useCallback((id, patch) => patchElements({ [id]: patch }), [patchElements]);
  const updateStyle = (id, patch) => {
    const element = findElement(designRef.current, id);
    const style = { ...(element?.style || {}), ...patch };
    Object.keys(patch).forEach((key) => { if (patch[key] === '' || patch[key] == null) delete style[key]; });
    updateElement(id, { style });
  };

  const addElement = (kind, extra = {}) => {
    const id = newId();
    const count = design.elements.length;
    const seed = {
      text: { text: 'New text', w: 40, style: { size: 6, font: design.font, weight: 500 } },
      icon: { glyph: '★', w: 12, style: { size: 9 } },
      qr: { w: 18 },
      image: { w: 24 },
      shape: { w: 22 },
      blob: { w: 26, style: { opacity: 0.9 } },
    }[kind] || {};
    const element = {
      id, kind, side, rotation: 0, hidden: false, locked: false,
      x: 8 + (count % 5) * 3, y: 30 + (count % 5) * 4,
      z: Math.max(0, ...design.elements.map((item) => item.z || 0)) + 1,
      style: {}, ...seed, ...extra,
    };
    setDesign((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelection([id]);
    setTab('Text');
    onToast(`${kindLabels[kind]} added.`);
  };

  const removeElements = (ids) => {
    setDesign((current) => ({ ...current, elements: current.elements.filter((item) => !ids.includes(item.id)) }));
    setSelection([]);
    setEditing(null);
    onToast(ids.length > 1 ? `${ids.length} elements deleted.` : 'Element deleted.');
  };

  /* An in-app clipboard rather than the system one: elements are objects, and the system
     clipboard would only carry their text. */
  const copyElements = (ids) => {
    const picked = design.elements.filter((item) => ids.includes(item.id));
    if (!picked.length) return;
    clipboardRef.current = picked.map(({ id, ...rest }) => rest);
    onToast(picked.length > 1 ? `${picked.length} elements copied.` : 'Copied.');
  };

  const pasteElements = () => {
    const stash = clipboardRef.current;
    if (!stash.length) { onToast('Nothing to paste yet.'); return; }
    const top = Math.max(0, ...design.elements.map((item) => item.z || 0));
    /* Pasted onto whichever side is showing, nudged so the copy is visible under the original. */
    const copies = stash.map((item, index) => ({ ...item, id: newId(), side, x: item.x + 3, y: item.y + 3, z: top + index + 1 }));
    setDesign((current) => ({ ...current, elements: [...current.elements, ...copies] }));
    setSelection(copies.map((item) => item.id));
    setTab('Text');
    onToast(copies.length > 1 ? `${copies.length} elements pasted.` : 'Pasted.');
  };

  const duplicateElements = (ids) => {
    const copies = design.elements.filter((item) => ids.includes(item.id)).map((item, index) => ({
      ...item, id: newId(), x: item.x + 3, y: item.y + 3,
      z: Math.max(0, ...design.elements.map((e) => e.z || 0)) + index + 1,
    }));
    setDesign((current) => ({ ...current, elements: [...current.elements, ...copies] }));
    setSelection(copies.map((item) => item.id));
    onToast('Duplicated.');
  };

  /* Re-stack one side from a list that is already in the order we want. Only that side is
     renumbered: front and back are separate stacking contexts, so their z values never meet. */
  const restack = (current, side, order) => {
    const base = Math.min(...order.map((item) => item.z || 0));
    const zMap = Object.fromEntries(order.map((item, position) => [item.id, base + position]));
    return { ...current, elements: current.elements.map((item) => (zMap[item.id] != null ? { ...item, z: zMap[item.id] } : item)) };
  };

  /* Step one place up or down among the elements on the same side. Ordering the whole design
     instead used to swap a front element with an invisible back-side one, so "bring forward"
     would renumber everything and change nothing you could see. */
  const reorder = (id, direction) => setDesign((current) => {
    const element = current.elements.find((item) => item.id === id);
    if (!element) return current;
    const siblings = elementsForSide(current, element.side);
    const index = siblings.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return current;
    const order = [...siblings];
    [order[index], order[target]] = [order[target], order[index]];
    return restack(current, element.side, order);
  });

  const sendToEdge = (id, edge) => setDesign((current) => {
    const element = current.elements.find((item) => item.id === id);
    if (!element) return current;
    const siblings = elementsForSide(current, element.side);
    const rest = siblings.filter((item) => item.id !== id);
    return restack(current, element.side, edge === 'front' ? [...rest, element] : [element, ...rest]);
  });

  /* ---- selection overlay --------------------------------------------------- */

  const nodesFor = useCallback(() => {
    const map = new Map();
    cardRef.current?.querySelectorAll('[data-element]').forEach((node) => map.set(node.dataset.element, node));
    return map;
  }, []);

  const measureOverlay = useCallback(() => {
    const card = cardRef.current;
    const canvas = canvasRef.current;
    if (!card || !canvas || !selectionRef.current.length) { setOverlay(null); return; }
    /* Measured against the card box, not the stage: the stage scrolls and re-centres as the
       zoom changes, the card box does not. */
    const cardBox = canvas.getBoundingClientRect();
    const nodes = selectionRef.current.map((id) => card.querySelector(`[data-element="${CSS.escape(id)}"]`)).filter(Boolean);
    if (!nodes.length) { setOverlay(null); return; }
    if (nodes.length === 1) {
      const element = findElement(designRef.current, selectionRef.current[0]);
      const node = nodes[0];
      /* Read the un-rotated box so handles sit on the element's own axes. */
      const rotation = element?.rotation || 0;
      const previous = node.style.rotate;
      node.style.rotate = '0deg';
      const rect = node.getBoundingClientRect();
      node.style.rotate = previous;
      setOverlay({
        x: rect.left - cardBox.left, y: rect.top - cardBox.top,
        w: rect.width, h: rect.height, rotation, single: true,
      });
      return;
    }
    const boxes = nodes.map((node) => node.getBoundingClientRect());
    const left = Math.min(...boxes.map((r) => r.left));
    const top = Math.min(...boxes.map((r) => r.top));
    setOverlay({
      x: left - cardBox.left, y: top - cardBox.top,
      w: Math.max(...boxes.map((r) => r.right)) - left,
      h: Math.max(...boxes.map((r) => r.bottom)) - top,
      rotation: 0, single: false,
    });
  }, []);

  useLayoutEffect(() => { measureOverlay(); }, [design, selection, side, zoom, measureOverlay]);
  useEffect(() => {
    const onResize = () => measureOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureOverlay]);

  const cardRect = () => {
    const rect = cardRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  };

  const onElementPointerDown = (id, event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const next = additive
      ? (selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id])
      : (selection.includes(id) ? selection : [id]);
    setSelection(next);
    if (!next.length) return;
    /* Clicking something on the card brings its controls up on the left, so the panel is
       always showing whatever the eye is on. */
    setTab('Text');
    draggedRef.current = false;
    const card = cardRect();
    if (!card) return;
    startMove({
      ids: next, design: designRef.current, card, nodes: nodesFor(), event,
      commit: patchElements, onGuides: setGuides,
      onEnd: (moved) => { draggedRef.current = moved; if (!moved) startEditing(id); },
    });
  };

  const onContextMenu = (event) => {
    /* preventDefault first and unconditionally: without it the browser's own menu opens on
       top of ours, which is exactly what happens over a text element being edited. */
    event.preventDefault();
    const node = event.target.closest('[data-element]');
    let ids = selectionRef.current;
    if (node) {
      if (!ids.includes(node.dataset.element)) { ids = [node.dataset.element]; setSelection(ids); setTab('Text'); }
    } else { ids = []; setSelection([]); }
    setEditing(null);
    setMenu({ x: event.clientX, y: event.clientY, ids });
  };

  /* Bound to the node itself rather than through React's delegated handler: a right-click
     inside the contentEditable being edited never has to reach the root for us to stop the
     browser menu. Re-registered each render so the closure stays current. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    stage.addEventListener('contextmenu', onContextMenu);
    return () => stage.removeEventListener('contextmenu', onContextMenu);
  });

  /* Nudge the menu back inside the window if it opened near an edge. */
  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node || !menu) return;
    const rect = node.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8));
    const y = Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8));
    if (x !== menu.x || y !== menu.y) setMenu((current) => (current ? { ...current, x, y } : current));
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!event?.target?.closest?.('.context-menu')) setMenu(null); };
    document.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const runMenu = (action) => { action(); setMenu(null); };
  const menuTarget = menu?.ids.length === 1 ? findElement(design, menu.ids[0]) : null;

  const onHandlePointerDown = (handle, event) => {
    event.stopPropagation();
    const card = cardRect();
    const id = selection[0];
    if (!card || !id) return;
    const node = cardRef.current?.querySelector(`[data-element="${CSS.escape(id)}"]`);
    draggedRef.current = true;
    if (handle === 'rotate') startRotate({ id, design: designRef.current, card, node, event, commit: patchElements });
    else startResize({ id, handle, design: designRef.current, card, node, event, commit: patchElements });
  };

  /* Editing is done on the card, in place. Only free text and icons are editable that way:
     a counter or a stamp row is generated, so it is driven from the panel instead. */
  const startEditing = (id) => {
    const element = findElement(designRef.current, id);
    /* A picked icon is vector art, not a character, so there is nothing to type into it. */
    if (!element || !isTextual(element) || element.kind === 'stampCount' || element.kind === 'counter' || element.svg?.length) { setEditing(null); return; }
    const value = element.kind === 'icon' ? element.glyph ?? '' : elementText(designRef.current, element);
    setEditing({ id, text: String(value) });
  };

  const onEditInput = (value) => {
    const element = findElement(designRef.current, editing.id);
    if (!element) return;
    const text = element.uppercase ? value.toUpperCase() : value;
    if (element.kind === 'icon') updateElement(element.id, { glyph: value });
    else if (element.bind) setDesign((current) => ({ ...current, [element.bind]: text }));
    else updateElement(element.id, { text });
  };

  /* Clicking bare card deselects; clicking outside the card closes the inline editor. */
  useEffect(() => {
    const onClick = (event) => {
      if (draggedRef.current) { draggedRef.current = false; return; }
      if (event.target.closest('.selection-overlay') || event.target.closest('.layer-editor')) return;
      if (event.target.closest('.studio-preview .card-face')) {
        if (!event.target.closest('[data-element]')) { setSelection([]); setEditing(null); }
        return;
      }
      if (!event.target.closest('.studio-controls')) setEditing(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  /* Arrow keys nudge, Delete removes, Ctrl+D duplicates. */
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      const ids = selectionRef.current;
      if (event.key === 'Escape') { setMenu(null); setSelection([]); setEditing(null); return; }
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0') setZoom(1); else stepZoom(event.key === '-' || event.key === '_' ? -1 : 1);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'c' && ids.length) { event.preventDefault(); copyElements(ids); return; }
        if (key === 'x' && ids.length) { event.preventDefault(); copyElements(ids); removeElements(ids); return; }
        if (key === 'v') { event.preventDefault(); pasteElements(); return; }
      }
      if (!ids.length) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeElements(ids); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateElements(ids); return; }
      if (!event.key.startsWith('Arrow')) return;
      const step = event.shiftKey ? 2 : 0.4;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!delta) return;
      event.preventDefault();
      const patch = {};
      for (const id of ids) {
        const element = findElement(designRef.current, id);
        if (element) patch[id] = { x: Math.round((element.x + delta[0]) * 100) / 100, y: Math.round((element.y + delta[1]) * 100) / 100 };
      }
      patchElements(patch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { setSelection([]); setEditing(null); }, [side]);

  /* ---- studio actions ------------------------------------------------------ */

  const update = (key, value) => setDesign((current) => ({ ...current, [key]: value }));
  const openProject = (project) => {
    setDesign(migrateDesign(project.design));
    setProjectId(project.id);
    setProjectTitle(project.title);
    setSelection([]);
    setEditing(null);
    onToast(`Opened “${project.title}”.`);
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!session) { onToast('Sign in — or continue as a guest — to save projects.'); onRequireAccount?.(); return; }
    if (saving) return;
    setSaving(true);
    try {
      const existing = projectId;
      const id = await saveProject(design, { id: existing, title: projectTitle });
      setProjectId(id);
      onToast(session.guest
        ? 'Saved for this session. A guest’s work clears when the tab closes.'
        : existing ? 'Project updated.' : 'Project saved to your account.');
    } catch (problem) {
      onToast(problem.message);
    } finally {
      setSaving(false);
    }
  };
  const reset = () => { setDesign(initialDesign); setTab('Design'); setSide('front'); setSelection([]); onToast('Design reset.'); };
  const resetLayout = () => {
    setDesign((current) => {
      const fresh = defaultElements(current.type);
      const stock = new Set(fresh.map((item) => item.id));
      return { ...current, elements: [...fresh, ...current.elements.filter((item) => !stock.has(item.id))] };
    });
    onToast('Layout reset.');
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); onToast('Studio link copied.'); }
    catch { onToast('Copy this page URL to share your studio.'); }
  };

  /* Signature, decode and pixel-count checks all live in safety.js. The old version trusted
     file.type, which is derived from the extension and therefore says whatever the file is
     named, and never decoded a background image at all. */
  const uploadFile = async (file, kind) => {
    if (!file) return;
    try {
      const image = await readImageFile(file);
      if (kind === 'background') { update('image', image.src); return; }
      addElement('image', { src: image.src, name: String(file.name).slice(0, 40), ratio: image.width / image.height });
    } catch (error) {
      onToast(error.message);
    }
  };

  const uploadFont = async (file) => {
    if (!file) return;
    try {
      const font = await readFontFile(file);
      setFontError('');
      setDesign((current) => ({
        ...current,
        uploadedFonts: [...(current.uploadedFonts || []).filter((item) => item.name !== font.name), font],
      }));
      if (selected) updateStyle(selected.id, { font: font.name }); else update('font', font.name);
    } catch (error) {
      setFontError(error.message);
    }
  };

  const runExport = async () => {
    if (exporting) return;
    setExporting(true);
    const sides = exportSide === 'both' ? ['front', 'back'] : [exportSide];
    const name = (design.type === 'Loyalty' ? design.brand : design.name || 'cardplume').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cardplume';
    try {
      const shots = await captureSides(exportRef.current, sides);
      if (exportFormat === 'pdf') {
        await exportPdf(shots, name, geometry);
        onToast(`Print-ready PDF exported — ${shots.length} page${shots.length > 1 ? 's' : ''}, ${BLEED_MM} mm bleed.`);
      } else {
        const done = await exportPng(shots, name);
        onToast(done > 1 ? `Exported ${done} files, one per side.` : `${sides[0] === 'front' ? 'Front' : 'Back'} exported.`);
      }
    } catch (error) {
      onToast(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [{ name: 'Design', icon: 'palette' }, { name: 'Text', icon: 'type' }, { name: 'Image', icon: 'image' }, { name: 'Details', icon: 'qr' }];
  const visibleElements = design.elements.filter((item) => item.side === side)
    .filter((item) => (design.type === 'Loyalty' ? item.id !== 'shape' : !['stamps', 'stampCount'].includes(item.id)))
    .sort((a, b) => (b.z || 0) - (a.z || 0));

  const panels = {
    Design: <DesignPanel design={design} setDesign={setDesign} update={update} />,
    Text: <ElementsPanel
      design={design} elements={visibleElements} selection={selection} setSelection={setSelection}
      selected={selected} update={update} updateElement={updateElement} updateStyle={updateStyle}
      addElement={addElement} removeElements={removeElements} duplicateElements={duplicateElements}
      reorder={reorder} resetLayout={resetLayout} uploadFile={uploadFile} uploadFont={uploadFont} fontError={fontError}
    />,
    Image: <ImagePanel design={design} update={update} uploadFile={uploadFile} />,
    Details: <DetailsPanel design={design} update={update} />,
  };

  return <section className="studio-section" id="studio"><div className="studio-shell">
    <div className="studio-app">
      <aside className="studio-sidebar">
        <div className="studio-sidebar-top">
          <span className="tiny-caps">CARDPLUME STUDIO</span>
          <div className="editor-tabs" role="tablist">{tabs.map((item) => <button key={item.name} role="tab" aria-selected={tab === item.name} className={tab === item.name ? 'active' : ''} onClick={() => setTab(item.name)}><Icon name={item.icon} size={18} /><span>{item.name}</span></button>)}</div>
        </div>
        <div className="save-status"><span className="status-dot" />Auto-saved locally</div>
      </aside>
      <div className="studio-controls">
        <div className="control-mobile-tabs">{tabs.map((item) => <button key={item.name} className={tab === item.name ? 'active' : ''} onClick={() => setTab(item.name)}>{item.name}</button>)}</div>
        {panels[tab]}
      </div>
      <div className="studio-preview">
        <div className="preview-header">
          <span>LIVE PREVIEW</span>
          <div className="zoom-row">
            <button onClick={() => stepZoom(-1)} title="Zoom out (Ctrl -)" aria-label="Zoom out"><Icon name="minus" size={13} /></button>
            <button className="zoom-value" onClick={() => setZoom(1)} title="Reset to 100% (Ctrl 0)">{Math.round(zoom * 100)}%</button>
            <button onClick={() => stepZoom(1)} title="Zoom in (Ctrl +)" aria-label="Zoom in"><Icon name="plus" size={13} /></button>
          </div>
          <div>
            <button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}>Front</button>
            <button className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}>Back</button>
          </div>
        </div>
        <div className="preview-stage" ref={stageRef}>
          <div className="preview-canvas" ref={canvasRef} style={{ '--zoom': zoom, '--ratio': geometry.ratio }}>
            <CardCanvas design={design} side={side} guides interactive cardRef={cardRef} selection={selection} onElementPointerDown={onElementPointerDown} editing={editing} onEditInput={onEditInput} onEditEnd={() => setEditing(null)} />
            {guides.map((guide, index) => <div key={index} className={`snap-guide snap-${guide.axis}`} style={guide.axis === 'x' ? { left: `${guide.at}%` } : { top: `${guide.at}%` }} />)}
            {overlay && <div className="selection-overlay" style={{ left: overlay.x, top: overlay.y, width: overlay.w, height: overlay.h, rotate: `${overlay.rotation}deg` }}>
              {overlay.single && !selected?.locked && <>
                <button className="handle handle-rotate" onPointerDown={(event) => onHandlePointerDown('rotate', event)} aria-label="Rotate"><Icon name="rotate" size={12} /></button>
                {HANDLES.map((handle) => <button key={handle} className={`handle handle-${handle}`} onPointerDown={(event) => onHandlePointerDown(handle, event)} aria-label={`Resize ${handle}`} />)}
              </>}
            </div>}
          </div>
        </div>
        <div className="preview-footer">
          <div>
            <button onClick={() => { if (!history.undo()) onToast('Nothing left to undo.'); }} disabled={!history.canUndo} className="action-link" title="Undo (Ctrl+Z)"><Icon name="undo" size={15} />Undo</button>
            <button onClick={() => { if (!history.redo()) onToast('Nothing left to redo.'); }} disabled={!history.canRedo} className="action-link" title="Redo (Ctrl+Shift+Z)"><Icon name="redo" size={15} />Redo</button>
            <button onClick={reset} className="action-link"><Icon name="refresh" size={15} />Reset</button>
          </div>
          <div>
            <button onClick={share} className="action-link">Share</button>
            <select className="export-side" value={exportSide} onChange={(event) => setExportSide(event.target.value)} aria-label="Which side to export"><option value="front">Front</option><option value="back">Back</option><option value="both">Both sides</option></select>
            <select className="export-side" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} aria-label="Export format"><option value="png">PNG</option><option value="pdf">PDF (print)</option></select>
            <Button className="small-button" icon="download" onClick={runExport}>{exporting ? 'Exporting…' : 'Export'}</Button>
          </div>
        </div>
      </div>
      <div className="export-stage" ref={exportRef} aria-hidden="true">
        <div data-export-side="front"><CardCanvas design={design} side="front" /></div>
        <div data-export-side="back"><CardCanvas design={design} side="back" /></div>
      </div>
    </div>
    <div className="saved-designs">
      <div>
        <span className="tiny-caps">{!session ? 'NOT SIGNED IN' : session.guest ? 'GUEST — CLEARS WITH THE TAB' : 'YOUR PROJECTS'}</span>
        <strong>{session
          ? `${projects.length} project${projects.length === 1 ? '' : 's'}${projectTitle ? ` · editing “${projectTitle}”` : ''}`
          : 'Sign in to keep your work'}</strong>
      </div>
      <div className="saved-cards">{projects.slice(0, 3).map((project) => <button key={project.id} onClick={() => openProject(project)} title={`Open “${project.title}”`}>
        <CardCanvas design={migrateDesign(project.design)} compact /><span>{project.title}</span>
      </button>)}</div>
      <Button className="button-soft small-button" icon="save" onClick={save} disabled={saving}>{saving ? 'Saving…' : (projectId ? 'Save changes' : 'Save project')}</Button>
    </div>
    {menu && <div className="context-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }} role="menu">
      {menu.ids.length > 0 && <>
        <button onClick={() => runMenu(() => duplicateElements(menu.ids))}><Icon name="copy" size={13} />Duplicate<kbd>Ctrl D</kbd></button>
        <button onClick={() => runMenu(() => copyElements(menu.ids))}><Icon name="copy" size={13} />Copy<kbd>Ctrl C</kbd></button>
      </>}
      <button disabled={!clipboardRef.current.length} onClick={() => runMenu(pasteElements)}><Icon name="paste" size={13} />Paste<kbd>Ctrl V</kbd></button>
      {menuTarget && <>
        <hr />
        <button onClick={() => runMenu(() => sendToEdge(menuTarget.id, 'front'))}><Icon name="up" size={13} />Bring to front</button>
        <button onClick={() => runMenu(() => reorder(menuTarget.id, 1))}><Icon name="up" size={13} />Bring forward</button>
        <button onClick={() => runMenu(() => reorder(menuTarget.id, -1))}><Icon name="down" size={13} />Send backward</button>
        <button onClick={() => runMenu(() => sendToEdge(menuTarget.id, 'back'))}><Icon name="down" size={13} />Send to back</button>
        <button onClick={() => runMenu(() => updateElement(menuTarget.id, { locked: !menuTarget.locked }))}><Icon name={menuTarget.locked ? 'unlock' : 'lock'} size={13} />{menuTarget.locked ? 'Unlock' : 'Lock'}</button>
        <button onClick={() => runMenu(() => updateElement(menuTarget.id, { hidden: true }))}><Icon name="eyeOff" size={13} />Hide</button>
      </>}
      {menu.ids.length > 0 && <>
        <hr />
        <button className="danger" onClick={() => runMenu(() => removeElements(menu.ids))}><Icon name="trash" size={13} />Delete<kbd>Del</kbd></button>
      </>}
    </div>}
  </div></section>;
}

/* ---- panels ---------------------------------------------------------------- */

function DesignPanel({ design, setDesign, update }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? templates : templates.slice(0, 5);
  const updateHex = (key, value) => {
    const hex = value.startsWith('#') ? value : `#${value}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) update(key, hex);
  };
  return <div className="control-stack">
    <div>
      <div className="control-heading"><span>Start with a template</span><button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : 'See all'}</button></div>
      <div className="template-grid">{visible.map((template) => <button className={`template-tile ${design.template === template.id ? 'selected' : ''}`} onClick={() => setDesign((current) => applyTemplate(current, template))} key={template.id}>
        <span className="template-preview" style={{ background: template.color, color: colors.find((item) => item.value === template.color)?.ink ?? '#17221d' }}><i style={{ background: template.accent }} /><b>{template.blank ? 'Start empty' : template.type === 'Loyalty' ? `${template.stampsTotal} stamps` : 'Name'}</b></span>
        <strong>{template.label}</strong><small>{template.type}</small>
      </button>)}</div>
    </div>
    <div>
      <div className="control-heading"><span>Print size</span><label className="guide-toggle"><input type="checkbox" checked={!!design.showGuides} onChange={(event) => update('showGuides', event.target.checked)} />Guides</label></div>
      <div className="size-grid">{cardSizes.map((size) => <button key={size.id} className={(design.cardSize || 'eu') === size.id ? 'selected' : ''} onClick={() => update('cardSize', size.id)}><strong>{size.label}</strong><small>{size.detail}</small></button>)}</div>
      <div className="choice-row orientation-row">{['landscape', 'portrait'].map((option) => <button key={option} className={(design.orientation || 'landscape') === option ? 'selected' : ''} onClick={() => update('orientation', option)}>{option}</button>)}</div>
      <p className="panel-helper">Exports add {BLEED_MM} mm bleed and crop marks. Guides show the {SAFE_MM} mm safe area.</p>
    </div>
    <div>
      <div className="control-heading"><span>Colour story</span></div>
      <div className="color-row">{colors.map((color) => <button aria-label={color.name} className={`color-swatch ${design.color === color.value ? 'selected' : ''}`} key={color.value} style={{ background: color.value }} onClick={() => setDesign((current) => ({ ...current, color: color.value, ink: color.ink }))}>{design.color === color.value && <Icon name="check" size={14} />}</button>)}</div>
      <div className="hex-color-field"><input aria-label="Card colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(design.color) ? design.color : '#d9fb8f'} onChange={(event) => updateHex('color', event.target.value)} /><input aria-label="Card colour value" value={design.color} maxLength="7" onChange={(event) => updateHex('color', event.target.value)} /></div>
    </div>
    <div>
      <div className="control-heading"><span>Accent colour</span></div>
      <div className="hex-color-field"><input aria-label="Accent colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(design.accent) ? design.accent : '#ff7947'} onChange={(event) => updateHex('accent', event.target.value)} /><input aria-label="Accent colour value" value={design.accent} maxLength="7" onChange={(event) => updateHex('accent', event.target.value)} /></div>
    </div>
    <div>
      <div className="control-heading"><span>Finish</span></div>
      <div className="choice-row finish-choice">{['Soft-touch', 'Matte', 'Gloss'].map((finish) => <button key={finish} className={design.finish === finish ? 'selected' : ''} onClick={() => update('finish', finish)}>{finish}</button>)}</div>
    </div>
  </div>;
}

function ElementsPanel({ design, elements, selection, setSelection, selected, update, updateElement, updateStyle, addElement, removeElements, duplicateElements, reorder, resetLayout, uploadFile, uploadFont, fontError }) {
  const imageRef = useRef(null);
  const style = selected?.style || {};
  const loyalty = design.type === 'Loyalty';
  const updateTotal = (value) => {
    const total = Math.max(1, Math.min(12, Number(value) || 1));
    update('stampsTotal', total);
    if (design.stamps > total) update('stamps', total);
    if (/free coffee after \d+ visits/i.test(design.reward)) update('reward', `Free coffee after ${total} visits`);
  };

  return <div className="control-stack text-controls">
    <div>
      <div className="control-heading"><span>Add to this side</span><button className="text-button" onClick={resetLayout}>Reset layout</button></div>
      <div className="add-row">
        <button onClick={() => addElement('text')}><Icon name="type" size={14} />Text</button>
        <button onClick={() => addElement('icon')}><Icon name="spark" size={14} />Icon</button>
        <button onClick={() => addElement('qr')}><Icon name="qr" size={14} />QR</button>
        <button onClick={() => imageRef.current?.click()}><Icon name="image" size={14} />Image</button>
        <button onClick={() => addElement('shape')}><Icon name="shape" size={14} />Shape</button>
        <button onClick={() => addElement('blob')}><Icon name="circle" size={14} />Circle</button>
      </div>
      <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => { uploadFile(event.target.files?.[0], 'element'); event.target.value = ''; }} />
    </div>

    <div>
      <div className="control-heading"><span>Elements</span><span className="tiny-caps">{elements.length}</span></div>
      <div className="layer-list">{elements.map((element) => <div key={element.id} className={`layer-row${selection.includes(element.id) ? ' is-selected' : ''}${element.hidden ? ' is-hidden' : ''}`}>
        <button className="layer-name" onClick={() => setSelection([element.id])}>{labelFor(design, element)}</button>
        <button className="layer-toggle" onClick={() => reorder(element.id, 1)} title="Bring forward"><Icon name="up" size={13} /></button>
        <button className="layer-toggle" onClick={() => reorder(element.id, -1)} title="Send backward"><Icon name="down" size={13} /></button>
        <button className="layer-toggle" onClick={() => updateElement(element.id, { locked: !element.locked })} title={element.locked ? 'Unlock' : 'Lock'}><Icon name={element.locked ? 'lock' : 'unlock'} size={13} /></button>
        <button className="layer-toggle" onClick={() => updateElement(element.id, { hidden: !element.hidden })} title={element.hidden ? 'Show' : 'Hide'}><Icon name={element.hidden ? 'eyeOff' : 'eye'} size={13} /></button>
      </div>)}</div>
      {selection.length > 1 && <div className="add-row"><button onClick={() => duplicateElements(selection)}><Icon name="copy" size={14} />Duplicate {selection.length}</button><button onClick={() => removeElements(selection)}><Icon name="trash" size={14} />Delete {selection.length}</button></div>}
    </div>

    {selected && <>
      <div className="control-heading style-heading"><span>{labelFor(design, selected)}</span>
        <span className="row-actions">
          <button className="layer-toggle" onClick={() => duplicateElements([selected.id])} title="Duplicate (Ctrl+D)"><Icon name="copy" size={13} /></button>
          <button className="layer-toggle" onClick={() => removeElements([selected.id])} title="Delete"><Icon name="trash" size={13} /></button>
        </span>
      </div>

      {selected.kind === 'text' && !selected.bind && <div className="form-field"><label>Text</label><input value={selected.text ?? ''} onChange={(event) => updateElement(selected.id, { text: event.target.value })} /></div>}
      {selected.kind === 'text' && selected.bind && <div className="form-field"><label>{selected.bind}</label><input value={design[selected.bind] ?? ''} onChange={(event) => update(selected.bind, event.target.value)} /></div>}
      {selected.kind === 'icon' && <>
        <div className="form-field"><label>Icon</label><IconPicker value={selected.icon} onPick={(item) => updateElement(selected.id, { icon: item.name, svg: item.nodes, glyph: '' })} /></div>
        <div className="form-field"><label>Or type a character</label>
          <input value={selected.glyph ?? ''} placeholder="★ or any emoji" onChange={(event) => updateElement(selected.id, { glyph: event.target.value, svg: null, icon: '' })} />
          <div className="glyph-row">{stampIcons.map((item) => <button key={item.id} className={!selected.svg?.length && selected.glyph === item.glyph ? 'selected' : ''} onClick={() => updateElement(selected.id, { glyph: item.glyph, svg: null, icon: '' })}>{item.glyph}</button>)}</div>
        </div>
        {selected.svg?.length > 0 && <div className="form-field"><label>Line weight <span>{selected.strokeWidth ?? 2}</span></label><input type="range" min="0.5" max="3" step="0.25" value={selected.strokeWidth ?? 2} onChange={(event) => updateElement(selected.id, { strokeWidth: Number(event.target.value) })} /></div>}
      </>}
      {selected.kind === 'qr' && <div className="form-field"><label>QR links to</label><input value={selected.value ?? ''} placeholder={design.qrValue || design.website} onChange={(event) => updateElement(selected.id, { value: event.target.value })} /></div>}

      <div className="form-field"><label>Width <span>{Math.round(selected.w)}%</span></label><input type="range" min="3" max="100" step="0.5" value={selected.w} onChange={(event) => updateElement(selected.id, { w: Number(event.target.value) })} /></div>
      <div className="form-field"><label>Rotation <span>{selected.rotation || 0}°</span></label><input type="range" min="-180" max="180" value={selected.rotation || 0} onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })} /></div>
      {selected.kind === 'blob' && <div className="form-field"><label>Roundness <span>{style.radius ?? 50}%</span></label><input type="range" min="0" max="50" value={style.radius ?? 50} onChange={(event) => updateStyle(selected.id, { radius: Number(event.target.value) })} /></div>}

      {(isTextual(selected) || selected.kind === 'stamps') && <>
        <div className="form-field"><label>Size <span>{(style.size || 0).toFixed(1)}</span></label><input type="range" min="1" max="30" step="0.1" value={style.size || 4} onChange={(event) => updateStyle(selected.id, { size: Number(event.target.value) })} /></div>
        <div className="form-field"><label>Font</label><FontPicker value={style.font || ''} uploaded={design.uploadedFonts} fallbackLabel={`Card default (${design.font})`} onPick={(name) => updateStyle(selected.id, { font: name })} onUpload={uploadFont} error={fontError} /></div>
        <div className="form-field"><label>Weight</label><div className="choice-row">{[400, 500, 600, 700].map((weight) => <button key={weight} className={style.weight === weight ? 'selected' : ''} onClick={() => updateStyle(selected.id, { weight: style.weight === weight ? '' : weight })}>{weight}</button>)}</div></div>
        <div className="form-field"><label>Align</label><div className="choice-row">{['left', 'center', 'right'].map((align) => <button key={align} className={(style.align || 'left') === align ? 'selected' : ''} onClick={() => updateStyle(selected.id, { align })}>{align}</button>)}</div></div>
        <div className="form-field"><label>Letter spacing <span>{style.letterSpacing ?? 0}px</span></label><input type="range" min="-4" max="12" step="0.5" value={style.letterSpacing ?? 0} onChange={(event) => updateStyle(selected.id, { letterSpacing: Number(event.target.value) || '' })} /></div>
        {/* What a long name should cost: its type size, or the line below it. Stock elements
            shrink, because the layout around them was drawn for one line. */}
        {isTextual(selected) && <div className="form-field"><label>Text too long</label><div className="choice-row fit-choice">
          <button className={selected.fit ? 'selected' : ''} onClick={() => updateElement(selected.id, { fit: true })}>Shrink to fit</button>
          <button className={selected.fit ? '' : 'selected'} onClick={() => updateElement(selected.id, { fit: false })}>Wrap</button>
        </div></div>}
      </>}

      {!isBoxed(selected) || isDecor(selected) ? <div className="form-field"><label>Colour</label><div className="hex-color-field"><input aria-label="Element colour" type="color" value={style.color || design.ink} onChange={(event) => updateStyle(selected.id, { color: event.target.value })} /><input aria-label="Element colour value" value={style.color || ''} placeholder="Card default" maxLength="7" onChange={(event) => updateStyle(selected.id, { color: event.target.value === '' ? '' : (/^#[0-9a-fA-F]{6}$/.test(event.target.value) ? event.target.value : style.color) })} /></div></div> : null}
      <div className="form-field"><label>Opacity <span>{Math.round((style.opacity ?? 1) * 100)}%</span></label><input type="range" min="0.1" max="1" step="0.05" value={style.opacity ?? 1} onChange={(event) => updateStyle(selected.id, { opacity: Number(event.target.value) })} /></div>
    </>}

    {!selected && loyalty && <>
      <div className="form-field"><label>Visits to reward</label><input type="number" min="1" max="12" value={design.stampsTotal} onChange={(event) => updateTotal(event.target.value)} /></div>
      <div className="form-field"><label>Stamp icon</label><select value={design.stampIcon} onChange={(event) => update('stampIcon', event.target.value)}>{stampIcons.map((item) => <option key={item.id} value={item.id}>{item.glyph} {item.label}</option>)}</select><input value={design.stampIconCustom || ''} maxLength="2" onChange={(event) => update('stampIconCustom', event.target.value)} placeholder="Or type a symbol" /></div>
      <div className="form-field"><label>Collected stamps <span>{Math.min(design.stamps, design.stampsTotal)}/{design.stampsTotal}</span></label><input type="range" min="0" max={design.stampsTotal} value={Math.min(design.stamps, design.stampsTotal)} onChange={(event) => update('stamps', Number(event.target.value))} /></div>
    </>}

    {!selected && <div className="form-field"><label>Card typeface <span>elements without their own font</span></label><FontPicker value={design.font} uploaded={design.uploadedFonts} fallbackLabel="Space Grotesk" onPick={(name) => update('font', name || 'Space Grotesk')} onUpload={uploadFont} error={fontError} /></div>}
    {!selected && <p className="panel-helper">Click an element on the card to style it. Arrow keys nudge, Shift+arrows move faster, Delete removes, Ctrl+D duplicates.</p>}
  </div>;
}

function ImagePanel({ design, update, uploadFile }) {
  const inputRef = useRef(null);
  return <div className="control-stack image-controls">
    <div className="upload-preview">{design.image ? <img src={design.image} alt="Card background" /> : <div><Icon name="image" size={27} /><p>Add a background photo or texture</p></div>}</div>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { uploadFile(event.target.files?.[0], 'background'); event.target.value = ''; }} />
    <Button className="button-outline wide" icon="image" onClick={() => inputRef.current?.click()}>{design.image ? 'Replace background' : 'Upload a background'}</Button>
    {design.image && <button className="remove-image" onClick={() => update('image', null)}>Remove background</button>}
    <p className="panel-helper">This fills the whole card. To place a photo, logo or your own QR somewhere specific, use <strong>Add → Image</strong> in the Text tab instead.</p>
  </div>;
}

function DetailsPanel({ design, update }) {
  return <div className="control-stack text-controls">
    <p className="panel-helper">These feed the elements bound to them, front and back.</p>
    {[['name', 'Your name'], ['role', 'Role or title'], ['brand', 'Café or shop name'], ['reward', 'Reward'], ['logoText', 'Logo or monogram'], ['email', 'Email address'], ['phone', 'Phone number'], ['website', 'Website']].map(([key, label]) => (
      <div className="form-field" key={key}><label>{label}</label><input value={design[key] ?? ''} onChange={(event) => update(key, event.target.value)} /></div>
    ))}
    <div className="form-field"><label>Default QR link</label><input value={design.qrValue || ''} placeholder={design.website} onChange={(event) => update('qrValue', event.target.value)} /></div>
    <div className="qr-note"><Icon name="qr" size={22} /><p>QR codes are generated in your browser and are scannable.</p></div>
  </div>;
}
