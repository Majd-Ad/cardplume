/* Per-route <head> metadata.

   The site is one HTML file that React repaints, so every URL serves the same <head>
   written in index.html. Left alone, /studio, /support and /faq all tell a crawler they
   are "Cardplume — Cards with character" with the same description underneath — nine
   routes describing themselves as one page, which is roughly what a search engine then
   files them as.

   Google runs JavaScript, so setting the tags from here is enough for them to be read.
   It is still the weaker half of the fix: the HTML that leaves the server carries the
   generic head until the bundle lands. Prerendering these six routes at build time is
   the stronger version and the next thing to do to this file's neighbours. */

export const SITE_URL = 'https://www.cardplume.tech';

/* Titles stay under 60 characters and descriptions under 155. Past those lengths Google
   truncates or rewrites them, and the sentence a searcher reads stops being ours. */
const PAGES = {
  '/': {
    title: 'Free Card Maker — Design a Card Online | Cardplume',
    description:
      'Design a business card, visiting card or loyalty card free in your browser. No account and no paywall. Export a PNG or a print-ready PDF with bleed.',
  },
  '/studio': {
    title: 'Card Design Studio — Front, Back and Print-Ready',
    description:
      'Open the Cardplume studio. Design front and back, portrait or landscape, then export a PNG or a print-ready PDF. Free, with nothing to sign up for.',
  },
  '/support': {
    title: 'Support Cardplume — Keep It Free for Everyone',
    description:
      'Cardplume is free and stays free. If it saved you a trip to the print shop you can chip in, and giving changes nothing about what you can use.',
  },
  '/cafes': {
    title: 'Loyalty Card Maker for Cafés and Small Shops',
    description:
      'Build a loyalty card your regulars keep in their wallet. Free to design, free to print, and no app for your customers to download first.',
  },
  '/faq': {
    title: 'Cardplume FAQ — How the Free Card Studio Works',
    description:
      'What Cardplume costs, what you can export, and how a studio with no paid tier keeps running. Straight answers, with no plans to compare.',
  },
  '/contact': {
    title: 'Contact Cardplume',
    description:
      'Questions, bugs, or an idea for the studio. Send it here and a real person reads it.',
  },

  /* Signed-in routes. They are disallowed in robots.txt as well, because robots.txt stops
     the crawl and this stops the indexing, and the two failure modes are different. */
  '/projects': {
    title: 'Your projects — Cardplume',
    description: 'The cards saved to your Cardplume account.',
    index: false,
  },
  '/reset': {
    title: 'Reset your password — Cardplume',
    description: 'Set a new password for your Cardplume account.',
    index: false,
  },
};

const NOT_FOUND = {
  title: 'Page not found — Cardplume',
  description: 'That card is not in the deck. Head back to the studio.',
  index: false,
};

/* Trailing slashes make /faq and /faq/ look like two pages holding one page's worth of
   evidence between them. One spelling wins here and in the canonical tag both times. */
function normalise(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export function metaFor(pathname) {
  const path = normalise(pathname);
  const page = PAGES[path] ?? NOT_FOUND;
  const indexable = page.index !== false;

  return {
    title: page.title,
    description: page.description,
    /* A noindex page still passes value along the links it holds, so follow stays on. */
    robots: indexable ? 'index, follow' : 'noindex, follow',
    canonical: indexable ? `${SITE_URL}${path === '/' ? '/' : path}` : null,
  };
}

function upsertMeta(attribute, key, content) {
  const selector = `meta[${attribute}="${key}"]`;
  let node = document.head.querySelector(selector);

  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }

  node.setAttribute('content', content);
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]');

  if (!href) {
    node?.remove();
    return;
  }

  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }

  node.setAttribute('href', href);
}

/* Called on every route change. Writing the same values twice is harmless, which matters
   because StrictMode runs effects twice in development. */
export function applyPageMeta(pathname) {
  const { title, description, robots, canonical } = metaFor(pathname);

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertCanonical(canonical);

  /* Open Graph and Twitter read separately from the tags above, so a link pasted into a
     message shows the page someone actually opened rather than the home page every time. */
  upsertMeta('property', 'og:site_name', 'Cardplume');
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', canonical ?? SITE_URL);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
}
