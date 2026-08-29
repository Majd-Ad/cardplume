import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Brand, Button, Icon, SectionLabel } from './ui';
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_WHATSAPP, DONATE_URL, SOCIAL_HANDLE, SOCIAL_INSTAGRAM, SUPPORT_METHODS } from './config';
import CardCanvas from './studio/CardCanvas';
import CardStudio from './studio/Studio';
import { applyTemplate, initialDesign, templates } from './studio/model';
import { AccountMenu, AccountProvider, AuthDialog, ProjectsPage, ResetPage } from './AccountUI';
import { DonationGoal, SiteStats } from './Stats';

function Header({ onOpenStudio, onOpenAuth }) {
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const close = () => setOpen(false);
  const createCard = () => {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(() => onOpenStudio(), 360);
  };
  const navItem = (to, label, end = false) => <NavLink end={end} onClick={close} to={to} className={({ isActive }) => isActive ? 'active-link' : undefined}>{label}</NavLink>;
  return <header className="site-header"><nav className="nav shell" aria-label="Main navigation"><Brand /><div className={`nav-links ${open ? 'is-open' : ''}`}>{navItem('/', 'Home', true)}{navItem('/studio', 'Studio')}{navItem('/projects', 'Projects')}{navItem('/cafes', 'For cafés')}{navItem('/support', 'Support')}{navItem('/faq', 'FAQ')}{navItem('/contact', 'Contact')}<Button className={`mobile-nav-cta create-card-button ${launching ? 'is-launching' : ''}`} icon="arrow" onClick={() => { close(); createCard(); }}>Create a card</Button></div><div className="nav-actions"><AccountMenu onOpenAuth={onOpenAuth} /><Button className={`create-card-button ${launching ? 'is-launching' : ''}`} icon="arrow" onClick={createCard}>Create a card</Button></div><button className="menu-button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} size={22} /></button></nav><ScrollProgress /></header>;
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <div className="scroll-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>;
}

/* Three real cards, rendered by the same CardCanvas the studio uses, so the landing page is
   showing the actual product rather than a drawing of it. The stack cycles on its own and
   tilts toward the pointer; both stop dead under prefers-reduced-motion. */
