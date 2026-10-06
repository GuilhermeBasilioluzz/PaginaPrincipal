-- HYPERION SYSTEM — ETAPA 8 (complemento): "Avise-me quando chegar" em peças esgotadas ou toda reservadas.
--
-- Fluxo enxuto: na página da peça, o botão registra um clique ANÔNIMO (contador por peça e por dia) e leva a cliente
-- direto ao WhatsApp da loja com uma mensagem pronta. Nenhum dado pessoal é coletado no site.
-- Quando alguém de fato chama, a vendedora anota a pessoa na LISTA DE ESPERA da peça (nome, WhatsApp, tamanho),
-- e depois, quando repor, avisa cada uma com mensagem pronta. O aviso é manual: não há envio automático de WhatsApp.
--
-- Demanda medida = cliques "avise-me" (30 dias) + pessoas na lista de espera, por peça, no painel da loja.
-- Privacidade (LGPD): a lista só é lida pela equipe da própria loja; dono/gerente podem apagar a pessoa a pedido.

create type public.interest_status as enum ('waiting', 'contacted', 'converted', 'dismissed');

create table public.product_interests (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null,
  product_id    uuid not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  contact       text not null check (contact ~ '^[0-9]{10,15}$'),
  size          text check (char_length(size) <= 12),
  note          text check (char_length(note) <= 300),
  status        public.interest_status not null default 'waiting',
  handled_by    uuid references public.profiles (id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
-- uma pessoa só entra uma vez por peça enquanto o interesse estiver em aberto
create unique index product_interests_open_uidx on public.product_interests (product_id, contact) where status in ('waiting', 'contacted');
create index product_interests_store_idx   on public.product_interests (store_id, status, created_at desc);
create index product_interests_contact_idx on public.product_interests (store_id, contact, created_at desc);
create trigger product_interests_touch before update on public.product_interests for each row execute function private.set_updated_at();

-- cliques anônimos em "avise-me": um contador por peça e por dia (sem IP, sem nome, sem telefone)
create table public.product_interest_clicks (
  store_id   uuid not null,
  product_id uuid not null,
  day        date not null default current_date,
  clicks     integer not null default 1 check (clicks > 0),
  primary key (product_id, day),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
create index product_interest_clicks_store_idx on public.product_interest_clicks (store_id, day desc);

alter table public.product_interest_clicks enable row level security;
revoke all on public.product_interest_clicks from anon, authenticated;
grant all on public.product_interest_clicks to service_role;
grant select on public.product_interest_clicks to authenticated;
create policy interest_clicks_team_read on public.product_interest_clicks for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());

alter table public.product_interests enable row level security;
revoke all on public.product_interests from anon, authenticated;
grant all on public.product_interests to service_role;
grant select, delete on public.product_interests to authenticated;
create policy interests_team_read on public.product_interests for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy interests_manage_delete on public.product_interests for delete to authenticated
  using (private.can_write(store_id, array['owner', 'manager']::public.store_role[]));

-- ---------------------------------------------------------------- página pública do produto
-- Só colunas seguras. interest_open = a peça está esgotada ou toda reservada (cabe "avise-me").
create function public.catalog_product(p_slug text, p_product text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  pr as (select pp.* from st, private.public_products(st.id) pp where pp.slug = lower(btrim(coalesce(p_product, ''))))
  select case when (select id from st) is null or not exists (select 1 from pr) then null else jsonb_build_object(
    'store', (select jsonb_build_object('slug', s.slug, 'name', s.name, 'whatsapp', s.whatsapp, 'instagram_handle', s.instagram_handle,
                                         'logo_path', s.logo_path)
              from public.stores s where s.id = (select id from st)),
    'product', (select jsonb_build_object('name', name, 'slug', slug, 'description', description, 'price', price,
                                          'promo_price', promo_price, 'color', color, 'sizes', sizes, 'stock_label', stock_label,
                                          'published_at', published_at)
                from pr),
    'images', coalesce((select jsonb_agg(jsonb_build_object('path', i.path, 'kind', i.kind, 'alt', i.alt) order by i.position)
                        from public.product_images i where i.product_id = (select id from pr)), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) order by c.kind desc, c.position, c.name)
      from public.collections c
      where c.store_id = (select id from st) and c.is_published
        and ((c.kind = 'manual' and exists (select 1 from public.collection_products cp where cp.collection_id = c.id and cp.product_id = (select id from pr)))
          or (c.kind = 'new_arrivals' and (select published_at from pr) >= now() - make_interval(days => c.new_arrivals_days)))), '[]'::jsonb),
    'interest_open', (select stock_label in ('sold_out', 'reserved') from pr)
  ) end;
