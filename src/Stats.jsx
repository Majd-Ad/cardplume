import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';
import { DONATE_URL, DONATION_GOAL, DONATION_TIERS } from './config';
import { isBackendLive, useSiteStats, useTopDonors } from './backend/stats';

/* Counts up to a real number once, when it scrolls into view. The element is given the final
   value in its aria-label from the start, so a screen reader is never read a running total. */
function Tally({ value, prefix = '', suffix = '' }) {
  const [shown, setShown] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still || typeof IntersectionObserver === 'undefined') { setShown(value); return undefined; }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const started = performance.now();
      const run = (now) => {
        const t = Math.min(1, (now - started) / 1100);
        /* ease-out so it decelerates into the real figure rather than stopping dead */
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }, { threshold: 0.4 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref} aria-label={`${prefix}${value.toLocaleString()}${suffix}`}>
    <span aria-hidden="true">{prefix}{shown.toLocaleString()}{suffix}</span>
  </span>;
}

/* The strip under the hero. Renders nothing at all until there is a database to count. */
export function SiteStats() {
  const stats = useSiteStats();
  if (!isBackendLive || !stats) return null;
  /* Nothing to show yet is not the same as something to boast about. An empty strip makes no
     claim; "0 makers · 0 cards designed" makes a bad one. It appears on its own with the
     first signup. */
  if (!stats.makers && !stats.cards && !stats.donors) return null;
  const figures = [
    { value: stats.makers, label: stats.makers === 1 ? 'maker' : 'makers' },
    { value: stats.cards, label: stats.cards === 1 ? 'card designed' : 'cards designed' },
    { value: stats.donors, label: stats.donors === 1 ? 'supporter' : 'supporters' },
  ];
  return <div className="site-stats">
    {figures.map((figure) => <div key={figure.label}>
      <strong><Tally value={figure.value} /></strong>
      <span>{figure.label}</span>
    </div>)}
  </div>;
}

/* Floor, never round. A total of $3,724.50 shown as "$3,725" claims fifty cents nobody gave.
   On a public money figure the error has to fall on the safe side. */
const money = (cents) => `$${Math.floor(cents / 100).toLocaleString()}`;

/* Goal bar, preset amounts and the leaderboard. Every figure is a row in the donations table
   written by the Stripe webhook — there is no client-side tally to drift out of step. */
export function DonationGoal() {
  const stats = useSiteStats();
  const donors = useTopDonors(5);
  const tiers = DONATION_TIERS.filter((tier) => tier.url || DONATE_URL);

  if (!isBackendLive || !stats) {
    return tiers.length ? <div className="give-tiers">{tiers.map((tier) => <a
      key={tier.amount} className="give-tier" href={tier.url || DONATE_URL} target="_blank" rel="noopener noreferrer"
    >${tier.amount}</a>)}</div> : null;
  }

  const raised = stats.raised_cents || 0;
  const goal = Math.max(1, DONATION_GOAL) * 100;
  const share = Math.min(100, (raised / goal) * 100);

  return <div className="give">
    <div className="give-head">
      <div>
        <strong><Tally value={Math.floor(raised / 100)} prefix="$" /></strong>
        <span className="give-goal">raised of {money(goal)}</span>
      </div>
      <b className="give-share">{share < 1 && raised > 0 ? '<1' : Math.round(share)}%</b>
    </div>

    <div className="give-bar" role="progressbar" aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100} aria-label={`${money(raised)} raised of ${money(goal)}`}>
      <i style={{ width: `${share}%` }} />
    </div>
    <p className="give-note">
      <Icon name="heart" size={13} />
      {stats.donors > 0
        ? `${stats.donors.toLocaleString()} ${stats.donors === 1 ? 'person has' : 'people have'} chipped in so far.`
        : 'Nobody has chipped in yet — you would be the first.'}
    </p>

    {tiers.length > 0 && <div className="give-tiers">
      {tiers.map((tier) => <a
        key={tier.amount} className="give-tier" href={tier.url || DONATE_URL} target="_blank" rel="noopener noreferrer"
      >${tier.amount}</a>)}
      {DONATE_URL && <a className="give-tier is-open" href={DONATE_URL} target="_blank" rel="noopener noreferrer">Any amount</a>}
    </div>}

    {donors?.length > 0 && <div className="give-board">
      <span className="tiny-caps">Most generous so far</span>
      <ol>
        {donors.map((donor, place) => <li key={`${donor.display_name}-${place}`}>
          <i className={place === 0 ? 'top' : ''}>{place + 1}</i>
          <b>{donor.display_name}</b>
          <span>{money(donor.amount_cents)}</span>
        </li>)}
      </ol>
    </div>}
  </div>;
}