function HeroDeck() {
  const deck = useMemo(() => [
    { label: 'Midnight gold', design: applyTemplate({ ...initialDesign, name: 'Cardplume', role: 'Design studio', website: 'cardplume.tech', email: 'hello@cardplume.tech', logoText: 'CP' }, templates.find((item) => item.id === 'noir')) },
    { label: 'Business card', design: applyTemplate({ ...initialDesign, name: 'Abdessamad Majdoubi', role: 'Creative director', website: 'cardplume.tech' }, templates.find((item) => item.id === 'studio')) },
    { label: 'Loyalty card', design: applyTemplate({ ...initialDesign, brand: 'ROAST & RITUAL', reward: 'Free coffee after 8 visits', stamps: 5 }, templates.find((item) => item.id === 'coffee')) },
    { label: 'Membership card', design: applyTemplate({ ...initialDesign, name: 'Studio Nord', role: 'Member since 2026', website: 'cardplume.tech' }, templates.find((item) => item.id === 'member')) },
  ], []);
  const [front, setFront] = useState(0);
  const [picked, setPicked] = useState(0);
  const [ready, setReady] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const rootRef = useRef(null);
  const frame = useRef(0);
  /* Choosing a card restarts the clock. Without this the deck can rotate away a moment after
     someone deliberately picked something, which feels broken rather than alive. */
  const show = (index) => { setFront(index); setPicked(Date.now()); };
  /* Clicking the card already on top turns it over instead of re-selecting it. */
  const tap = (index) => (index === front ? setFlipped((on) => !on) : show(index));
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const sync = () => setStill(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (still) return undefined;
    const timer = window.setInterval(() => setFront((current) => (current + 1) % deck.length), 5600);
    return () => window.clearInterval(timer);
  }, [deck.length, still, picked]);

  /* Every card shows its face, turns over to prove there is a real back, then hands over to
     the next one. Showing both sides unprompted is the clearest evidence the editor is not a
     picture of a product. */
  useEffect(() => {
    setFlipped(false);
    if (still) return undefined;
    const turn = window.setTimeout(() => setFlipped(true), 2700);
    return () => window.clearTimeout(turn);
  }, [front, picked, still]);

  /* Written straight onto the node as custom properties instead of through state. A pointer
     move fires dozens of times a second, and a React render per event is what makes a tilt
     feel like it is dragging behind the cursor. One rAF, no re-render, no lag. */
  const follow = (event) => {
    const node = rootRef.current;
    if (still || !node) return;
    const box = node.getBoundingClientRect();
    const across = (event.clientX - box.left) / box.width;
    const down = (event.clientY - box.top) / box.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.style.setProperty('--tilt-x', `${(0.5 - down) * 15}deg`);
      node.style.setProperty('--tilt-y', `${(across - 0.5) * 23}deg`);
      node.style.setProperty('--glare-x', `${across * 100}%`);
      node.style.setProperty('--glare-y', `${down * 100}%`);
      node.style.setProperty('--lift', '1');
    });
  };

  const settle = () => {
    const node = rootRef.current;
    cancelAnimationFrame(frame.current);
    if (!node) return;
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
    node.style.setProperty('--lift', '0');
  };

  /* A beat before the cards rise, so the entrance is not competing with the fonts loading. */
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 90);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame.current); };
  }, []);

  return <div
    ref={rootRef}
    className={`hero-deck ${still ? 'is-still' : ''} ${ready ? 'is-ready' : ''}`}
    onPointerMove={follow}
    onPointerLeave={settle}
  >
    {/* Float and tilt are separate layers on purpose: one element cannot run a looping
        transform animation and hold a pointer-driven transform at the same time. */}
    <div className="hero-deck-float">
      <div className="hero-deck-stage">
        {deck.map((item, index) => {
          const place = (index - front + deck.length) % deck.length;
          const showingBack = place === 0 && flipped;
          return <button
            key={item.label}
            className={`hero-deck-card place-${place}${showingBack ? ' is-flipped' : ''}`}
            style={{ zIndex: deck.length - place }}
            onClick={() => tap(index)}
            aria-label={place === 0 ? `${item.label} — turn it over` : `Show the ${item.label}`}
            aria-current={place === 0}
          >
            <span className="card-flip">
              <span className="card-side">
                <CardCanvas design={item.design} side="front" compact />
                <i className="deck-glare" />
                <i className="deck-sheen" />
              </span>
              <span className="card-side is-back">
                <CardCanvas design={item.design} side="back" compact />
                <i className="deck-glare" />
              </span>
            </span>
          </button>;
        })}
      </div>
      <div className="deck-shadow" aria-hidden="true" />
    </div>
    <div className="deck-rail">
      <span className="deck-label">{deck[front].label} · {flipped ? 'back' : 'front'}</span>
      <span className="deck-dots">{deck.map((item, index) => <button
        key={item.label} className={index === front ? 'on' : ''}
        onClick={() => show(index)} aria-label={`Show the ${item.label}`}
      />)}</span>
    </div>
  </div>;
}

function Hero({ onOpenStudio }) {
  return <section className="hero" id="top"><div className="hero-lines" /><div className="shell hero-content"><p className="eyebrow">THE CARD CREATOR, REIMAGINED</p><h1>Make a card<br /><em>worth keeping.</em></h1><p className="hero-copy">A creative playground for business cards, loyalty cards, and every little card that helps your brand stay in someone’s pocket.</p><div className="hero-actions"><Button icon="arrow" onClick={onOpenStudio}>Start designing</Button><Link className="quiet-link" to="/cafes">For cafés and shops <Icon name="arrow" size={15} /></Link></div><HeroDeck /><SiteStats /></div></section>;
}

function FeatureGrid() { const features = [{ icon: 'spark', number: '01', title: 'Make it unmistakably yours.', text: 'Colors, type, photography, QR codes, and layouts that feel like your brand—not a template.' }, { icon: 'download', number: '02', title: 'Ready in every format.', text: 'Download a crisp PNG, share a live link, or get a print-ready design for your favorite printer.' }, { icon: 'lock', number: '03', title: 'Built to stay useful.', text: 'From a first hello to the eighth coffee, your card keeps working after it leaves your hand.' }]; return <section className="feature-section"><div className="shell"><SectionLabel>NOT JUST A PRETTY CARD</SectionLabel><div className="feature-heading"><h2>Small surface.<br /><em>Big energy.</em></h2><p>Cardplume makes the tiny details feel intentional—because those details are often where people decide whether to remember you.</p></div><div className="feature-grid">{features.map((feature) => <article key={feature.number}><div className="feature-icon"><Icon name={feature.icon} size={22} /></div><span>{feature.number}</span><h3>{feature.title}</h3><p>{feature.text}</p><a href="#studio">Explore <Icon name="arrow" size={15} /></a></article>)}</div></div></section>; }

