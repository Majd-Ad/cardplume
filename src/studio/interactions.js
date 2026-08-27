/* Direct manipulation on the card: move, resize from eight handles, rotate, and snapping.
 *
 * Everything works in card percentages rather than pixels, so a gesture means the same thing
 * whatever size the preview happens to be rendered at.
 */

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP_TOLERANCE = 0.9;   // in card-percent
const ROTATE_STEP = 15;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/* How much of an element has to stay on the card, in card-percent. An element is allowed to
   hang almost entirely over the edge — that is how a decoration bleeds past the trim — but
   never so far that there is nothing left to grab it by. */
const EDGE_MARGIN = 6;

/* An element's box in card-percent. Text has no stored height, so it is measured. */
export function boxOf(element, card, node) {
  const height = node && card ? (node.getBoundingClientRect().height / card.height) * 100 : 0;
  return { x: element.x, y: element.y, w: element.w, h: height };
}

/* Candidate lines to snap against: the card's own edges and centre, plus every other
   element's edges and centre. Returns the adjusted offset and the lines that matched. */
function snapMove(box, targets, dx, dy) {
  const moved = { x: box.x + dx, y: box.y + dy };
  const verticals = [0, 50, 100, ...targets.flatMap((t) => [t.x, t.x + t.w / 2, t.x + t.w])];
  const horizontals = [0, 50, 100, ...targets.flatMap((t) => [t.y, t.y + t.h / 2, t.y + t.h])];
  const guides = [];
  let bestX = null;
  for (const edge of [{ at: moved.x, offset: 0 }, { at: moved.x + box.w / 2, offset: box.w / 2 }, { at: moved.x + box.w, offset: box.w }]) {
    for (const line of verticals) {
      const delta = line - edge.at;
      if (Math.abs(delta) <= SNAP_TOLERANCE && (bestX === null || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, line };
    }
  }
  let bestY = null;
  for (const edge of [{ at: moved.y, offset: 0 }, { at: moved.y + box.h / 2, offset: box.h / 2 }, { at: moved.y + box.h, offset: box.h }]) {
    for (const line of horizontals) {
      const delta = line - edge.at;
      if (Math.abs(delta) <= SNAP_TOLERANCE && (bestY === null || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, line };
    }
  }
  if (bestX) { moved.x += bestX.delta; guides.push({ axis: 'x', at: bestX.line }); }
  if (bestY) { moved.y += bestY.delta; guides.push({ axis: 'y', at: bestY.line }); }
  return { x: moved.x, y: moved.y, guides };
}

/* Drag one or more elements. `commit` receives a map of id -> {x,y} in card-percent. */
export function startMove({ ids, design, card, nodes, event, commit, onGuides, onEnd }) {
  const startX = event.clientX;
  const startY = event.clientY;
  const origins = new Map();
  for (const id of ids) {
    const element = design.elements.find((item) => item.id === id);
    if (element) origins.set(id, boxOf(element, card, nodes.get(id)));
  }
  const others = design.elements
    .filter((item) => item.side === (design.elements.find((e) => e.id === ids[0])?.side) && !ids.includes(item.id) && !item.hidden)
    .map((item) => boxOf(item, card, nodes.get(item.id)));
  const lead = origins.get(ids[0]);
  let moved = false;

  return drive(event, (moveEvent) => {
    const dxRaw = ((moveEvent.clientX - startX) / card.width) * 100;
    const dyRaw = ((moveEvent.clientY - startY) / card.height) * 100;
    if (!moved && Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) < 3) return;
    moved = true;
    let dx = dxRaw;
    let dy = dyRaw;
    let guides = [];
    if (lead && !moveEvent.altKey) {
      const snapped = snapMove(lead, others, dxRaw, dyRaw);
      dx = snapped.x - lead.x;
      dy = snapped.y - lead.y;
      guides = snapped.guides;
    }
    onGuides?.(guides);
    const patch = {};
    for (const [id, origin] of origins) {
      /* Bounds follow the element's own size, so a big shape can sit mostly off the card.
         A fixed -25% used to yank the stock accent circle (y -33.6%) back on the first drag. */
      const minX = Math.min(-25, EDGE_MARGIN - origin.w);
      const minY = Math.min(-25, EDGE_MARGIN - (origin.h || 0));
      patch[id] = {
        x: round(clamp(origin.x + dx, minX, 100 - EDGE_MARGIN)),
        y: round(clamp(origin.y + dy, minY, 100 - EDGE_MARGIN)),
      };
    }
    commit(patch);
  }, () => { onGuides?.([]); onEnd?.(moved); });
}

/* Resize from a handle. Text keeps its font size unless a corner is used, in which case the
   type scales with the box — the behaviour people expect from a design tool. */
export function startResize({ id, handle, design, card, node, event, commit, onEnd }) {
  const element = design.elements.find((item) => item.id === id);
  if (!element) return undefined;
  const start = boxOf(element, card, node);
  const startSize = element.style?.size;
  const startX = event.clientX;
  const startY = event.clientY;
  const corner = handle.length === 2;

  return drive(event, (moveEvent) => {
    const dx = ((moveEvent.clientX - startX) / card.width) * 100;
    const dy = ((moveEvent.clientY - startY) / card.height) * 100;
    let { x, y, w } = start;
    let scale = 1;
    if (handle.includes('e')) w = Math.max(3, start.w + dx);
    if (handle.includes('w')) { w = Math.max(3, start.w - dx); x = start.x + (start.w - w); }
    if (corner) {
      scale = w / start.w;
      if (handle.includes('n')) y = start.y + start.h * (1 - scale);
    } else if (handle === 'n' || handle === 's') {
      /* Vertical-only on a boxed element changes its aspect; on text it scales the type. */
      const heightScale = start.h ? (start.h + (handle === 's' ? dy : -dy)) / start.h : 1;
      scale = Math.max(0.15, heightScale);
      if (handle === 'n') y = start.y + start.h * (1 - scale);
    }
    const patch = { x: round(x), y: round(y), w: round(w) };
    if (corner || handle === 'n' || handle === 's') {
      if (startSize) patch.style = { ...element.style, size: round(Math.max(0.6, startSize * scale)) };
    }
    commit({ [id]: patch });
  }, () => onEnd?.(true));
}

export function startRotate({ id, design, card, node, event, commit, onEnd }) {
  const element = design.elements.find((item) => item.id === id);
  if (!element || !node) return undefined;
  const rect = node.getBoundingClientRect();
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;
  const startAngle = Math.atan2(event.clientY - centreY, event.clientX - centreX);
  const startRotation = element.rotation || 0;

  return drive(event, (moveEvent) => {
    const angle = Math.atan2(moveEvent.clientY - centreY, moveEvent.clientX - centreX);
    let degrees = startRotation + ((angle - startAngle) * 180) / Math.PI;
    /* Shift snaps to 15° so "straight again" is reachable by hand. */
    if (moveEvent.shiftKey) degrees = Math.round(degrees / ROTATE_STEP) * ROTATE_STEP;
    commit({ [id]: { rotation: Math.round(degrees) } });
  }, () => onEnd?.(true));
}

/* Shared pointer plumbing: capture on the element that started the gesture, and make sure
   the listeners come off even when the pointer is cancelled mid-drag. */
function drive(event, onMove, onStop) {
  const target = event.currentTarget;
  const { pointerId } = event;
  let frame = 0;
  const move = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => onMove(moveEvent));
  };
  const stop = (stopEvent) => {
    if (stopEvent.pointerId !== pointerId) return;
    cancelAnimationFrame(frame);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', stop);
    target.removeEventListener('pointercancel', stop);
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    onStop();
  };
  target.setPointerCapture(pointerId);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', stop);
  target.addEventListener('pointercancel', stop);
  return stop;
}

const round = (value) => Math.round(value * 100) / 100;
