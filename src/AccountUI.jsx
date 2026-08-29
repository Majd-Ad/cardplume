import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, SectionLabel } from './ui';
import CardCanvas from './studio/CardCanvas';
import { migrateDesign } from './studio/model';
import * as store from './account';
import { Wordmark } from './wordmark';

/* ---- provider -------------------------------------------------------------- */

const AccountContext = createContext(null);
export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children }) {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const pull = useCallback(async (next) => {
    setSession(next);
    if (!next) { setProjects([]); return; }
    try { setProjects(await store.loadProjects(next)); } catch { setProjects([]); }
  }, []);

  /* One read on load, then follow Supabase: a token refresh, a sign-out in another tab, or a
     confirmation link being opened all arrive here rather than needing a reload. */
  useEffect(() => {
    let alive = true;
    store.currentSession()
      .then((found) => { if (alive) return pull(found); return undefined; })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [pull]);

  /* Re-subscribed whenever the signed-in person changes: a token refresh, a sign-out in
     another tab, or a confirmation link being opened all land here. Skipped entirely while
     signed out, which is what keeps the auth bundle off a first visit. */
  useEffect(() => {
    if (!session || session.guest) return undefined;
    return store.onAuthChange((next) => {
      if (next?.id !== sessionRef.current?.id) pull(next);
    });
  }, [session, pull]);

  const afterSignIn = useCallback(async (next) => {
    const adopted = await store.adoptLocalWork(next);
    await pull(next);
    return adopted;
  }, [pull]);

  const guard = useCallback(async (work) => {
    setBusy(true);
    try { return await work(); } finally { setBusy(false); }
  }, []);

  const value = useMemo(() => ({
    session,
    projects,
    ready,
    busy,
    canSignUp: store.canSignUp,
    signUp: (email, password, name) => guard(async () => {
      const result = await store.signUp(email, password, name);
      if (result.pending) return { pending: result.pending };
      return { adopted: await afterSignIn(result.session) };
    }),
    logIn: (email, password) => guard(async () => {
      const { session: next } = await store.logIn(email, password);
      return { adopted: await afterSignIn(next) };
    }),
    continueAsGuest: () => pull(store.startGuest()),
    requestPasswordReset: (email) => guard(() => store.requestPasswordReset(email)),
    setNewPassword: (password) => guard(async () => {
      const next = await store.setNewPassword(password);
      await pull(next);
      return next;
    }),
    signOut: async () => { await store.signOut(); await pull(null); },
    saveProject: async (design, options) => {
      const result = await store.putProject(session, design, options);
      setProjects(result.projects);
      return result.id;
    },
    removeProject: async (id) => setProjects(await store.removeProject(session, id)),
    renameProject: async (id, title) => setProjects(await store.renameProject(session, id, title)),
    duplicateProject: async (id) => setProjects(await store.duplicateProject(session, id)),
  }), [afterSignIn, busy, guard, projects, pull, ready, session]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/* ---- sign in / sign up ----------------------------------------------------- */

export function AuthDialog({ open, mode = 'login', onClose, onDone }) {
  const { logIn, signUp, continueAsGuest, requestPasswordReset, canSignUp, busy } = useAccount();
  const [tab, setTab] = useState(mode);
  const [sent, setSent] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const firstField = useRef(null);

  useEffect(() => { if (open) { setTab(mode); setError(''); setPending(''); setSent(''); setPassword(''); } }, [open, mode]);
  useEffect(() => { if (open && !pending) window.setTimeout(() => firstField.current?.focus(), 30); }, [open, tab, pending]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      if (tab === 'forgot') {
        setSent(await requestPasswordReset(email));
        return;
      }
      const result = tab === 'signup' ? await signUp(email, password, name) : await logIn(email, password);
      if (result?.pending) { setPending(result.pending); return; }
      onDone?.(tab === 'signup' ? 'Account created.' : 'Welcome back.', result?.adopted);
      onClose();
    } catch (problem) {
      setError(problem.message);
    }
  };

  return <div className="modal-veil" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="auth-dialog" role="dialog" aria-modal="true" aria-label={tab === 'signup' ? 'Create an account' : 'Log in'}>
      <button className="dialog-close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      {/* Signed rather than set: whichever way someone arrives here — logging in, creating an
          account, resetting a password — the name is written out in front of them. */}
      <Wordmark className="auth-sign" />

      {pending || sent
        ? <div className="auth-pending">
          <span className="auth-pending-mark"><Icon name="mail" size={22} /></span>
          <h3>Check your inbox</h3>
          {pending
            ? <p>We sent a confirmation link to <b>{pending}</b>. Open it and you are in — this tab will notice on its own.</p>
            : <p>If there is an account for <b>{sent}</b>, a link to set a new password is on its way. The link works once and expires after an hour.</p>}
          <button className="button button-outline wide" onClick={onClose}>Close</button>
        </div>
        : <>
          {tab === 'forgot'
            ? <div className="auth-back">
              <button onClick={() => { setTab('login'); setError(''); }}><Icon name="arrow" size={13} />Back to log in</button>
              <h3>Reset your password</h3>
              <p>Type the email you signed up with and we will send you a link.</p>
            </div>
            : <div className="auth-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'login'} className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>Log in</button>
              <button role="tab" aria-selected={tab === 'signup'} className={tab === 'signup' ? 'active' : ''} onClick={() => { setTab('signup'); setError(''); }}>Create account</button>
            </div>}

          <form onSubmit={submit} className="auth-form">
            {tab === 'signup' && <div className="form-field">
              <label htmlFor="auth-name">Your name</label>
              <input id="auth-name" ref={tab === 'signup' ? firstField : null} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Abdessamad Majdoubi" />
            </div>}
            <div className="form-field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" ref={tab === 'login' ? firstField : null} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" />
            </div>
            {tab !== 'forgot' && <div className="form-field">
              <label htmlFor="auth-password">
                Password
                {tab === 'login' && <button type="button" className="auth-forgot" onClick={() => { setTab('forgot'); setError(''); }}>Forgot?</button>}
              </label>
              <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} required placeholder={tab === 'signup' ? 'At least 8 characters' : ''} />
            </div>}
            {error && <p className="field-error">{error}</p>}
            {!canSignUp && <p className="field-error">Accounts are not configured for this site yet.</p>}
            <Button type="submit" className="wide" icon="arrow" disabled={busy || !canSignUp}>
              {busy ? 'One moment…' : (tab === 'signup' ? 'Create account' : tab === 'forgot' ? 'Send the link' : 'Log in')}
            </Button>
          </form>

          {tab !== 'forgot' && <div className="auth-divider"><span>or</span></div>}
          {tab !== 'forgot' && <button className="button button-outline wide" onClick={() => { continueAsGuest(); onDone?.('Designing as a guest — this work clears when you close the tab.'); onClose(); }}>
            Continue as guest
          </button>}

          {/* The text is one <span> on purpose: .auth-note is a flex row, so a bare <b> in the
              middle of the sentence would become a flex item of its own and break the
              paragraph into columns. */}
          <p className="auth-note">
            <Icon name="lock" size={13} />
            <span>Your cards live in your <b>Cardplume account</b>, so they open on any device you sign in on. A guest session stays in this tab and is wiped the moment you close it.</span>
          </p>
        </>}
    </div>
  </div>;
}