function CardTypes() { return <section className="types-section"><div className="shell"><div className="type-heading"><SectionLabel light>ONE PLATFORM, MANY CARDS</SectionLabel><h2>There’s a card<br />for <em>that.</em></h2><a href="#studio" className="quiet-link light-quiet">Start with your idea <Icon name="arrow" size={15} /></a></div><div className="type-grid"><article className="type-card type-business"><div className="category-top"><span>01</span><span>BUSINESS</span></div><div className="type-card-mock type-mock-business"><small>THE FIRST HELLO</small><strong>HELLO,<br />I'M ZURI.</strong><i /></div><h3>Business cards</h3><p>Trade bland contact details for a conversation starter.</p></article><article className="type-card type-loyalty"><div className="category-top"><span>02</span><span>LOYALTY</span></div><div className="type-card-mock type-mock-loyalty"><small>SAINT ROASTERS</small><div>{[1, 2, 3, 4, 5].map((number) => <i key={number}>✦</i>)}<i>+</i></div><strong>5 / 8</strong></div><h3>Loyalty cards</h3><p>Bring customers back without asking them to download another app.</p></article><article className="type-card type-membership"><div className="category-top"><span>03</span><span>MEMBERSHIP</span></div><div className="type-card-mock type-mock-member"><small>MEMBERS ONLY</small><strong>CLUB<br />MORNING</strong><span>• 2026 •</span></div><h3>Membership & gift</h3><p>Make every invitation, membership, and gift feel considered.</p></article></div></div></section>; }

function LoyaltySection({ onOpenStudio }) { return <section className="loyalty-section" id="loyalty"><div className="shell loyalty-wrap"><div className="loyalty-copy"><SectionLabel>MADE FOR CAFÉS & SHOPS</SectionLabel><h2>Give your regulars<br />something <em>better</em><br />to come back to.</h2><p>Set up a beautiful digital stamp card, put it in their phone wallet, and turn every visit into a little reason to return.</p><ul><li><span><Icon name="check" size={15} /></span>No app download for customers</li><li><span><Icon name="check" size={15} /></span>QR-based signup and simple stamps</li><li><span><Icon name="check" size={15} /></span>Your logo, colors, rewards, and rules</li></ul><Button icon="arrow" onClick={onOpenStudio}>Build a loyalty card</Button></div><div className="loyalty-visual"><div className="visual-orbit orbit-a" /><div className="visual-orbit orbit-b" /><div className="wallet-phone"><div className="phone-notch" /><div className="phone-status"><span>9:41</span><span>● ◒ ▰</span></div><div className="wallet-title"><span>Wallet</span><span className="wallet-add" aria-hidden="true">+</span></div><div className="wallet-pass"><div className="wallet-logo">SAINT<br />ROASTERS</div><small>COFFEE CLUB</small><div className="wallet-stamps">{[1, 2, 3, 4, 5, 6, 7, 8].map((stamp) => <i key={stamp} className={stamp < 6 ? 'done' : ''}>{stamp < 6 ? '✦' : '+'}</i>)}</div><b>5 / 8 COFFEES</b><span>Free coffee after 8 visits</span></div><p>Tap for details</p></div><div className="scan-tag"><span><Icon name="qr" size={18} /></span><p><b>One scan</b><br />to join the club</p></div></div></div></section>; }

function Steps() { return <section className="steps-section"><div className="shell"><div className="steps-heading"><div><SectionLabel>FROM IDEA TO HAND</SectionLabel><h2>Good things<br />come in <em>small formats.</em></h2></div><p>Whether you are launching a brand or rewarding your hundredth regular, the first version is only a few thoughtful choices away.</p></div><div className="steps-list">{[['01', 'Choose your canvas', 'Pick a card type, then start with a mood, a template, or a completely blank space.'], ['02', 'Make every detail yours', 'Bring in your logo, image, colors, and the exact words you want people to remember.'], ['03', 'Put it out into the world', 'Export for print, share online, or build a loyalty experience your customers can save.']].map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p><Icon name="arrow" size={19} /></article>)}</div></div></section>; }

