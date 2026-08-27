/* Accounts and saved projects.
 *
 * Two worlds, one interface:
 *
 *   an account  Supabase. Email and password are handled by Supabase Auth, cards live in
 *               Postgres, and row-level security — not this file — is what stops one person
 *               reading another's designs. Work follows you to any device.
 *
 *   a guest     sessionStorage. No account, nothing sent anywhere, and the tab closing takes
 *               it with it. That difference is the entire point of offering the choice.
 *
 * The browser-held account store that used to live here is gone. It could never sync, and
 * "signed in" meant nothing beyond which slice of localStorage was being read.
 */

const URL_BASE = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const canSignUp = Boolean(URL_BASE && ANON_KEY);

/* The Supabase SDK is 60 KB gzipped and most visits never sign in, so it is fetched the first
   time something actually needs it rather than on every page load. The promise is cached, so
   ten callers at once still produce one client and one download. */
let clientPromise = null;
export function client() {
  if (!canSignUp) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_BASE, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}

/* Supabase parks its session under sb-<project-ref>-auth-token. Reading that key directly is
   how we can answer "is anyone signed in?" without downloading the SDK to ask. */
const PROJECT_REF = (URL_BASE.match(/^https?:\/\/([^.]+)\./) || [])[1] || '';
const TOKEN_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : '';
const hasStoredSession = () => {
  try { return Boolean(TOKEN_KEY && localStorage.getItem(TOKEN_KEY)); } catch { return false; }
};
/* A confirmation or reset link comes back with tokens in the hash; the SDK has to be loaded
   for those to be picked up, so they count as a reason too. */