/* Where a reset email lands. Following the link gives this page a short-lived recovery
   session; the new password is only accepted while that session is live. */
export function ResetPage({ onToast }) {
  const { setNewPassword, ready, session, busy } = useAccount();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (password !== again) { setError('The two passwords do not match.'); return; }
    try {
      await setNewPassword(password);
      onToast?.('Password changed. You are signed in.');
      navigate('/projects');
    } catch (problem) {
      setError(problem.message);
    }
  };

  return <section className="projects-page"><div className="shell reset-page">
    <SectionLabel>ACCOUNT</SectionLabel>
    <h1>Set a new<br /><em>password.</em></h1>
    {!ready
      ? <p>Checking your link…</p>
      : !session
        ? <>
          <p>This link has expired or has already been used. Reset links work once and last an hour — ask for a fresh one.</p>
          <Button to="/" icon="arrow">Back to the site</Button>
        </>
        : <form className="contact-form reset-form" onSubmit={submit}>
          <p className="panel-helper">Signed in as <b>{session.email}</b>.</p>
          <div className="form-field">
            <label htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="At least 8 characters" />
          </div>
          <div className="form-field">
            <label htmlFor="reset-again">Type it again</label>
            <input id="reset-again" type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} required />
          </div>
          {error && <p className="field-error">{error}</p>}
          <Button type="submit" className="wide" icon="check" disabled={busy}>{busy ? 'Saving…' : 'Save the new password'}</Button>
        </form>}
  </div></section>;
}

/* ---- header menu ----------------------------------------------------------- */