/* One button per route rather than one checkout, because no single processor reaches
   everyone. A Moroccan debit card is issued for domestic use and gets turned away by a
   foreign checkout; a donor in Berlin cannot walk into a Cash Plus branch. Splitting the
   ask by where the donor is means neither of them hits a wall.

   Routes with nothing filled in are left out, and a heading disappears with its last
   route — so this grows on its own as accounts in config.js come online. */
function SupportMethods() {
  const [copied, setCopied] = useState('');

  /* The confirmation is a label swap, not a toast, so it undoes itself. */
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(''), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  /* Clipboard access is refused outright on an insecure origin and in some embedded
     browsers. The number stays on screen either way, so a failure costs the donor a
     tap-and-hold rather than the route itself. */
  const copy = async (method) => {
    try {
      await navigator.clipboard.writeText(method.copy);
      setCopied(method.id);
    } catch { setCopied(''); }
  };

  const ready = (method) => method.href || method.copy || method.soon;
  const groups = [
    ['FROM ANYWHERE', SUPPORT_METHODS.filter((method) => method.reach === 'world' && ready(method))],
    ['FROM INSIDE MOROCCO', SUPPORT_METHODS.filter((method) => method.reach === 'morocco' && ready(method))],
  ].filter(([, list]) => list.length > 0);

  if (groups.length === 0) return <p className="plan-intro"><em>Support opens shortly.</em></p>;

  /* A route that only opens the donor's mail client cannot be a new tab — target="_blank"
     on a mailto leaves a blank window behind on most browsers. */
  const away = (href) => (href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {});

  return <div className="ways">
    {groups.map(([heading, list]) => <div className="ways-group" key={heading}>
      <span className="tiny-caps">{heading}</span>
      {list.map((method) => {
        if (method.soon) return <div className="way is-soon" key={method.id}>
          <b>{method.name}</b><span>{method.note}</span><em>SOON</em>
        </div>;
        if (method.href) return <a className="way" key={method.id} href={method.href} {...away(method.href)}>
          <b>{method.name}</b><span>{method.note}</span><Icon name="arrow" size={15} />
        </a>;
        return <button className="way" key={method.id} type="button" onClick={() => copy(method)}>
          <b>{method.name}</b>
          <span>{copied === method.id ? 'Copied to your clipboard' : `${method.note} ${method.copy}`}</span>
          <Icon name={copied === method.id ? 'check' : 'copy'} size={15} />
        </button>;
      })}
    </div>)}
    {/* WhatsApp first because it is the one that always opens. The address beside it is
        printed in full rather than hidden behind the word "email", so it is still useful
        to read and copy on a machine where clicking a mailto does nothing. */}
    <p className="ways-note">
      Or reach me directly — <a href={CONTACT_WHATSAPP} target="_blank" rel="noopener noreferrer">WhatsApp {CONTACT_PHONE}</a>
      {' · '}<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </p>
  </div>;
}

/* There are no plans and no paywall. Donations are the whole business model, so this page
   asks plainly instead of dressing an ask up as a pricing table. */
function Support({ onOpenStudio }) {
  const spend = [
    'Keeps the site online and the domain paid',
    'Buys time for new templates, fonts and card sizes',
    'Funds what is still on the list — wallet passes, shareable card links',
  ];
  return <section className="pricing-section" id="support"><div className="shell">
    <div className="pricing-heading">
      <div><SectionLabel light>SUPPORT CARDPLUME</SectionLabel><h2>Free to use.<br />Free to <em>keep using.</em></h2></div>
      <p>No plans, no accounts, no paywall. Every template, font, export and loyalty card is open to everyone. If it saved you a trip to the print shop, you can chip in — that is the whole business model.</p>
    </div>
    <div className="pricing-grid">
      <article className="pricing-card">
        <span className="plan-name">Where it goes</span>
        <h3>Straight into<small> the work</small></h3>
        <p className="plan-intro">Cardplume is one person and a domain renewal. Nothing here is venture funded, so support is what decides how fast it grows.</p>
        <Button className="wide" icon="arrow" onClick={() => onOpenStudio?.()}>Open the studio</Button>
        <ul>{spend.map((item) => <li key={item}><Icon name="check" size={15} />{item}</li>)}</ul>
      </article>
      <article className="pricing-card featured">
        <div className="popular-tag">THANK YOU</div>
        <span className="plan-name">Give what you like</span>
        {/* Patreon bills monthly; every other route here is a single payment. Claiming one
            of the two on a page offering both would be false for half the donors. */}
        <h3>Any amount<small> · once or monthly</small></h3>
        <p className="plan-intro">Take whichever route works where you are — you choose the amount on the other side, and no card details ever touch this site.</p>
        <SupportMethods />
        <DonationGoal />
        <ul>
          <li><Icon name="check" size={15} />Stop whenever you like, from the provider’s own page</li>
          <li><Icon name="check" size={15} />Nothing changes about what you can use</li>
        </ul>
      </article>
    </div>
    <p className="pricing-footnote">Cardplume has nothing behind a payment · Give only if you want to</p>
  </div></section>;
}

