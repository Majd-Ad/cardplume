/* The template catalogue.
 *
 * Plain data on purpose: adding a template is adding one object to this array, not a code
 * change somewhere inside the studio. Nothing here imports anything, so this file can grow
 * to a hundred entries without dragging the rest of the app around with it.
 *
 *   id           unique, and what gets stored on the design as `design.template`
 *   label        what the tile says
 *   type         Business | Loyalty | Membership — decides which elements the card gets
 *   color        card background;  accent  the decorative fill;  font  the default family
 *   stampsTotal  loyalty only: how many visits fill the card
 *   blank        starts with the text fields empty rather than the sample copy
 */
export const templates = [
  { id: 'blank', label: 'Blank canvas', type: 'Blank', color: '#f5f0e7', accent: '#17221d', font: 'Space Grotesk', blank: true },
  { id: 'studio', label: 'Studio bloom', type: 'Business', color: '#d9fb8f', accent: '#ff7947', font: 'Space Grotesk' },
  { id: 'noir', label: 'Midnight gold', type: 'Business', color: '#101013', accent: '#c9a227', ink: '#f3e3ba', font: 'Fraunces' },
  { id: 'monogram', label: 'Quiet monogram', type: 'Business', color: '#f5f0e7', accent: '#17221d', font: 'Fraunces' },
  { id: 'bold', label: 'Big idea', type: 'Business', color: '#ff7947', accent: '#17221d', font: 'Space Grotesk' },
  { id: 'coffee', label: 'Coffee club', type: 'Loyalty', color: '#f0b05c', accent: '#4a2d1c', font: 'Space Grotesk', stampsTotal: 8 },
  { id: 'pastry', label: 'Pastry pass', type: 'Loyalty', color: '#ffc2d7', accent: '#8e3d58', font: 'Fraunces', stampsTotal: 5 },
  { id: 'member', label: 'Members only', type: 'Membership', color: '#b9d5ff', accent: '#293c68', font: 'DM Mono' },
  { id: 'atelier', label: 'Atelier note', type: 'Playfair', color: '#cfe7df', accent: '#e28c63', font: 'Playfair Display' },
];