$$;

-- ---------------------------------------------------------------- "avise-me": clique anônimo (público)
-- Só conta para peça esgotada ou toda reservada de uma loja pública. Não grava nada pessoal.
create function public.register_interest_click(p_store text, p_product text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_store uuid := private.public_store(p_store); v_prod uuid; v_label text;
begin
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select id, stock_label into v_prod, v_label from private.public_products(v_store) where slug = lower(btrim(coalesce(p_product, '')));
  if v_prod is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_label not in ('sold_out', 'reserved') then raise exception 'not_open' using errcode = '23514'; end if;
  insert into public.product_interest_clicks (store_id, product_id) values (v_store, v_prod)
  on conflict (product_id, day) do update set clicks = public.product_interest_clicks.clicks + 1;
end $$;

-- ---------------------------------------------------------------- lista de espera (a vendedora anota quem chamou)
-- Devolve 'created' ou 'already' (a mesma pessoa na mesma peça só atualiza nome, tamanho e observação).
create function public.add_interest(p_product uuid, p_name text, p_contact text, p_size text default null, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_contact text; v_inserted boolean;
begin
  select store_id into v_store from public.products where id = p_product;
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.can_write(v_store, array['owner', 'manager', 'attendant']::public.store_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;

  v_contact := regexp_replace(coalesce(p_contact, ''), '\D', '', 'g');
  if char_length(v_contact) in (10, 11) then v_contact := '55' || v_contact; end if;
  if v_contact !~ '^[0-9]{10,15}$' then raise exception 'invalid_contact' using errcode = '22023'; end if;

  insert into public.product_interests (store_id, product_id, customer_name, contact, size, note)
  values (v_store, p_product, btrim(p_name), v_contact, nullif(btrim(p_size), ''), nullif(btrim(p_note), ''))
  on conflict (product_id, contact) where status in ('waiting', 'contacted')
  do update set customer_name = excluded.customer_name,
                size = coalesce(excluded.size, public.product_interests.size),
                note = coalesce(excluded.note, public.product_interests.note)
  returning (xmax = 0) into v_inserted;
  return case when v_inserted then 'created' else 'already' end;
end $$;

-- ---------------------------------------------------------------- painel da loja
-- Demanda por peça: cliques em "avise-me" (30 dias), pessoas na lista (por tamanho), estoque de agora.
create function public.store_interest_overview(p_store uuid)
returns table (product_id uuid, name text, status public.product_status, quantity integer, stock_state text,
               clicks_30d bigint, waiting bigint, contacted bigint, converted bigint, last_at timestamptz, sizes jsonb)
language sql stable set search_path = '' as $$
  with ids as (
    select i.product_id from public.product_interests i where i.store_id = p_store
    union
    select c.product_id from public.product_interest_clicks c where c.store_id = p_store and c.day >= current_date - 30
  )
  select p.id, p.name, p.status, b.quantity, b.stock_state,
         (select coalesce(sum(c.clicks), 0) from public.product_interest_clicks c where c.product_id = p.id and c.day >= current_date - 30),
         (select count(*) from public.product_interests i where i.product_id = p.id and i.status = 'waiting'),
         (select count(*) from public.product_interests i where i.product_id = p.id and i.status = 'contacted'),
         (select count(*) from public.product_interests i where i.product_id = p.id and i.status = 'converted'),
         greatest((select max(i.created_at) from public.product_interests i where i.product_id = p.id),
                  (select max(c.day)::timestamptz from public.product_interest_clicks c where c.product_id = p.id)),
         coalesce((select jsonb_object_agg(coalesce(s.size, 'Sem tamanho'), s.n) from (
                     select x.size, count(*) as n from public.product_interests x
                     where x.product_id = p.id and x.status in ('waiting', 'contacted') group by x.size) s), '{}'::jsonb)
  from ids
  join public.products p on p.id = ids.product_id
  left join private.stock_base(p_store) b on b.product_id = p.id
  order by 7 desc, 6 desc, 10 desc nulls last;
$$;

-- p_status: open (aguardando + já avisadas) | waiting | contacted | converted | dismissed | all
create function public.store_interests(p_store uuid, p_product uuid default null, p_status text default 'open',
                                       p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, product_id uuid, product_name text, product_slug text, customer_name text, contact text, size text, note text,
               status public.interest_status, created_at timestamptz, handled_at timestamptz, handled_by_name text, total bigint)
language sql stable set search_path = '' as $$
  select i.id, i.product_id, p.name, p.slug, i.customer_name, i.contact, i.size, i.note, i.status, i.created_at, i.handled_at, h.full_name, count(*) over ()
  from public.product_interests i
  join public.products p on p.id = i.product_id
  left join public.profiles h on h.id = i.handled_by
  where i.store_id = p_store and (p_product is null or i.product_id = p_product)
    and (p_status = 'all' or (p_status = 'open' and i.status in ('waiting', 'contacted')) or i.status::text = p_status)
  order by i.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create function public.set_interest_status(p_id uuid, p_status public.interest_status) returns void
language plpgsql security definer set search_path = '' as $$
declare v_store uuid;
begin
  select store_id into v_store from public.product_interests where id = p_id;
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.can_write(v_store, array['owner', 'manager', 'attendant']::public.store_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.product_interests
     set status = p_status,
         handled_by = case when p_status = 'waiting' then null else auth.uid() end,
         handled_at = case when p_status = 'waiting' then null else now() end
   where id = p_id;
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke execute on function public.catalog_product(text, text)                                           from public;
revoke execute on function public.register_interest_click(text, text)                                   from public;
revoke execute on function public.add_interest(uuid, text, text, text, text)                            from public, anon;
revoke execute on function public.store_interest_overview(uuid)                                         from public, anon;
revoke execute on function public.store_interests(uuid, uuid, text, integer, integer)                   from public, anon;
revoke execute on function public.set_interest_status(uuid, public.interest_status)                     from public, anon;
grant  execute on function public.catalog_product(text, text)                                           to anon, authenticated;
grant  execute on function public.register_interest_click(text, text)                                   to anon, authenticated;
grant  execute on function public.add_interest(uuid, text, text, text, text)                            to authenticated;
grant  execute on function public.store_interest_overview(uuid)                                         to authenticated;
grant  execute on function public.store_interests(uuid, uuid, text, integer, integer)                   to authenticated;
grant  execute on function public.set_interest_status(uuid, public.interest_status)                     to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.product_interests, public.product_interest_clicks;
  end if;
end $$;

-- ---------------------------------------------------------------- painel principal: pessoas aguardando
create or replace function public.store_dashboard(p_store uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'products', (
      select jsonb_build_object(
        'total',       count(*) filter (where status <> 'archived'),
        'available',   count(*) filter (where status = 'available'),
        'reserved',    count(*) filter (where status = 'reserved'),
        'sold',        count(*) filter (where status = 'sold'),
        'unavailable', count(*) filter (where status = 'unavailable'),
        'archived',    count(*) filter (where status = 'archived'),
        'featured',    count(*) filter (where is_featured and status <> 'archived'))
      from public.products where store_id = p_store),
    'collections', (select count(*) from public.collections where store_id = p_store),
    'categories',  (select count(*) from public.categories  where store_id = p_store),
    'team',        (select count(*) from public.store_members where store_id = p_store),
    'reservations', (select count(*) from public.reservations r
                      where r.store_id = p_store and r.status in ('requested', 'confirmed')
                        and (r.expires_at is null or r.expires_at > now())),
    'interests',   (select count(*) from public.product_interests i where i.store_id = p_store and i.status = 'waiting'),
    'interest_clicks', (select coalesce(sum(c.clicks), 0) from public.product_interest_clicks c where c.store_id = p_store and c.day >= current_date - 7),
    'stock', (
      select jsonb_build_object(
        'low', count(*) filter (where i.quantity > 0 and i.quantity <= i.low_stock_threshold),
        'out', count(*) filter (where i.quantity = 0))
      from public.inventory i join public.products p on p.id = i.product_id
      where i.store_id = p_store and p.status in ('available', 'reserved')),
    'recent', coalesce((
      select jsonb_agg(r order by r.updated_at desc)
      from (select p.id, p.name, p.status, p.created_at, p.updated_at,
                   pr.full_name as actor
            from public.products p
            left join public.profiles pr on pr.id = coalesce(p.updated_by, p.created_by)
            where p.store_id = p_store
            order by p.updated_at desc limit 8) r), '[]'::jsonb)
  );
$$;
