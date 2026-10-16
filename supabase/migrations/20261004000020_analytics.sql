-- HYPERION SYSTEM — ETAPA 15: análises do catálogo, com privacidade.
--
-- Só CONTADORES por dia: nada de IP, cookie, identificador de visitante ou dado pessoal. Cada linha diz "nesta loja, neste dia,
-- este tipo de evento, nesta peça/coleção, vindo desta origem aconteceu N vezes". Quem lê é só dono e gerente.
-- Limite conhecido: sem identificar o visitante não dá para barrar contagem inflada de propósito; o navegador conta uma vez
-- por visita (sessão) e proteção contra abuso entra na ETAPA 20.

create table public.analytics_daily (
  store_id uuid not null references public.stores (id) on delete cascade,
  day      date not null default (now() at time zone 'America/Sao_Paulo')::date,
  kind     text not null check (kind in ('store_view', 'collection_view', 'product_view', 'whatsapp_click', 'share_click')),
  ref_id   uuid,                                   -- peça ou coleção (nulo para a loja)
  source   text not null default 'direto' check (source in ('direto', 'qr', 'bio', 'story', 'whatsapp', 'outro')),
  hits     integer not null default 1 check (hits > 0)
);
-- ref_id nulo precisa entrar na unicidade: índice por expressão
create unique index analytics_daily_uq on public.analytics_daily (store_id, day, kind, coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid), source);
create index analytics_daily_store_idx on public.analytics_daily (store_id, day desc);

alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from anon, authenticated;
grant all on public.analytics_daily to service_role;
grant select on public.analytics_daily to authenticated;
create policy analytics_read on public.analytics_daily for select to authenticated
  using (exists (select 1 from public.store_members m where m.store_id = analytics_daily.store_id and m.user_id = auth.uid() and m.role in ('owner', 'manager'))
         or private.is_super_admin());

-- Registra UM evento de catálogo público (anon). Entrada inválida é recusada; peça/coleção que não existe no catálogo também.
create function public.track_event(p_store text, p_kind text, p_ref text default '', p_source text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := private.public_store(p_store);
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_ref text := lower(btrim(coalesce(p_ref, '')));
  v_src text := lower(btrim(coalesce(p_source, '')));
  v_id uuid;
begin
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_kind not in ('store_view', 'collection_view', 'product_view', 'whatsapp_click', 'share_click') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  v_src := case when v_src = '' then 'direto' when v_src in ('direto', 'qr', 'bio', 'story', 'whatsapp') then v_src else 'outro' end;

  if v_kind = 'collection_view' then
    select c.id into v_id from public.collections c where c.store_id = v_store and c.slug = v_ref and c.is_published;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  elsif v_kind = 'product_view' or (v_kind in ('whatsapp_click', 'share_click') and v_ref <> '') then
    select id into v_id from private.public_products(v_store) where slug = v_ref;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;

  insert into public.analytics_daily (store_id, kind, ref_id, source) values (v_store, v_kind, v_id, v_src)
  on conflict (store_id, day, kind, coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid), source)
  do update set hits = public.analytics_daily.hits + 1 where public.analytics_daily.hits < 1000000;
end $$;

-- Relatório da loja (dono e gerente): totais do período e do período anterior, série diária, origens, peças e coleções.
create function public.store_analytics(p_store uuid, p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 90);
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  result jsonb;
begin
  if not (exists (select 1 from public.store_members m where m.store_id = p_store and m.user_id = auth.uid() and m.role in ('owner', 'manager'))
          or private.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with cur as (select * from public.analytics_daily where store_id = p_store and day > today - d),
       prev as (select * from public.analytics_daily where store_id = p_store and day <= today - d and day > today - 2 * d),
       clicks_cur as (select coalesce(sum(clicks), 0) n from public.product_interest_clicks where store_id = p_store and day > today - d),
       clicks_prev as (select coalesce(sum(clicks), 0) n from public.product_interest_clicks where store_id = p_store and day <= today - d and day > today - 2 * d)
  select jsonb_build_object(
    'days', d,
    'totals', jsonb_build_object(
      'store_view', (select coalesce(sum(hits), 0) from cur where kind = 'store_view'),
      'collection_view', (select coalesce(sum(hits), 0) from cur where kind = 'collection_view'),
      'product_view', (select coalesce(sum(hits), 0) from cur where kind = 'product_view'),
      'whatsapp_click', (select coalesce(sum(hits), 0) from cur where kind = 'whatsapp_click'),
      'share_click', (select coalesce(sum(hits), 0) from cur where kind = 'share_click'),
      'avise_click', (select n from clicks_cur)),
    'previous', jsonb_build_object(
      'store_view', (select coalesce(sum(hits), 0) from prev where kind = 'store_view'),
      'collection_view', (select coalesce(sum(hits), 0) from prev where kind = 'collection_view'),
      'product_view', (select coalesce(sum(hits), 0) from prev where kind = 'product_view'),
      'whatsapp_click', (select coalesce(sum(hits), 0) from prev where kind = 'whatsapp_click'),
      'share_click', (select coalesce(sum(hits), 0) from prev where kind = 'share_click'),
      'avise_click', (select n from clicks_prev)),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', g.day,
               'views', coalesce((select sum(hits) from cur where cur.day = g.day and kind in ('store_view', 'collection_view', 'product_view')), 0),
               'contacts', coalesce((select sum(hits) from cur where cur.day = g.day and kind = 'whatsapp_click'), 0)) order by g.day)
      from generate_series(today - d + 1, today, interval '1 day') as t(ts), lateral (select t.ts::date as day) g), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', s.source, 'views', s.n) order by s.n desc)
      from (select source, sum(hits) n from cur where kind in ('store_view', 'collection_view', 'product_view') group by source) s), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug, 'status', x.status, 'views', x.views, 'contacts', x.contacts, 'avise', x.avise)
                       order by x.views desc, x.contacts desc, x.name)
      from (
        select p.id, p.name, p.slug, p.status,
               coalesce((select sum(hits) from cur where cur.ref_id = p.id and kind = 'product_view'), 0) views,
               coalesce((select sum(hits) from cur where cur.ref_id = p.id and kind = 'whatsapp_click'), 0) contacts,
               coalesce((select sum(c.clicks) from public.product_interest_clicks c where c.product_id = p.id and c.day > today - d), 0) avise
        from public.products p where p.store_id = p_store
        order by 5 desc, 6 desc, p.name limit 10) x
      where x.views > 0 or x.contacts > 0 or x.avise > 0), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'views', v.n) order by v.n desc, c.name)
      from (select ref_id, sum(hits) n from cur where kind = 'collection_view' group by ref_id) v join public.collections c on c.id = v.ref_id), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke execute on function public.track_event(text, text, text, text) from public;
revoke execute on function public.store_analytics(uuid, integer)       from public, anon;
grant  execute on function public.track_event(text, text, text, text) to anon, authenticated;
grant  execute on function public.store_analytics(uuid, integer)       to authenticated;
