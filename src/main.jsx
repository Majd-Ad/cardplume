import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './routes.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* The intro card in index.html paints long before this bundle exists — that is the whole
   point of it — so clearing it away is the only part that needs JS.

   The wait is anchored to the animation actually finishing, not to a stopwatch started at
   navigation: CSS delays are counted from first paint, and first paint waits on the Google
   Fonts stylesheet in <head>. On a slow font response that lands a second or more late, and
   a fixed timer would then pull the card away with the word half written. */
const intro = document.getElementById('cardplume-loader');

if (intro) {
  const clear = () => {
    intro.classList.add('is-out');
    window.setTimeout(() => intro.remove(), 550);
  };
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (still) {
    clear();
  } else {
    /* The quill's flight is the last beat of the intro, so its end is the end of the show. */
    const quill = intro.querySelector('.cp-quill-lift');
    const done = () => { window.clearTimeout(guard); clear(); };
    /* If the animation never reports back — no animation events, a browser that skipped it —
       the intro still leaves, a beat after it would have ended on its own. */
    const guard = window.setTimeout(done, 9000);
    quill?.addEventListener('animationend', done, { once: true });
  }
}