const hasAuthInUrl = () => /[#&](access_token|error_code|type=recovery)/.test(window.location.hash || '');

const SESSION = 'cardplume-session';
const GUEST_PROJECTS = (id) => `cardplume-projects-${id}`;

const read = (store, key, fallback) => {
  try { return JSON.parse(store.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (store, key, value) => {
  try { store.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export const normaliseEmail = (value) => String(value || '').trim().toLowerCase();
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(value));

/* Long beats clever: a length floor rules out far more bad passwords than a symbol rule. */
export function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Use at least 8 characters.';
  if (value.length > 200) return 'That password is unusually long — keep it under 200 characters.';
  if (/^\s|\s$/.test(value)) return 'Remove the space at the start or end.';
  return '';
}

/* Supabase's wording is aimed at developers. These are aimed at whoever is looking at the
   dialog. "Invalid login credentials" stays deliberately vague about which half was wrong —
   saying so would let a stranger discover which emails have accounts. */
function readable(error) {
  const message = String(error?.message || 'Something went wrong.');
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match an account.';
  if (/already registered|already been registered/i.test(message)) return 'There is already an account with that email. Try logging in.';
  if (/email not confirmed/i.test(message)) return 'Check your inbox and confirm your email address first.';
  if (/email rate limit|over_email_send/i.test(message)) return 'The confirmation email could not be sent — this site has hit its email limit for now. Try again later.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/email address .* is invalid|invalid email/i.test(message)) return 'That email address was rejected. Try a different one.';
  if (/password/i.test(message) && /short|least/i.test(message)) return 'Use at least 8 characters.';
  if (/failed to fetch|network/i.test(message)) return 'Could not reach the server. Check your connection.';
  if (/should be different/i.test(message)) return 'That is already your password — pick a new one.';
  if (/auth session missing|invalid claim/i.test(message)) return 'This reset link has expired. Ask for a new one.';
  return message;
}

const shape = (user) => ({
  id: user.id,
  email: user.email || '',
  name: String(user.user_metadata?.name || user.email?.split('@')[0] || 'You').slice(0, 60),
  guest: false,
});

/* --- signing in ------------------------------------------------------------ */

export async function signUp(email, password, name) {
  const db = await client();
  if (!db) throw new Error('Accounts are not configured for this site yet.');
  const address = normaliseEmail(email);
  if (!isEmail(address)) throw new Error('That does not look like an email address.');
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const { data, error } = await db.auth.signUp({
    email: address,
    password,
    options: {
      data: { name: String(name || '').trim().slice(0, 60) || address.split('@')[0] },
      /* Without this the confirmation link goes wherever the dashboard's Site URL points,
         which is one address for a project that runs on at least three — localhost, the
         Vercel preview, and the live domain. Someone who signs up on one of them and lands
         on another has confirmed an account they cannot see. Sending them back to the origin
         they actually used costs one line; the origin still has to be on Supabase's redirect
         allow-list, which is matched exactly, so the port here is not negotiable. */
      emailRedirectTo: `${window.location.origin}/studio`,
    },
  });
  if (error) throw new Error(readable(error));

  /* With email confirmation switched on, Supabase creates the user but hands back no session.
     That is not a failure — it means the next step is in their inbox. */
  if (!data.session) return { pending: address };
  return { session: shape(data.user) };
}

export async function logIn(email, password) {
  const db = await client();
  if (!db) throw new Error('Accounts are not configured for this site yet.');
  const { data, error } = await db.auth.signInWithPassword({ email: normaliseEmail(email), password });
  if (error) throw new Error(readable(error));
  return { session: shape(data.user) };
}

export async function signOut() {
  const guest = read(sessionStorage, SESSION, null);
  /* A guest's work was never meant to outlive the tab, so leaving it behind on the way out
     would break the one promise the guest option makes. */
  if (guest?.guest) sessionStorage.removeItem(GUEST_PROJECTS(guest.id));
  sessionStorage.removeItem(SESSION);
  const db = await client();
  if (db) await db.auth.signOut();
}

export function startGuest() {
  const id = `guest-${crypto.randomUUID().slice(0, 8)}`;
  const session = { id, email: '', name: 'Guest', guest: true };
  write(sessionStorage, SESSION, session);
  return session;
}

/* The current signed-in person, whichever kind. A guest wins only because a guest session can
   only exist when nobody is signed in. */
export async function currentSession() {
  const guest = read(sessionStorage, SESSION, null);
  if (guest?.guest) return guest;
  /* Nobody signed in and nothing to process — answer without pulling in 54 KB of SDK. */
  if (!hasStoredSession() && !hasAuthInUrl()) return null;
  const db = await client();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session ? shape(data.session.user) : null;
}

/* Fires when a token refreshes, another tab signs out, or a confirmation link is followed. */
export function onAuthChange(handler) {
  /* Only worth listening once there is a session to lose — before that, subscribing would be
     the very thing that drags the SDK onto the first page load. */
  if (!hasStoredSession() && !hasAuthInUrl()) return () => {};
  let stop = null;
  let cancelled = false;
  client().then((db) => {
    if (!db || cancelled) return;
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (read(sessionStorage, SESSION, null)?.guest) return;
      handler(session ? shape(session.user) : null);
    });
    stop = () => data.subscription.unsubscribe();
  });
  return () => { cancelled = true; stop?.(); };
}

export async function renameAccount(session, name) {
  const clean = String(name).trim().slice(0, 60);
  const db = await client();
  if (!clean || !db || session.guest) return session;
  const { error } = await db.auth.updateUser({ data: { name: clean } });
  if (error) throw new Error(readable(error));
  await db.from('profiles').update({ name: clean }).eq('id', session.id);
  return { ...session, name: clean };
}

/* Sends the reset email. Deliberately does not report whether the address exists: the reply
   is the same either way, so this cannot be used to find out who has an account. */
export async function requestPasswordReset(email) {
  const db = await client();
  if (!db) throw new Error('Accounts are not configured for this site yet.');
  const address = normaliseEmail(email);
  if (!isEmail(address)) throw new Error('That does not look like an email address.');
  const { error } = await db.auth.resetPasswordForEmail(address, {
    redirectTo: `${window.location.origin}/reset`,
  });
  if (error && !/user not found/i.test(error.message)) throw new Error(readable(error));
  return address;
}

/* Called from /reset, where following the emailed link has already put a recovery session in
   place. Without that session Supabase rejects the change, which is what makes the link the
   proof of ownership rather than anything typed on the page. */
export async function setNewPassword(password) {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const db = await client();
  if (!db) throw new Error('Accounts are not configured for this site yet.');
  const { data, error } = await db.auth.updateUser({ password });
  if (error) throw new Error(readable(error));
  return shape(data.user);
}

/* --- projects -------------------------------------------------------------- */

const guestProjects = (session) => read(sessionStorage, GUEST_PROJECTS(session.id), []);
const saveGuestProjects = (session, projects) => write(sessionStorage, GUEST_PROJECTS(session.id), projects);
const newId = () => `p${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`;

const fromRow = (row) => ({
  id: row.id,
  title: row.title,
  design: row.design,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

export async function loadProjects(session) {
  if (!session) return [];
  if (session.guest) return guestProjects(session);
  const db = await client();
  const { data, error } = await db
    .from('cards')
    .select('id,title,design,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(readable(error));
  return (data || []).map(fromRow);
}

const titleFor = (design, title) =>
  String(title || design.name || design.brand || 'Untitled card').trim().slice(0, 80) || 'Untitled card';

/* Saving over an existing project keeps its id; a new one goes on top. Either way the caller
   gets the whole list back, so the UI has a single source of truth. */
export async function putProject(session, design, { id, title } = {}) {
  const name = titleFor(design, title);
  const db = session.guest ? null : await client();
  if (session.guest) {
    const projects = guestProjects(session);
    const now = Date.now();
    if (id && projects.some((project) => project.id === id)) {
      const next = projects.map((project) => (project.id === id ? { ...project, title: name, design, updatedAt: now } : project));
      if (!saveGuestProjects(session, next)) throw new Error('This browser refused to save — the design may be too large.');
      return { projects: next, id };
    }
    const project = { id: newId(), title: name, design, createdAt: now, updatedAt: now };
    const next = [project, ...projects];
    if (!saveGuestProjects(session, next)) throw new Error('This browser refused to save — the design may be too large.');
    return { projects: next, id: project.id };
  }

  if (id) {
    const { data, error } = await db.from('cards').update({ title: name, design }).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(readable(error));
    /* The row may have been deleted on another device — fall through and make a new one. */
    if (data) return { projects: await loadProjects(session), id };
  }
  const { data, error } = await db
    .from('cards')
    .insert({ owner: session.id, title: name, design })
    .select('id')
    .single();
  if (error) throw new Error(readable(error));
  return { projects: await loadProjects(session), id: data.id };
}

export async function removeProject(session, id) {
  if (session.guest) {
    const next = guestProjects(session).filter((project) => project.id !== id);
    saveGuestProjects(session, next);
    return next;
  }
  const db = await client();
  const { error } = await db.from('cards').delete().eq('id', id);
  if (error) throw new Error(readable(error));
  return loadProjects(session);
}

export async function renameProject(session, id, title) {
  const clean = String(title).trim().slice(0, 80);
  if (!clean) return loadProjects(session);
  if (session.guest) {
    const next = guestProjects(session).map((project) => (project.id === id ? { ...project, title: clean, updatedAt: Date.now() } : project));
    saveGuestProjects(session, next);
    return next;
  }
  const db = await client();
  const { error } = await db.from('cards').update({ title: clean }).eq('id', id);
  if (error) throw new Error(readable(error));
  return loadProjects(session);
}

export async function duplicateProject(session, id) {
  const projects = await loadProjects(session);
  const source = projects.find((project) => project.id === id);
  if (!source) return projects;
  const copy = `${source.title} copy`.slice(0, 80);
  if (session.guest) {
    const next = [{ ...source, id: newId(), title: copy, createdAt: Date.now(), updatedAt: Date.now() }, ...projects];
    saveGuestProjects(session, next);
    return next;
  }
  const db = await client();
  const { error } = await db.from('cards').insert({ owner: session.id, title: copy, design: source.design });
  if (error) throw new Error(readable(error));
  return loadProjects(session);
}

/* Anything left behind by the browser-held accounts this file used to implement. It is swept
   up into the first real account that signs in, then deleted — nobody should lose a design
   because the storage underneath changed. */
export async function adoptLocalWork(session) {
  const db = session && !session.guest ? await client() : null;
  if (!db) return 0;
  const keys = Object.keys(localStorage).filter((key) => /^card(verse|plume)-projects-/.test(key));
  const stranded = keys.flatMap((key) => read(localStorage, key, []));
  const rows = stranded
    .filter((project) => project?.design)
    .map((project) => ({ owner: session.id, title: titleFor(project.design, project.title), design: project.design }));

  if (rows.length) {
    const { error } = await db.from('cards').insert(rows);
    if (error) return 0;   /* leave the local copies alone if the upload failed */
  }
  keys.forEach((key) => localStorage.removeItem(key));
  ['cardverse-accounts', 'cardverse-saved', 'cardverse-draft', 'cardverse-session'].forEach((key) => localStorage.removeItem(key));
  return rows.length;
}
