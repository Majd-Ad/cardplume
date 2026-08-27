# Cardplume — Full Project Brief (state of the app + what is missing)

> Paste this whole file to an AI assistant and ask the question at the very bottom.
> Everything below was verified by reading the actual source files, not from memory.

---

## 1. What this project is

**Cardplume** — a marketing website + a browser-based **card design studio** for
business cards, café loyalty (stamp) cards, and membership cards.
Everything runs **100% client-side in the browser**. There is no server, no database,
no account system, and no payments.

Explicit product boundary already stated in the README: the app only produces
*payment-card-inspired visual mockups*. It does not issue real bank/payment cards.

---

## 2. Tech stack and file layout

| Item | Value |
|---|---|
| Framework | React (latest) + Vite (latest) |
| Routing | `react-router-dom` (BrowserRouter) |
| Language | Plain JavaScript + JSX. **No TypeScript.** |
| Styling | Hand-written CSS, no Tailwind, no CSS framework, no CSS modules |
| State | React `useState` / `useRef` only. **No Redux/Zustand/Context.** |
| Persistence | `localStorage` only |
| Build | `npm run dev` / `npm run build` / `npm run preview` |
| Tests | **None** |
| Linting / CI | **None** |

```
/
├── index.html            (23 lines — root HTML, Google Fonts <link>, meta tags)
├── package.json          (5 deps: react, react-dom, react-router-dom, vite, @vitejs/plugin-react)
├── package-lock.json
├── README.md
├── .gitignore            (node_modules, dist, .vite)
├── dist/                 (a production build sitting on disk)
└── src/
    ├── main.jsx          (10 lines — createRoot + StrictMode)
    ├── App.jsx           (421 lines / ~49 KB — THE ENTIRE APP IS IN THIS ONE FILE)
    ├── styles.css        (~33 KB — design system + studio + marketing sections)
    └── routes.css        (~5 KB — per-route styles: cafés page, 404, etc.)
```

**Notable:** there is **no `vite.config.js`**. `@vitejs/plugin-react` is installed but
never registered, so React Fast Refresh / HMR is not actually configured.

Fonts loaded globally from Google Fonts in `index.html`:
DM Mono, DM Sans, Fraunces, Playfair Display, Space Grotesk.

---

## 3. Routes (all implemented)

| Route | Component | Content |
|---|---|---|
| `/` | `HomePage` | Hero, FeatureGrid, CardTypes, Steps |
| `/studio` | `StudioPage` | The card editor |
| `/studio?type=loyalty` | same | deep link that auto-selects the "Coffee club" loyalty template and jumps to the Text tab |
| `/cafes` | `CafesPage` | CafeHero, LoyaltySection (wallet phone mockup), CafeFlow |
| `/pricing` | `PricingPage` | 2 pricing plans |
| `/faq` | `FaqPage` | 6-question accordion |
| `*` | `NotFoundPage` | styled 404 |

---

## 4. WHAT IS ALREADY BUILT (detailed)

### 4.1 Global shell
- **Header** — logo, 5 nav links with active state, "Sign in" button, "Create a card" CTA.
- **"Create a card" button animation** — a gradient wipes across on hover; on click a little
  card icon "launches" out of the button, then navigates to `/studio` after 360 ms.
- **Mobile nav** — hamburger toggle with `aria-expanded`, links collapse into a panel.
- **Scroll progress bar** — a gradient bar under the header, driven by `requestAnimationFrame`.
- **`Reveal` component** — scroll-reveal animation via `IntersectionObserver`, with a
  `prefers-reduced-motion` fallback (shows content instantly) and a no-IntersectionObserver fallback.
- **`ScrollToTop`** — scrolls to top on route change, or smooth-scrolls to a `#hash`.
- **Toast** — a single global toast, auto-dismisses after 2800 ms, `role="status"`.
- **Custom inline SVG icon set** — 16 icons defined as a `paths` map (arrow, spark, chevron,
  menu, close, download, save, refresh, image, type, palette, qr, check, lock, play, plus).
  No icon library dependency.
- **Legacy anchor interception** — a `document`-level click listener rewrites old
  `#studio`, `#loyalty`, `#pricing`, `#faq`, `#top` anchors into router navigations.

### 4.2 Marketing pages
- **Hero** — decorative lines/star/ring, headline, sub-copy, 2 CTAs, avatar stack,
  "12,000+ cards created" social proof, and 2 floating mini-card mockups.