function Faq() {
  const questions = [
    { q: 'Can I really make any type of card?', a: 'You can start with business, loyalty, membership, gift, and payment-card-inspired mockup designs. Actual bank cards require licensed issuing partners and are not part of Cardplume.' },
    { q: 'Can I use my own logo and image?', a: 'Yes. Upload JPG, PNG, or WebP images up to 5 MB. Make sure you have permission to use every image and logo you upload.' },
    { q: 'What does Cardplume cost?', a: 'Nothing. There is no plan to pick, no trial to start and no feature held back — the studio you see is the whole product. If you would like to support the work there is a donation link, and giving changes nothing about what you can use.' },
    { q: 'What can I download?', a: 'A high-resolution PNG, or a print-ready PDF with 3 mm bleed and crop marks — front, back, or both sides as separate files. Shareable card links and wallet passes are still on the list.' },
    { q: 'Will my designs stay saved?', a: 'Your draft and saved designs are kept in this browser using local storage. Cloud sync across devices will be available when accounts are introduced.' },
    { q: 'Do I need an account?', a: 'No. Everything runs in your browser, and your designs are kept in this browser using local storage — nothing is uploaded. Accounts will only arrive alongside syncing designs between devices.' },
  ];
  const [open, setOpen] = useState(0);

  return <section className="faq-section" id="faq"><div className="shell faq-grid"><div><SectionLabel>GOOD QUESTIONS</SectionLabel><h2>Everything you<br />need to <em>know.</em></h2><p>Still curious? <Link to="/contact">Say hello to the Cardplume team.</Link></p></div><div className="faq-list">{questions.map((item, index) => { const answerId = `faq-answer-${index}`; const isOpen = open === index; return <article className={isOpen ? 'open' : ''} key={item.q}><button onClick={() => setOpen(isOpen ? -1 : index)} aria-expanded={isOpen} aria-controls={answerId}><span>{item.q}</span><Icon name={isOpen ? 'close' : 'plus'} size={18} /></button><div className="faq-answer" id={answerId} role="region"><p>{item.a}</p></div></article>; })}</div></div></section>;
}

/* No backend, so the form cannot post anywhere. Rather than fake a submission, it composes
   the message and hands it to the visitor's own mail client — and says so on the page. */
