/* Things that come from outside the code. */

/* Where the contact page and the footer point. */
export const CONTACT_EMAIL = 'hello@cardplume.tech';
export const SOCIAL_INSTAGRAM = 'https://instagram.com/cardplume';
export const SOCIAL_HANDLE = '@cardplume';

/* Grouped for reading, dialled without spaces, and given to wa.me in the international form
   it insists on: country code, no plus, no leading zero. */
export const CONTACT_PHONE = '07 08 46 20 54';
export const CONTACT_PHONE_TEL = 'tel:+212708462054';
export const CONTACT_WHATSAPP = 'https://wa.me/212708462054';

/* Support is a list of routes rather than one checkout button, because no single processor
 * reaches everyone here. Stripe does not open merchant accounts in Morocco at all, and even
 * where a foreign checkout works it turns away most Moroccan debit cards, which are issued
 * for domestic use only. Meanwhile a donor abroad has no branch to walk into. So each entry
 * below is one rail, and the donor takes whichever exists where they are.
 *
 * A route stays hidden until it has a value, so an unfinished list never shows a dead link.
 * Fill one in and it appears on its own — on /support and behind the footer button.
 *
 *   href  the donor is sent somewhere: a page hosted by the provider, or an email that
 *         starts the conversation. No card number, and none of the PCI burden, ever
 *         touches this app either way
 *   copy  there is nothing to open — the donor needs the figure itself, so the button puts
 *         it on their clipboard instead
 *   soon  announced but not open yet. It renders as a plain row with no link, because a
 *         button that goes nowhere is worse than one that says it is not ready
 */
export const SUPPORT_METHODS = [
  /* ---- reachable from anywhere ---- */
  {
    /* The numeric form of the page URL. Patreon keeps it working after a vanity slug is
       claimed, so this link does not go stale the day the page becomes /cardplume. */
    id: 'patreon',
    reach: 'world',
    name: 'Patreon',
    note: 'Monthly membership · card or PayPal',
    href: 'https://www.patreon.com/16693251/join',
  },
  {
    /* Western Union needs a full legal name and a city, not an account number, so there is
       nothing to publish. The details are worth more privately than a RIB on a page the
       whole web can scrape — and this route hands them over one donor at a time.

       It opens WhatsApp rather than a mail client. A mailto: does nothing at all on a
       machine with no mail handler registered, which is most desktops now — the click just
       silently fails, and a support route that appears broken is worse than one that is
       missing. The address is still printed under the list for anyone who prefers it. */
    id: 'western-union',
    reach: 'world',
    name: 'Western Union',
    note: 'Message me and I send the details you need',
    href: `${CONTACT_WHATSAPP}?text=${encodeURIComponent('Hi — I would like to support Cardplume through Western Union. Could you send me the details?')}`,
  },

  /* ---- inside Morocco ---- */
  {
    /* Same reasoning: the RIB carries the account holder's full name, and a name beside an
       account number is exactly what makes a phishing message convincing. Sent on request
       rather than posted. */
    id: 'rib',
    reach: 'morocco',
    name: 'Bank transfer',
    note: 'Message me and I send the RIB',
    href: `${CONTACT_WHATSAPP}?text=${encodeURIComponent('Hi — I would like to support Cardplume by bank transfer. Could you send me the RIB?')}`,
  },
  {
    id: 'cotizi',
    reach: 'morocco',
    name: 'Cotizi',
    note: 'Takes Moroccan cards a foreign checkout refuses',
    href: '',
  },
];

/* The suggested-amount buttons need a real hosted checkout, so a mailto does not qualify —
   sending someone to their mail client from a button marked "$50" would be a bait. Until a
   provider is live this stays empty and those buttons stay hidden. */
export const DONATE_URL = SUPPORT_METHODS.find((method) => method.href?.startsWith('http'))?.href || '';

/* What the goal bar counts up to, in whole dollars. */
export const DONATION_GOAL = 10000;

/* Suggested amounts, empty on purpose. Stripe could price a link per amount, so a "$50"
   button led to a page asking for exactly $50. Patreon prices its own tiers instead, and a
   row of amounts here would send someone who pressed $50 to a page that only offers the
   tiers set up over there. Fill this in only against a provider that can honour the figure. */
export const DONATION_TIERS = [];