- **FeatureGrid** — 3 numbered feature cards with icons.
- **CardTypes** — 3 category cards (Business / Loyalty / Membership) each with a mini CSS mockup.
- **Steps** — 3-step "idea to hand" list.
- **LoyaltySection** — a CSS-drawn **iPhone wallet mockup** with a stamp pass (5/8 coffees),
  orbit decorations, a "scan to join" tag, and a 3-item checklist.
- **CafeHero** — café-specific hero with a live `CardFace` preview and 3 stats.
- **CafeFlow** — 3-step café onboarding loop + a bottom CTA band.
- **Pricing** — 2 plans: **Creator $12/mo** and **Café/Shop $29/mo** (highlighted, "MOST LOVED
  BY CAFÉS" tag, 14-day trial). Feature bullet lists + footnote.
- **FAQ** — 6 questions, accordion with `aria-expanded` / `aria-controls`, one open at a time.
- **Footer** — brand, tagline, CTA, copyright, Instagram / Contact / Help links.

### 4.3 THE STUDIO (the real product) — `CardStudio`

**Layout:** left sidebar (tab rail + "Auto-saved locally" status) · middle control panel ·
right live preview. On mobile the tabs become a horizontal row.

**4 tabs: Design · Text · Image · Details**

#### Design tab
- **Template picker** — 8 hardcoded templates, 5 shown + "See all" toggle:
  `Blank canvas`, `Studio bloom`, `Quiet monogram`, `Big idea`, `Coffee club` (8 stamps),
  `Pastry pass` (5 stamps), `Members only`, `Atelier note`.
  Choosing a template sets color, accent, ink, layout, font, type, stamp count, and
  **resets all text positions**. "Blank canvas" wipes all text fields.
- **Color story** — 6 curated swatches (Citrus, Blush, Sunset, Ink, Sky, Cloud), each with a
  paired ink color for contrast. Plus a native `<input type="color">` **and** a hex text
  field validated with a 6-digit hex regex.
- **Layout** — 3 options: `classic` / `bold` / `minimal`.
- **Finish** — 3 options: `Soft-touch` / `Matte` / `Gloss`.

#### Text tab
- Card type select: **Business / Loyalty / Membership** (switches the whole front-face layout).
- Logo or monogram text (max 14 chars).
- **Business/Membership fields:** Name (28 chars), Role or title (38 chars).
- **Loyalty fields:** Café name (28), Reward text (42), Visits to reward (1–12, auto-clamps
  the collected count and auto-rewrites the reward sentence), Stamp icon (5 presets:
  spark / heart / bolt / diamond / dot — **or** type any custom 2-character symbol),
  Collected stamps slider (0 → total).
- Typeface select: Space Grotesk / Fraunces / Playfair Display / DM Mono.
- **Custom font family** — a free-text field injected straight into the CSS `font-family`.
- **Text X slider** (−90…90 px) and **Text Y slider** (−70…70 px) for the selected layer.

#### Image tab
- Upload button + hidden file input, accepts `image/png, image/jpeg, image/webp`.
- Validation: must be an image, **max 5 MB**, with inline error messages.
- Read as a base64 data URL via `FileReader`, stored in React state.
- Preview thumbnail, "Replace image", "Remove image".
- The image renders as a **full-bleed background layer** behind the card content.

#### Details tab
- Email / Phone / Website — these render on the **back** of the card.
- A "QR code" note box.

#### Live preview
- **Front / Back toggle** with a 3D "door-open" rotateY animation (`perspective: 1100px`).
- **Front face** — top line (logo + `01/01` or `5/8 VISITS`), the business or loyalty body,
  a bottom line (website or reward), plus a grain overlay and abstract accent shapes.
- **Loyalty face** — brand name, "YOUR COFFEE CLUB", a row of filled/empty stamp glyphs,
  and an `x / y VISITS` counter.
- **Back face** — "LET'S CONNECT", name, role, email/phone/website, and a **fake QR block**
  built from 9 `<i>` divs.
- **Drag to move text** — pointer-events drag on 4 layers (`logo`, `title`, `subtitle`,
  `footer`) using `setPointerCapture` + `requestAnimationFrame`, clamped to the slider ranges.
- **Click-to-place** — clicking an empty area of the card moves the currently selected layer
  to that point and fires a toast.
- The selected layer gets a dashed outline.

#### Studio actions
- **Reset** — back to the initial design.
- **Copy text** — copies the card's text to the clipboard.
- **Duplicate** — clones the current design into the saved list.
- **Share** — copies the **current page URL** (not the design) to the clipboard.
- **Export PNG** — see below.
- **Save current** — pushes the design into the saved list.

#### Persistence
- `localStorage['cardverse-draft']` — rewritten on **every** design change (auto-save),
  wrapped in try/catch because a big base64 image can exceed the quota.
- `localStorage['cardverse-saved']` — an array capped at **6** designs; only the **first 3**
  are rendered as clickable thumbnails that reload that design.

#### PNG export (`exportDesign`)
- Creates an offscreen `<canvas>` at **1050 × 600 CSS px, scale 2 → 2100 × 1200 px**.
- Manually paints: background color, one translucent accent circle, the logo line, the
  counter, then either (name + role) or (brand + "YOUR COFFEE CLUB" + a drawn stamp row),
  then a footer line.
- Downloads via a generated `<a download>` link named `<name>-card.png`.

---

## 5. WHAT IS **NOT** BUILT — gaps, missing features, and real bugs

### 5.1 Correctness / consistency problems that already exist
1. **The PNG export does not match the live preview.** It is a completely separate,
   hand-coded canvas drawing. It **ignores**: the uploaded image, the `layout`
   (classic/bold/minimal), the `finish`, **all dragged text positions (`textPositions`)**,
   the grain overlay, the abstract shapes, and the whole **back side** of the card.
   What the user designs is not what they download.
2. **The QR code is fake and the promise is wrong.** The Details tab says *"A QR code linking
   to your profile is included when you export"* — the export draws **no QR at all**, and the
   on-card QR is 9 decorative `<i>` divs. No QR library is installed.
3. **Two `document`-level click listeners** (card placement in the studio, plan clicks in
   Pricing) instead of normal React handlers. Fragile and easy to break.
4. **Dead code** — `placeLayer` is defined inside `CardStudio` and never called; its logic is
   duplicated inside a `useEffect`.
5. **The X/Y sliders and the drag are half-wired.** `design.textX` / `design.textY` are stored
   globally, but the drag writes into `design.textPositions[layer]`. A layer only reads
   `textX/textY` if it happens to be the selected one and has no stored position.
6. **`customFont` is never loaded.** Typing "Georgia" works only if the OS has that font;
   nothing is fetched. The exported canvas can silently fall back to a different typeface.
7. **`localStorage` quota.** A 5 MB image becomes a ~6.7 MB base64 string; the draft save
   fails silently (empty `catch`) and the user is never told the auto-save stopped working.
8. **SPA routing on deploy** — no `_redirects` / `vercel.json` / rewrite rule, so refreshing
   on `/studio` on a static host returns a 404.
9. **No `vite.config.js`** — the React plugin is installed but not registered.

### 5.2 Editor features that do not exist at all
- **No undo / redo, no history.**
- **No layers panel**, no z-order, no reorder, no show/hide, no lock, no rename.
- **You cannot add a new element.** Only 4 fixed, predefined text layers exist. There is no
  "add text box", no shapes, no lines, no arrows, no stickers, no icons, no illustrations.
- **No per-element typography controls** — no font size, weight, color, alignment,
  letter-spacing, line-height, uppercase toggle, or text effects per layer.
- **No image editing** — no crop, scale, reposition, rotate, opacity, filters, blur,
  brightness/contrast, duotone, or background removal. The upload is always a full-bleed fill.
- **No gradients, patterns, textures, borders, corner radius, shadows, or blend modes.**
- **No canvas zoom / pan**, no rulers, no guides, no grid, no snapping, no smart alignment,
  no distribute/align tools, no arrow-key nudging.
- **No multi-select, no grouping, no copy/paste of elements, no delete key.**
- **No keyboard shortcuts of any kind.**
- **No right-click / context menu.**

### 5.3 Content & asset features that do not exist
- Only **8 hardcoded templates**. No template search, categories, filters, or tags.
- No stock photo / stock element / stock icon library.
- No font picker beyond 4 hardcoded families; no Google Fonts browser, no font upload.
- **No brand kit** — no saved palettes, saved logos, saved fonts, or brand colors.
- No AI features — no AI text generation, AI image generation, AI background removal,
  AI "magic resize", or AI template suggestion.
- No size presets — no standard business-card dimensions (85×55 mm / 3.5×2 in),
  no bleed, no trim marks, no safe zone, no orientation switch (landscape/portrait).

### 5.4 Export / output features that do not exist
- **No PDF export**, no print-ready output, no 300 DPI guarantee, no CMYK, no bleed.
- No SVG export, no JPG, no WebP, no transparent background.
- No export of the **back** side, and no combined front+back sheet.
- No multi-card imposition sheet for printing several cards on one page.
- No share link that actually contains the design (Share only copies the page URL).
- No embed code, no public gallery, no social-size exports.

### 5.5 Platform features that do not exist
- **No authentication, no accounts, no cloud sync.** "Sign in" only shows a toast.
- **No backend, no database, no API.** Everything dies with the browser profile.
- **No payments.** Stripe is not integrated; both pricing buttons just open the studio.
- **No team features** — no sharing, comments, collaboration, or real-time multiplayer.
- **No project/folder management** — saved designs are a flat list capped at 6, with no
  rename, no delete, no search, and no gallery page.
- No batch / variable-data generation (e.g. import a CSV of employees → generate N cards).
- No version history for a design.

### 5.6 Loyalty product features that are only visuals
- The wallet phone on `/cafes` is a **static CSS mockup**. There is no Apple Wallet
  (`.pkpass`) or Google Wallet pass generation.
- No customer signup, no customer database, no scan/redeem flow, no stamp validation.
- No café staff dashboard, no analytics, no anti-fraud.
- The stamp counter is a **slider the designer drags** — it is not connected to anything real.

### 5.7 Quality / infrastructure gaps
- **No tests** (unit, component, or e2e), **no ESLint/Prettier**, **no CI**, **no error boundary**.
- **No TypeScript** and no PropTypes.
- **All 421 lines / 49 KB of the app live in one file** (`src/App.jsx`) — ~30 components,
  the data constants, the export function, and all the routing together.
- CSS is ~38 KB of hand-written, densely packed rules across 2 files.
- **No SEO per route** — one `<title>` and one `<meta description>` for the whole SPA,
  no Open Graph / Twitter card, no favicon, no `robots.txt`, no sitemap.
- **No i18n** — English only, no RTL / Arabic support.
- **No dark mode.**
- **No analytics, no error tracking.**
- Accessibility is decent (aria-labels, roles, focus states, reduced-motion) but the
  drag-to-move interaction is **pointer-only — there is no keyboard equivalent**.

---

## 6. Constraints to respect in any proposal

1. It must stay a **React + Vite** app. No rewrite to Next.js unless you argue it clearly.
2. Prefer solutions that keep working **fully client-side**; explicitly flag anything that
   requires a backend, a paid API, or a subscription.
3. Keep the existing visual identity (the cream / citrus / ink palette, Space Grotesk + Fraunces).
4. Bundle size matters — the app currently has almost no dependencies.
5. The product boundary stands: **visual mockups only, no real payment-card issuing.**

---

## 7. THE QUESTION FOR YOU (the AI)

Given everything above:

1. **Compare this studio to Canva's editor** and tell me, concretely, which Canva-style
   capabilities are missing here that would have the biggest impact. Cover at least:
   the element model (adding / selecting / layering objects), typography controls, image
   editing, shapes & assets, canvas tools (zoom, guides, snapping, alignment),
   undo/redo, templates & brand kit, resize/format presets, and export formats.
2. **Rank your proposals** into: (a) quick wins I can ship in a day, (b) medium work
   (a few days), (c) big architectural changes — and say which existing bug from
   section 5.1 each one fixes or depends on.
3. **The #1 architectural question:** the current editor uses fixed hardcoded layers plus a
   separate hand-drawn canvas export. Should I move to a real **object / element model**
   (an array of elements with type / x / y / w / h / rotation / style, rendered by one
   renderer shared by both the preview and the export)? If yes, show me the data model and
   the migration path from the current `design` object. If no, explain what to do instead.
4. **Recommend the specific libraries** you would use (e.g. for canvas/SVG editing,
   PNG/PDF export, QR generation, font loading, undo/redo) with the trade-offs of each.
5. Tell me what I should **deliberately NOT build**, to avoid turning this into a bad
   half-clone of Canva.

End with a concrete, ordered roadmap of the next 10 things to implement.
