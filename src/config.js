/* Things that come from outside the code.
 *
 * DONATE_URL is a Stripe Payment Link, created once in the Stripe dashboard
 * (Payments -> Payment Links -> New). It looks like:
 *
 *   https://donate.stripe.com/xxxxxxxxxxxxxxxx
 *
 * Stripe hosts the whole checkout, so no card number ever touches this app and none of the
 * PCI burden lands on it. Paste the link here and the Support buttons appear on their own —
 * in the footer and on the pricing page. Leave it empty and they stay hidden.
 */
export const DONATE_URL = '';

/* Where the contact page and the footer point. */
export const CONTACT_EMAIL = 'hello@cardplume.tech';
export const SOCIAL_INSTAGRAM = 'https://instagram.com/cardplume';
export const SOCIAL_HANDLE = '@cardplume';

/* What the goal bar counts up to, in whole dollars. */
export const DONATION_GOAL = 10000;

/* One Stripe Payment Link per amount — Stripe prices a link when you create it, so a fixed
   amount needs its own link. Leave a url empty and that button falls back to DONATE_URL,
   where the donor types their own figure. */
export const DONATION_TIERS = [
  { amount: 5, url: '' },
  { amount: 10, url: '' },
  { amount: 50, url: '' },
  { amount: 100, url: '' },
  { amount: 250, url: '' },
  { amount: 2500, url: '' },
];
