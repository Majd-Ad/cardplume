import { Link } from 'react-router-dom';
import {
  ArrowRight, AtSign, Check, ChevronDown, ChevronUp, ClipboardPaste, Circle, Copy, Download, Eye,
  EyeOff, Heart, IdCard, Image, Lock, LockOpen, Mail, MapPin, Menu, Minus, Palette, Play, Plus,
  QrCode, RefreshCw, Redo2, RotateCw, Save, Send, Shapes, Sparkles, Trash2, Type, Undo2, X,
} from 'lucide-react';
import { DONATE_URL } from './config';

/* Lucide, imported one icon at a time so the bundle only carries the ones actually used.
   The map keeps the old call sites working: <Icon name="arrow" /> is unchanged everywhere. */
const glyphs = {
  arrow: ArrowRight, spark: Sparkles, chevron: ChevronDown, menu: Menu, close: X,
  download: Download, save: Save, refresh: RefreshCw, undo: Undo2, redo: Redo2,
  image: Image, type: Type, palette: Palette, qr: QrCode, check: Check,
  lock: Lock, unlock: LockOpen, play: Play, plus: Plus, minus: Minus, paste: ClipboardPaste,
  eye: Eye, eyeOff: EyeOff, trash: Trash2, copy: Copy, up: ChevronUp, down: ChevronDown,
  rotate: RotateCw, circle: Circle, shape: Shapes, heart: Heart,
  card: IdCard, mail: Mail, send: Send, at: AtSign, pin: MapPin,
};

export function Icon({ name, size = 18, stroke = 1.9 }) {
  const Glyph = glyphs[name];
  return Glyph ? <Glyph size={size} strokeWidth={stroke} aria-hidden="true" /> : null;
}

/* The trailing icon sits in a fixed-size slot holding two glyphs. When the green wave finishes
   crossing the button, the arrow leaves to the right and a card springs up in its place — the
   slot never changes size, so nothing on the page moves while it happens. */
export function Button({ children, className = '', icon, onClick, href, to, type = 'button', disabled }) {
  const content = <>
    <span className="button-label">{children}</span>
    {icon && <span className="button-icon">
      <i className="icon-out"><Icon name={icon} size={16} /></i>
      <i className="icon-in"><Icon name="card" size={16} /></i>
    </span>}
  </>;
  if (to) return <Link className={`button ${className}`} to={to}>{content}</Link>;
  return href ? <a className={`button ${className}`} href={href}>{content}</a>
    : <button type={type} className={`button ${className}`} onClick={onClick} disabled={disabled}>{content}</button>;
}

/* The mark: a card with a plume rising out of it.
 *
 * Drawn inline rather than loaded as a file so it stays sharp at any size, costs no request,
 * and — the part that actually matters — can take its colour from the text around it. The
 * old four-square mark used a fixed orange, which meant half of it vanished against the
 * orange footer. Here the card and the outlines are currentColor, so the mark is legible on
 * cream, on ink and on orange without a second copy of the artwork. */
export function Brand() {
  return <Link className="brand" to="/" aria-label="Cardplume home">
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <rect className="mark-card" x="2.6" y="10.6" width="18.4" height="13" rx="2.8" />
        <g className="mark-quill">
          <path className="mark-plume" d="M12.6 23.6C14.9 15.5 20.3 8.7 28.2 4.8c-1.7 8.7-6.7 15.5-15.6 18.8Z" />
          <path className="mark-spine" d="M13 23.4C17.4 18.2 22.4 11.4 27.6 5.4" />
        </g>
        <circle className="mark-nib" cx="12.7" cy="23.5" r="2" />
      </svg>
    </span>
    card<span>plume</span>
  </Link>;
}

export function SectionLabel({ children, light = false }) {
  return <p className={`section-label ${light ? 'light-label' : ''}`}>{children}</p>;
}

/* Renders nothing until a real Payment Link is set in config.js — better a missing button
   than one that sends someone to a dead checkout. */
export function DonateButton({ className = '', children = 'Support Cardplume' }) {
  if (!DONATE_URL) return null;
  return <a className={`button donate-button ${className}`} href={DONATE_URL} target="_blank" rel="noopener noreferrer">
    <span className="button-label">{children}</span>
    <span className="button-icon">
      <i className="icon-out"><Icon name="heart" size={16} /></i>
      <i className="icon-in"><Icon name="card" size={16} /></i>
    </span>
  </a>;
}
