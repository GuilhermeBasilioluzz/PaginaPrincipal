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
