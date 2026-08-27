import { isDataUrl, safeFontName } from './safety';

export const systemFonts = ['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Impact', 'Comic Sans MS'];

export const googleFonts = ['Space Grotesk', 'Fraunces', 'Playfair Display', 'DM Mono', 'DM Sans', 'Abril Fatface', 'Alegreya', 'Alfa Slab One', 'Amatic SC', 'Anton', 'Archivo', 'Archivo Black', 'Arimo', 'Arvo', 'Asap', 'Assistant', 'Bangers', 'Barlow', 'Barlow Condensed', 'Bebas Neue', 'Bitter', 'Bodoni Moda', 'Bree Serif', 'Cabin', 'Cairo', 'Caveat', 'Chakra Petch', 'Chivo', 'Cinzel', 'Comfortaa', 'Cookie', 'Cormorant Garamond', 'Courier Prime', 'Crimson Text', 'Dancing Script', 'Domine', 'Dosis', 'EB Garamond', 'Exo 2', 'Figtree', 'Fira Code', 'Fira Sans', 'Fjalla One', 'Frank Ruhl Libre', 'Gloock', 'Great Vibes', 'Heebo', 'Hind', 'IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Serif', 'Inconsolata', 'Inter', 'Instrument Serif', 'Josefin Sans', 'Jost', 'Kanit', 'Karla', 'Lato', 'League Spartan', 'Lexend', 'Libre Baskerville', 'Libre Franklin', 'Lobster', 'Lora', 'Manrope', 'Marcellus', 'Merriweather', 'Michroma', 'Montserrat', 'Mulish', 'Nanum Gothic', 'Noto Sans', 'Noto Serif', 'Nunito', 'Nunito Sans', 'Old Standard TT', 'Open Sans', 'Orbitron', 'Oswald', 'Outfit', 'Overpass', 'Pacifico', 'Permanent Marker', 'Philosopher', 'Play', 'Playfair', 'Plus Jakarta Sans', 'Poppins', 'Prata', 'Prompt', 'PT Sans', 'PT Serif', 'Quicksand', 'Racing Sans One', 'Raleway', 'Recursive', 'Red Hat Display', 'Righteous', 'Roboto', 'Roboto Condensed', 'Roboto Mono', 'Roboto Slab', 'Rubik', 'Sacramento', 'Satisfy', 'Sora', 'Source Code Pro', 'Source Sans 3', 'Source Serif 4', 'Space Mono', 'Spectral', 'Staatliches', 'Syne', 'Tajawal', 'Teko', 'Tinos', 'Titillium Web', 'Ubuntu', 'Unbounded', 'Unica One', 'Urbanist', 'Vollkorn', 'Work Sans', 'Yeseva One', 'Zilla Slab'];

/* Families arrive from Google on demand. crossorigin is required, not cosmetic: without it
   html-to-image cannot read the stylesheet and exported files fall back to the wrong face. */
const requested = new Set(['Space Grotesk', 'Fraunces', 'Playfair Display', 'DM Mono', 'DM Sans']);

export function ensureGoogleFonts(families, uploaded = []) {
  /* An uploaded family is not on Google's servers; asking for it is a guaranteed 404. */
  const local = new Set(uploaded.map((font) => font?.name).filter(Boolean));
  const missing = families.filter((name) => name && !requested.has(name) && !systemFonts.includes(name) && !local.has(name) && googleFonts.includes(name));
  if (!missing.length) return;
  missing.forEach((name) => requested.add(name));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.crossOrigin = 'anonymous';
  link.href = `https://fonts.googleapis.com/css2?${missing.map((name) => `family=${name.replace(/ /g, '+')}:wght@400;700`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

/* Uploaded faces are injected as data-URI @font-face rules so both the preview and the
   export see them — a FontFace added only in script is invisible to the exporter. */
export function installUploadedFonts(fonts) {
  for (const font of fonts || []) {
    /* Both halves are re-checked here rather than trusted from upload time: a draft comes
       back out of localStorage, which anyone can edit by hand, and this is the line where
       those two strings stop being data and become live CSS. */
    const name = safeFontName(font?.name, '');
    if (!name || !isDataUrl(font.src)) continue;
    const id = `uploaded-font-${name.replace(/[^a-z0-9]+/gi, '-')}`;
    if (document.getElementById(id)) continue;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `@font-face{font-family:'${name}';src:url("${font.src}");font-display:swap}`;
    document.head.appendChild(style);
  }
}
