-- Rode este arquivo uma vez no Supabase: SQL Editor → New query → cole tudo → Run.

-- Quem pode usar o gerador. A chave é o e-mail usado na compra da Cakto,
-- então o acesso já existe antes mesmo de a pessoa criar a conta.
create table if not exists public.access (
  email          text primary key,
  plan           text not null check (plan in ('lifetime', 'monthly')),
  status         text not null check (status in ('active', 'canceled', 'revoked')),
  -- null = não expira (vitalício). No mensal, é o fim do período pago.
  expires_at     timestamptz,
  cakto_order_id text,
  updated_at     timestamptz not null default now()
);

-- Registro de todos os avisos recebidos da Cakto, para conferência.
create table if not exists public.webhook_events (
  id          bigint generated always as identity primary key,
  event       text,
  email       text,
  order_id    text,
  result      text,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.access enable row level security;
alter table public.webhook_events enable row level security;

-- Cada pessoa logada só enxerga o próprio acesso. Ninguém escreve pelo site:
-- só o webhook, que usa a chave secreta (service role), altera estas tabelas.
drop policy if exists "ler o próprio acesso" on public.access;
create policy "ler o próprio acesso" on public.access
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- Funil de contatos (mini CRM) — comércios salvos na prospecção.
-- Se você já rodou a parte de cima antes, rode só daqui para baixo.
-- ---------------------------------------------------------------------------

-- true quando o usuário logado tem acesso pago válido.
create or replace function public.has_paid_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.access
    where email = lower(auth.jwt() ->> 'email')
      and status <> 'revoked'
      and (expires_at is null or expires_at > now())
  );
$$;

-- Pelas regras do Google, guardamos só o ID do lugar (place_id); nome, endereço e telefone
-- são buscados de novo no Google quando a lista é aberta. O resto são anotações do próprio usuário.
create table if not exists public.saved_leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id       text not null,
  niche_id       text not null,
  niche_label    text not null,
  status         text not null default 'to_contact'
                 check (status in ('to_contact', 'contacted', 'interested', 'proposal', 'won', 'lost')),
  notes          text not null default '',
  contact_name   text not null default '',
  next_action_at date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table public.saved_leads enable row level security;

drop policy if exists "funil: ver os próprios" on public.saved_leads;
create policy "funil: ver os próprios" on public.saved_leads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "funil: criar com acesso pago" on public.saved_leads;
create policy "funil: criar com acesso pago" on public.saved_leads
  for insert to authenticated with check (user_id = auth.uid() and public.has_paid_access());

drop policy if exists "funil: editar os próprios" on public.saved_leads;
create policy "funil: editar os próprios" on public.saved_leads
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_paid_access());

drop policy if exists "funil: apagar os próprios" on public.saved_leads;
create policy "funil: apagar os próprios" on public.saved_leads
  for delete to authenticated using (user_id = auth.uid());