function Contact({ onToast }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const send = (event) => {
    event.preventDefault();
    const subject = `Cardplume — ${form.name ? `message from ${form.name}` : 'a message'}`;
    const body = `${form.message}\n\n—\n${form.name}\n${form.email}`;
    /* An anchor click rather than assigning location.href: some embedded and mobile
       browsers refuse a scripted location change to a non-http scheme but honour a real
       link click, and it keeps the page from being navigated away from. */
    const link = document.createElement('a');
    link.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    link.rel = 'noopener';
    link.click();
    onToast?.('Opening your email app with the message ready to send.');
  };

  const line = (icon, title, label, href) => <li key={title}>
    {href
      ? <a href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <i><Icon name={icon} size={15} /></i><span className="contact-text"><b>{title}</b><small>{label}</small></span>
      </a>
      : <div><i><Icon name={icon} size={15} /></i><span className="contact-text"><b>{title}</b><small>{label}</small></span></div>}
  </li>;

  return <section className="contact-page"><div className="shell contact-grid">
    <div className="contact-copy">
      <SectionLabel>SAY HELLO</SectionLabel>
      <h1>Tell us what<br />you’re <em>making.</em></h1>
      <p>A question, a bug, a template you wish existed, or a café that wants a hand setting up loyalty cards — all of it is welcome, and it all reaches the same inbox.</p>
      <ul className="contact-lines">
        {line('mail', CONTACT_EMAIL, 'Email')}
        {line('at', SOCIAL_HANDLE, 'Instagram', SOCIAL_INSTAGRAM)}
        {line('send', CONTACT_PHONE, 'WhatsApp', CONTACT_WHATSAPP)}
        {line('heart', 'Support Cardplume', 'Keep it free for everyone', DONATE_URL || undefined)}
      </ul>
    </div>
    <form className="contact-form" onSubmit={send}>
      <div className="form-field"><label htmlFor="contact-name">Your name</label><input id="contact-name" value={form.name} onChange={set('name')} autoComplete="name" required /></div>
      <div className="form-field"><label htmlFor="contact-email">Email</label><input id="contact-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
      <div className="form-field"><label htmlFor="contact-message">Message</label><textarea id="contact-message" value={form.message} onChange={set('message')} required placeholder="What can we help with?" /></div>
      <Button type="submit" className="wide" icon="send">Send message</Button>
      <p className="contact-note"><Icon name="lock" size={13} />There is no server behind this form. Sending opens your own email app with everything filled in, so nothing you type here is stored or transmitted by this site.</p>
    </form>
  </div></section>;
}

function Toast({ message }) { return message ? <div className="toast" role="status"><Icon name="check" size={16} />{message}</div> : null; }

function Reveal({ children, delay = 0, className = '' }) {
  const elementRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.unobserve(entry.target); }
    }, { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={elementRef} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>{children}</div>;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function CafeHero({ onOpenStudio }) {
  const demo = applyTemplate({ ...initialDesign, brand: 'ROAST & RITUAL' }, templates.find((item) => item.id === 'coffee'));
  return <section className="cafe-page-hero"><div className="shell cafe-page-hero-wrap"><div className="cafe-page-copy"><SectionLabel>FOR CAFÉS, BAKERIES & SMALL SHOPS</SectionLabel><h1>Make every regular<br />feel <em>remembered.</em></h1><p>Build a digital loyalty card your customers can save to their wallet, scan at the counter, and come back for.</p><div className="hero-actions"><Button icon="arrow" onClick={() => onOpenStudio('loyalty')}>Create loyalty card</Button><Link className="quiet-link" to="/faq">How it works <Icon name="arrow" size={15} /></Link></div><div className="cafe-hero-stats"><div><strong>2 min</strong><span>to set up</span></div><div><strong>0 apps</strong><span>for customers</span></div><div><strong>1 scan</strong><span>to join</span></div></div></div><div className="cafe-hero-preview"><div className="cafe-preview-note note-top">YOUR BRAND<br />IN THEIR WALLET</div><CardCanvas design={demo} compact /><div className="cafe-preview-note note-bottom"><Icon name="qr" size={18} /> SCAN TO JOIN</div></div></div></section>;
}

function CafeFlow({ onOpenStudio }) {
  const steps = [['01', 'Create your club', 'Set your reward, card colors, logo, and the number of visits it takes to unlock a treat.'], ['02', 'Let people join fast', 'Put one QR code by the counter. Customers save the card to their phone in seconds.'], ['03', 'Make each visit count', 'Staff scan or stamp. Your regulars see the next reward getting closer.']];
  return <section className="cafe-flow"><div className="shell"><div className="cafe-flow-heading"><div><SectionLabel>THE SIMPLE LOOP</SectionLabel><h2>More return visits,<br /><em>less admin.</em></h2></div><p>Made for busy teams who want a loyalty programme that does not get in the way of serving great coffee.</p></div><div className="cafe-flow-grid">{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><div className="flow-line" /></article>)}</div><div className="cafe-flow-cta"><div><span className="tiny-caps">READY WHEN YOU ARE</span><h3>Your next regular is one good card away.</h3></div><Button icon="arrow" onClick={() => onOpenStudio('loyalty')}>Build it now</Button></div></div></section>;
}

