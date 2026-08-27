# Cardplume

A React/Vite product website and browser-based card designer for business, loyalty, and membership cards.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Vite shows in the terminal. For a production check, run:

```bash
npm run build
```

## Included now

- Separate React pages: `/`, `/studio`, `/cafes`, and `/pricing`
- Native scroll-reveal animations with a reduced-motion fallback
- Responsive marketing site with pricing, FAQ, café loyalty pitch, and mobile navigation
- Interactive React card studio with templates, colors, layouts, fonts, editable text, front/back view, and image uploads
- Browser-local draft and saved designs via `localStorage`
- High-resolution PNG export generated in the browser
- Accessible buttons, form labels, focus states, mobile controls, and upload validation

## Product boundary

The app supports payment-card-inspired visual mockups only. Issuing real bank/payment cards requires regulated issuer partnerships, PCI/security work, and card-network approval.

## Logical next integrations

1. Authentication and cloud-sync with Supabase or Firebase
2. Stripe subscriptions for Creator and Café plans
3. Print-ready PDF export and print-provider checkout
4. Secure QR redemption, Apple/Google Wallet passes, and a café staff dashboard
