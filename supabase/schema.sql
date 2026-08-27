-- Cardplume database
--
-- Paste this whole file into the Supabase SQL editor (Dashboard -> SQL Editor -> New query)
-- and run it once. It is safe to re-run: everything is create-if-not-exists or replaceable.
--
-- The shape is deliberately small. Three tables:
--   profiles   one row per signed-up person
--   cards      one row per saved design
--   donations  one row per completed Stripe checkout, written only by the webhook
--
-- Nothing about a person is world-readable. The public counters come from two SECURITY DEFINER
-- functions that return aggregates only, so anonymous visitors can see "how many" without
-- being able to read a single name, email or design.

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A profile row is created by a trigger rather than by the client, so the count cannot be
-- inflated by anyone calling an insert endpoint in a loop.
--
-- It waits for a confirmed address. A row appears in auth.users the moment someone submits
-- the signup form, whether or not they ever open the email — counting those would mean the
-- public "makers" figure included people who never actually arrived. With confirmation
-- switched off the address is confirmed immediately and this fires on insert as before.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who confirmed before this trigger existed still deserves a profile.
insert into public.profiles (id, name)
select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
where u.email_confirmed_at is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------- cards

create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  title       text not null default 'Untitled card',
  design      jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cards_owner_idx on public.cards (owner, updated_at desc);

alter table public.cards enable row level security;

drop policy if exists "owners read their cards" on public.cards;
create policy "owners read their cards" on public.cards
  for select using (auth.uid() = owner);

drop policy if exists "owners create their cards" on public.cards;
create policy "owners create their cards" on public.cards
  for insert with check (auth.uid() = owner);

drop policy if exists "owners update their cards" on public.cards;
create policy "owners update their cards" on public.cards
  for update using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "owners delete their cards" on public.cards;
create policy "owners delete their cards" on public.cards
  for delete using (auth.uid() = owner);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- donations

create table if not exists public.donations (
  -- The Stripe checkout session id is the primary key, so a webhook Stripe retries three
  -- times still results in exactly one donation.
  id            text primary key,
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'usd',
  display_name  text,
  created_at    timestamptz not null default now()
);

alter table public.donations enable row level security;
-- No policies at all: nothing with the anon or authenticated role can read or write this
-- table directly. The webhook writes with the service-role key, which bypasses RLS, and the
-- public reads go through the aggregate functions below.

-- ---------------------------------------------------------------- public aggregates

create or replace function public.site_stats()
returns json language sql security definer stable set search_path = public as $$
  select json_build_object(
    'makers',       (select count(*) from public.profiles),
    'cards',        (select count(*) from public.cards),
    'donors',       (select count(*) from public.donations),
    'raised_cents', (select coalesce(sum(amount_cents), 0) from public.donations)
  );
$$;

-- Only a name and a total. No email, no session id, no way back to a person.
create or replace function public.top_donors(limit_count int default 5)
returns table (display_name text, amount_cents bigint)
language sql security definer stable set search_path = public as $$
  select coalesce(nullif(trim(d.display_name), ''), 'Anonymous') as display_name,
         sum(d.amount_cents) as amount_cents
  from public.donations d
  group by 1
  order by 2 desc, 1 asc
  limit greatest(1, least(coalesce(limit_count, 5), 20));
$$;

grant execute on function public.site_stats() to anon, authenticated;
grant execute on function public.top_donors(int) to anon, authenticated;
