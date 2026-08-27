/* Stripe -> donations.
 *
 * Deploy with:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Then in the Stripe dashboard add an endpoint pointing at
 *   https://<project>.functions.supabase.co/stripe-webhook
 * subscribed to `checkout.session.completed`.
 *
 * --no-verify-jwt is correct here and only here: Stripe cannot present a Supabase JWT. The
 * request is authenticated instead by its signature, which is checked below before a single
 * byte of the body is trusted. An unauthenticated POST claiming "payment succeeded" must
 * never be able to write a row.
 */
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

/* Service role, so it can write to a table with no policies. It never leaves this function. */
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  /* The raw body is required — parsing it first would break the signature check. */
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, signingSecret);
  } catch (problem) {
    console.error('Rejected an unsigned or tampered webhook:', (problem as Error).message);
    return new Response('Bad signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') return new Response('Not paid', { status: 200 });

  const amount = session.amount_total ?? 0;
  if (amount <= 0) return new Response('Nothing to record', { status: 200 });

  /* Whatever the donor typed into the "name to show" custom field, if they added one.
     Trimmed and capped here so the leaderboard cannot be used as a billboard. */
  const custom = session.custom_fields?.find((field) => field.key === 'display_name');
  const displayName = (custom?.text?.value ?? session.customer_details?.name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  /* The session id is the primary key, so Stripe's retries collapse into one row. */
  const { error } = await db.from('donations').upsert({
    id: session.id,
    amount_cents: amount,
    currency: session.currency ?? 'usd',
    display_name: displayName || null,
  }, { onConflict: 'id' });

  if (error) {
    console.error('Could not record the donation:', error.message);
    /* A non-2xx tells Stripe to retry, which is what we want if the database blipped. */
    return new Response('Storage failed', { status: 500 });
  }

  return new Response('Recorded', { status: 200 });
});
