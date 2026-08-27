import { createElement } from 'react';

/* The Lucide set is 2000 icons and roughly 400 KB of path data. Nobody should download that
 * to look at a card, so it arrives as its own chunk the first time the picker is opened, and
 * is kept in memory afterwards. */
let cache = null;
let pending = null;

const humanise = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/-/g, ' ');

export function loadIconLibrary() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('lucide').then(({ icons }) => {
      cache = Object.entries(icons).map(([name, nodes]) => ({ name, label: humanise(name), nodes }));
      return cache;
    });
  }
  return pending;
}

export const iconLabel = (name) => (name ? humanise(name) : '');

/* An icon is stored on the element as its node data — [tag, attributes] pairs — rather than as
 * a name to look up or a blob of markup. That means the card renders without the library
 * loaded, exports correctly, survives a round trip through localStorage, and never needs
 * dangerouslySetInnerHTML: each node becomes a real React element. */
export function IconArt({ nodes, strokeWidth = 2 }) {
  if (!Array.isArray(nodes) || !nodes.length) return null;
  return <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {nodes.map(([tag, attributes], index) => (typeof tag === 'string' ? createElement(tag, { key: index, ...attributes }) : null))}
  </svg>;
}