export function AccountMenu({ onOpenAuth }) {
  const { session, projects, signOut, ready } = useAccount();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!event.target.closest('.account-menu')) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (!ready) return <span className="account-waiting" aria-hidden="true" />;
  if (!session) return <button className="login-button" onClick={() => onOpenAuth('login')}>Sign in</button>;

  const initials = (session.guest ? 'G' : session.name).trim().slice(0, 1).toUpperCase();
  return <div className="account-menu">
    <button className={`account-chip ${session.guest ? 'is-guest' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="account-avatar">{initials}</span>
      <span className="account-who">{session.guest ? 'Guest' : session.name}</span>
      <Icon name="chevron" size={14} />
    </button>
    {open && <div className="account-dropdown">
      <div className="account-head">
        <strong>{session.guest ? 'Designing as a guest' : session.name}</strong>
        <span>{session.guest ? 'Nothing is being saved' : session.email}</span>
      </div>
      <button onClick={() => { setOpen(false); navigate('/projects'); }}><Icon name="save" size={14} />My projects<kbd>{projects.length}</kbd></button>
      {session.guest
        ? <>
          <button onClick={() => { setOpen(false); onOpenAuth('signup'); }}><Icon name="arrow" size={14} />Create an account to keep work</button>
          <button onClick={() => { setOpen(false); signOut(); }}><Icon name="close" size={14} />End guest session</button>
        </>
        : <button onClick={() => { setOpen(false); signOut(); }}><Icon name="close" size={14} />Sign out</button>}
    </div>}
  </div>;
}

/* ---- projects page --------------------------------------------------------- */

export function ProjectsPage({ onToast }) {
  const { session, projects, ready, removeProject, renameProject, duplicateProject } = useAccount();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();

  if (!ready) {
    return <section className="projects-page"><div className="shell projects-empty">
      <SectionLabel>YOUR PROJECTS</SectionLabel>
      <p>Looking for your work…</p>
    </div></section>;
  }

  if (!session) {
    return <section className="projects-page"><div className="shell projects-empty">
      <SectionLabel>YOUR PROJECTS</SectionLabel>
      <h1>Sign in to keep<br />your <em>work.</em></h1>
      <p>Projects saved to an account open on any device you sign in on. Design as a guest if you would rather not — just know the tab closing takes it with it.</p>
      <Button to="/studio" icon="arrow">Open the studio</Button>
    </div></section>;
  }

  const open = (project) => {
    sessionStorage.setItem('cardplume-open-project', JSON.stringify({ id: project.id, title: project.title, design: project.design }));
    navigate('/studio');
  };

  const run = (work, message) => work.then(() => onToast?.(message)).catch((problem) => onToast?.(problem.message));

  return <section className="projects-page"><div className="shell">
    <div className="projects-head">
      <div>
        <SectionLabel>YOUR PROJECTS</SectionLabel>
        <h1>{projects.length ? <>Everything you’ve<br /><em>made so far.</em></> : <>Nothing saved<br /><em>just yet.</em></>}</h1>
      </div>
      <div className="projects-head-side">
        <p>{session.guest
          ? 'You are a guest, so these disappear when this tab closes. Create an account to keep them.'
          : `Saved to your account, ${session.email}. ${projects.length} project${projects.length === 1 ? '' : 's'}, on every device you sign in on.`}</p>
        <Button to="/studio" icon="plus">New card</Button>
      </div>
    </div>

    {!projects.length
      ? <div className="projects-empty-note"><p>Open the studio, design something, and hit <b>Save</b> — it will show up here.</p></div>
      : <div className="projects-grid">{projects.map((project) => <article className="project-card" key={project.id}>
        <button className="project-preview" onClick={() => open(project)} aria-label={`Open ${project.title}`}>
          <CardCanvas design={migrateDesign(project.design)} compact />
        </button>
        <div className="project-meta">
          {editing === project.id
            ? <input
              className="project-rename" value={draft} autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => { run(renameProject(project.id, draft), 'Renamed.'); setEditing(null); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setEditing(null);
              }}
            />
            : <button className="project-title" onClick={() => { setEditing(project.id); setDraft(project.title); }} title="Rename">{project.title}</button>}
          <span className="project-date">{new Date(project.updatedAt).toLocaleDateString()} · {project.design?.type || 'Business'}</span>
        </div>
        <div className="project-actions">
          <button onClick={() => open(project)} title="Open"><Icon name="arrow" size={14} /></button>
          <button onClick={() => run(duplicateProject(project.id), 'Project duplicated.')} title="Duplicate"><Icon name="copy" size={14} /></button>
          <button className="danger" onClick={() => run(removeProject(project.id), 'Project deleted.')} title="Delete"><Icon name="trash" size={14} /></button>
        </div>
      </article>)}</div>}
  </div></section>;
}