function RoutedFooter() {
  return <footer className="site-footer"><div className="shell"><div className="footer-top"><div><Brand /><h2>Cards with<br /><em>character.</em></h2></div><Button to="/studio" className="button-light" icon="arrow">Make a card</Button></div><div className="footer-bottom"><span>© 2026 Cardplume. Made for independent ideas.</span><div>{/* the page, not one provider — a Moroccan card cannot pay whichever rail happens to be first */}<Link to="/support">Support Cardplume</Link><a href={SOCIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer">Instagram</a><Link to="/contact">Contact</Link><Link to="/faq">Help</Link></div></div></div></footer>;
}

function HomePage({ onOpenStudio }) {
  return <><Reveal><Hero onOpenStudio={onOpenStudio} /></Reveal><Reveal><FeatureGrid /></Reveal><Reveal><CardTypes /></Reveal><Reveal><Steps /></Reveal></>;
}

function StudioPage({ onToast, onRequireAccount }) { return <CardStudio onToast={onToast} onRequireAccount={onRequireAccount} />; }

function CafesPage({ onOpenStudio }) {
  return <><Reveal><CafeHero onOpenStudio={onOpenStudio} /></Reveal><Reveal><LoyaltySection onOpenStudio={() => onOpenStudio('loyalty')} /></Reveal><Reveal><CafeFlow onOpenStudio={onOpenStudio} /></Reveal></>;
}

function SupportPage({ onOpenStudio }) { return <Reveal><Support onOpenStudio={onOpenStudio} /></Reveal>; }

function FaqPage() { return <Reveal><Faq /></Reveal>; }

function NotFoundPage() { return <section className="not-found"><div className="shell"><SectionLabel>404 / LOST IN THE STACK</SectionLabel><h1>This card isn’t<br /><em>in the deck.</em></h1><p>Let’s take you back somewhere useful.</p><Button to="/" icon="arrow">Back home</Button></div></section>; }

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState('');
  const [auth, setAuth] = useState(null);   /* null | 'login' | 'signup' */
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const openStudio = (type) => navigate(type === 'loyalty' ? '/studio?type=loyalty' : '/studio');

  useEffect(() => {
    if (location.pathname === '/support' && location.hash === '#faq') {
      navigate('/faq', { replace: true });
      return;
    }
    const interceptLegacyLinks = (event) => {
      const anchor = event.target.closest('a[href]');
      const routes = { '#studio': '/studio', '#loyalty': '/cafes', '#pricing': '/support', '#faq': '/faq', '#top': '/' };
      if (anchor && routes[anchor.getAttribute('href')]) { event.preventDefault(); navigate(routes[anchor.getAttribute('href')]); }
    };
    document.addEventListener('click', interceptLegacyLinks);
    return () => document.removeEventListener('click', interceptLegacyLinks);
  }, [location.hash, location.pathname, navigate]);

  return <><ScrollToTop /><Header onOpenStudio={openStudio} onOpenAuth={setAuth} /><main><Routes><Route path="/" element={<HomePage onOpenStudio={openStudio} />} /><Route path="/studio" element={<StudioPage onToast={showToast} onRequireAccount={() => setAuth('login')} />} /><Route path="/projects" element={<Reveal><ProjectsPage onToast={showToast} /></Reveal>} /><Route path="/cafes" element={<CafesPage onOpenStudio={openStudio} />} /><Route path="/support" element={<SupportPage onOpenStudio={openStudio} />} />{/* anything still pointing at the old pricing page lands on Support rather than a 404 */}<Route path="/pricing" element={<Navigate to="/support" replace />} /><Route path="/faq" element={<FaqPage />} /><Route path="/contact" element={<Reveal><Contact onToast={showToast} /></Reveal>} /><Route path="/reset" element={<ResetPage onToast={showToast} />} /><Route path="*" element={<NotFoundPage />} /></Routes></main>{location.pathname !== '/studio' && <RoutedFooter />}<AuthDialog
    open={auth !== null} mode={auth ?? 'login'} onClose={() => setAuth(null)}
    onDone={(message, adopted) => showToast(adopted ? `${message} ${adopted} earlier design${adopted === 1 ? '' : 's'} moved into your projects.` : message)}
  /><Toast message={toast} /></>;
}

export default function App() {
  return <BrowserRouter><AccountProvider><AppShell /></AccountProvider></BrowserRouter>;
}
