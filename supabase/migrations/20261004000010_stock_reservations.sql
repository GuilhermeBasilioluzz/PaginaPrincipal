-- HYPERION SYSTEM — ETAPA 7: estoque com histórico, reservas e painel ao vivo.
--
-- Modelo:
--   inventory.quantity  = unidades físicas em estoque (ainda não vendidas).
--   reservada           = soma das reservas ativas (solicitada/confirmada e não expirada).
--   disponível          = quantidade - reservada.
-- A quantidade SÓ muda por funções (nunca por UPDATE direto), e cada mudança grava uma linha em
-- inventory_movements: quem, quando, quanto e por quê. Reservas também entram nesse histórico
-- (delta 0), formando uma linha do tempo única do estoque.
-- Situação da peça (status): o sistema só ajusta available/reserved/sold quando o estoque ou uma reserva muda
-- (zero = vendido/esgotado; tudo reservado = reservado; senão disponível). "indisponível" e "arquivado" são
-- decisões humanas e nunca são tocadas. Editar o produto à mão (status explícito) vale até o próximo evento de estoque.

create type public.movement_reason   as enum ('initial', 'restock', 'sale', 'adjustment', 'return', 'reserved', 'reservation_released');
create type public.reservation_status as enum ('requested', 'confirmed', 'picked_up', 'cancelled');

create table public.reservations (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null,
  product_id       uuid not null,
  size             text check (char_length(size) <= 12),
  quantity         integer not null default 1 check (quantity between 1 and 999),
  customer_name    text not null check (char_length(btrim(customer_name)) between 1 and 80),
  customer_contact text check (char_length(customer_contact) <= 40),
  note             text check (char_length(note) <= 300),
  status           public.reservation_status not null default 'confirmed',
  expires_at       timestamptz,
  reserved_by      uuid references public.profiles (id) on delete set null,
  closed_by        uuid references public.profiles (id) on delete set null,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
create index reservations_store_status_idx on public.reservations (store_id, status, created_at desc);
create index reservations_active_product_idx on public.reservations (product_id) where status in ('requested', 'confirmed');
create trigger reservations_touch before update on public.reservations for each row execute function private.set_updated_at();

create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null,
  product_id     uuid not null,
  delta          integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  reason         public.movement_reason not null,
  note           text check (char_length(note) <= 300),
  reservation_id uuid references public.reservations (id) on delete set null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default clock_timestamp(),   -- hora real de cada evento (now() repete dentro de uma transação)
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
create index inventory_movements_store_idx   on public.inventory_movements (store_id, created_at desc);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ---------------------------------------------------------------- permissões: leitura para a equipe; escrita só pelas funções
alter table public.reservations        enable row level security;
alter table public.inventory_movements enable row level security;
revoke all on public.reservations, public.inventory_movements from anon, authenticated;
grant all on public.reservations, public.inventory_movements to service_role;
grant select on public.reservations, public.inventory_movements to authenticated;
create policy reservations_team_read on public.reservations for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy movements_team_read on public.inventory_movements for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());

-- A quantidade deixa de ser editável direto: só pelas funções abaixo (com histórico).
revoke update on public.inventory from authenticated;
grant update (low_stock_threshold) on public.inventory to authenticated;

-- ---------------------------------------------------------------- núcleo (schema private, SECURITY DEFINER)
create function private.reserved_qty(p_product uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(quantity), 0)::integer from public.reservations
  where product_id = p_product and status in ('requested', 'confirmed') and (expires_at is null or expires_at > now());
$$;

create function private.sync_product_status(p_product uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_status public.product_status; v_qty integer; v_new public.product_status;
begin
  select p.status, i.quantity into v_status, v_qty
  from public.products p join public.inventory i on i.product_id = p.id where p.id = p_product;
  if v_status is null or v_status in ('unavailable', 'archived') then return; end if;
  v_new := case when v_qty = 0 then 'sold'
                when private.reserved_qty(p_product) >= v_qty then 'reserved'
                else 'available' end;
  if v_new <> v_status then update public.products set status = v_new where id = p_product; end if;
end $$;

-- Única porta de entrada para mudar a quantidade. Trava a linha (sem corrida entre duas atendentes),
-- confere permissão e loja ativa, nunca deixa ficar negativo nem abaixo do que está reservado.
create function private.apply_stock(p_product uuid, p_delta integer, p_set integer, p_reason public.movement_reason,
                                    p_note text, p_reservation uuid, p_sync boolean default true) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_old integer; v_new integer;
begin
  select store_id, quantity into v_store, v_old from public.inventory where product_id = p_product for update;
  if v_store is null or not private.can_write(v_store, array['owner', 'manager', 'attendant']::public.store_role[]) then
    raise exception 'sem permissão para alterar o estoque' using errcode = '42501';
  end if;

  v_new := coalesce(p_set, v_old + coalesce(p_delta, 0));
  if v_new < 0 then raise exception 'insufficient_stock' using errcode = '23514'; end if;
  if v_new < private.reserved_qty(p_product) then raise exception 'below_reserved' using errcode = '23514'; end if;
  if v_new = v_old then return v_old; end if;

  update public.inventory set quantity = v_new where product_id = p_product;
  insert into public.inventory_movements (store_id, product_id, delta, quantity_after, reason, note, reservation_id, created_by)
  values (v_store, p_product, v_new - v_old, v_new, p_reason, nullif(btrim(p_note), ''), p_reservation, auth.uid());
  if p_sync then perform private.sync_product_status(p_product); end if;
  return v_new;
end $$;

-- ---------------------------------------------------------------- funções públicas (RPC)
-- Entrada, venda, devolução ou correção. O sinal precisa combinar com o motivo.
create function public.adjust_stock(p_product uuid, p_delta integer, p_reason public.movement_reason, p_note text default null)
returns integer language plpgsql set search_path = '' as $$
begin
  if p_reason not in ('restock', 'sale', 'adjustment', 'return') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0
     or (p_reason in ('restock', 'return') and p_delta < 0)
     or (p_reason = 'sale' and p_delta > 0) then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;
  return private.apply_stock(p_product, p_delta, null::integer, p_reason, p_note, null::uuid);
end $$;

-- Contagem: "na prateleira tenho N".
create function public.set_stock(p_product uuid, p_quantity integer, p_note text default null)
returns integer language plpgsql set search_path = '' as $$
begin
  if p_quantity is null or p_quantity < 0 then raise exception 'invalid_delta' using errcode = '22023'; end if;
  return private.apply_stock(p_product, null::integer, p_quantity, 'adjustment', p_note, null::uuid);
end $$;

create function public.create_reservation(p_product uuid, p_quantity integer, p_customer text, p_contact text default null,
                                          p_size text default null, p_note text default null, p_expires timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_qty integer; v_status public.product_status; v_id uuid;
begin
  select i.store_id, i.quantity, p.status into v_store, v_qty, v_status
  from public.inventory i join public.products p on p.id = i.product_id
  where i.product_id = p_product for update of i;
  if v_store is null or not private.can_write(v_store, array['owner', 'manager', 'attendant']::public.store_role[]) then
    raise exception 'sem permissão para reservar' using errcode = '42501';
  end if;
  if v_status in ('archived', 'unavailable') then raise exception 'not_reservable' using errcode = '23514'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'invalid_delta' using errcode = '22023'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'invalid_expiry' using errcode = '22023'; end if;
  if v_qty - private.reserved_qty(p_product) < p_quantity then raise exception 'insufficient_stock' using errcode = '23514'; end if;

  insert into public.reservations (store_id, product_id, size, quantity, customer_name, customer_contact, note, status, expires_at, reserved_by)
  values (v_store, p_product, nullif(btrim(p_size), ''), p_quantity, btrim(p_customer), nullif(btrim(p_contact), ''),
          nullif(btrim(p_note), ''), 'confirmed', p_expires, auth.uid())
  returning id into v_id;

  insert into public.inventory_movements (store_id, product_id, delta, quantity_after, reason, note, reservation_id, created_by)
  values (v_store, p_product, 0, v_qty, 'reserved', 'Reservado para ' || btrim(p_customer), v_id, auth.uid());
  perform private.sync_product_status(p_product);
  return v_id;
end $$;

-- Confirmar (solicitada → confirmada), dar baixa na retirada (vira venda) ou cancelar (libera a peça).
create function public.set_reservation_status(p_reservation uuid, p_status public.reservation_status)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations; v_qty integer;
begin
  select * into r from public.reservations where id = p_reservation;
  if r.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select quantity into v_qty from public.inventory where product_id = r.product_id for update;
  if not private.can_write(r.store_id, array['owner', 'manager', 'attendant']::public.store_role[]) then
    raise exception 'sem permissão para alterar reservas' using errcode = '42501';
  end if;
  select * into r from public.reservations where id = p_reservation for update;
  if r.status not in ('requested', 'confirmed') then raise exception 'already_closed' using errcode = '23514'; end if;

  if p_status = 'confirmed' then
    if r.status <> 'requested' then raise exception 'invalid_transition' using errcode = '23514'; end if;
    update public.reservations set status = 'confirmed' where id = r.id;
    insert into public.inventory_movements (store_id, product_id, delta, quantity_after, reason, note, reservation_id, created_by)
    values (r.store_id, r.product_id, 0, v_qty, 'reserved', 'Reserva confirmada: ' || r.customer_name, r.id, auth.uid());
  elsif p_status = 'picked_up' then
    update public.reservations set status = 'picked_up', closed_by = auth.uid(), closed_at = now() where id = r.id;
    perform private.apply_stock(r.product_id, -r.quantity, null::integer, 'sale', 'Retirada por ' || r.customer_name, r.id);
  elsif p_status = 'cancelled' then
    update public.reservations set status = 'cancelled', closed_by = auth.uid(), closed_at = now() where id = r.id;
    insert into public.inventory_movements (store_id, product_id, delta, quantity_after, reason, note, reservation_id, created_by)
    values (r.store_id, r.product_id, 0, v_qty, 'reservation_released', 'Reserva cancelada: ' || r.customer_name, r.id, auth.uid());
  else
    raise exception 'invalid_transition' using errcode = '23514';
  end if;
  perform private.sync_product_status(r.product_id);
end $$;

-- ---------------------------------------------------------------- consultas do painel (SECURITY INVOKER: RLS vale)
create function private.stock_base(p_store uuid)
returns table (product_id uuid, name text, sku text, status public.product_status, quantity integer,
               reserved integer, available integer, low_stock_threshold integer, stock_state text)
language sql stable set search_path = '' as $$
  select s.*, case when s.quantity = 0 then 'out'
                   when s.quantity - s.reserved <= 0 then 'reserved'
                   when s.quantity - s.reserved <= s.low_stock_threshold then 'low'
                   else 'ok' end
  from (
    select p.id, p.name, p.sku, p.status, i.quantity,
           (select coalesce(sum(r.quantity), 0)::integer from public.reservations r
             where r.product_id = p.id and r.status in ('requested', 'confirmed') and (r.expires_at is null or r.expires_at > now())) as reserved,
           i.quantity - (select coalesce(sum(r.quantity), 0)::integer from public.reservations r
             where r.product_id = p.id and r.status in ('requested', 'confirmed') and (r.expires_at is null or r.expires_at > now())) as available,
           i.low_stock_threshold
    from public.products p join public.inventory i on i.product_id = p.id
    where p.store_id = p_store and p.status <> 'archived'
  ) s;
$$;

create function public.store_stock_totals(p_store uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'products',     count(*),
    'units',        coalesce(sum(quantity), 0),
    'reserved',     coalesce(sum(reserved), 0),
    'available',    coalesce(sum(greatest(available, 0)), 0),
    'low',          count(*) filter (where stock_state = 'low'),
    'out',          count(*) filter (where stock_state = 'out'),
    'reservations', (select count(*) from public.reservations r
                      where r.store_id = p_store and r.status in ('requested', 'confirmed') and (r.expires_at is null or r.expires_at > now())))
  from private.stock_base(p_store);
$$;

-- p_filter: all | low | out | reserved. p_q: busca por nome ou código (sem curingas).
create function public.store_stock_overview(p_store uuid, p_filter text default 'all', p_q text default '',
                                            p_limit integer default 30, p_offset integer default 0)
returns table (product_id uuid, name text, sku text, status public.product_status, quantity integer, reserved integer,
               available integer, low_stock_threshold integer, stock_state text, reservations jsonb, total bigint)
language sql stable set search_path = '' as $$
  select b.product_id, b.name, b.sku, b.status, b.quantity, b.reserved, b.available, b.low_stock_threshold, b.stock_state,
         coalesce((select jsonb_agg(jsonb_build_object(
                      'id', r.id, 'customer', r.customer_name, 'quantity', r.quantity, 'status', r.status, 'size', r.size,
                      'by', pr.full_name, 'at', r.created_at, 'expires_at', r.expires_at) order by r.created_at)
                   from public.reservations r left join public.profiles pr on pr.id = r.reserved_by
                   where r.product_id = b.product_id and r.status in ('requested', 'confirmed')
                     and (r.expires_at is null or r.expires_at > now())), '[]'::jsonb),
         count(*) over ()
  from private.stock_base(p_store) b
  where (coalesce(p_q, '') = '' or b.name ilike '%' || p_q || '%' or b.sku ilike '%' || p_q || '%')
    and (p_filter = 'all' or (p_filter = 'low' and b.stock_state = 'low') or (p_filter = 'out' and b.stock_state = 'out')
         or (p_filter = 'reserved' and b.reserved > 0))
  order by case b.stock_state when 'out' then 0 when 'low' then 1 when 'reserved' then 2 else 3 end, b.name
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create function public.store_stock_feed(p_store uuid, p_limit integer default 30, p_product uuid default null)
returns table (id uuid, created_at timestamptz, reason public.movement_reason, delta integer, quantity_after integer,
               note text, product_id uuid, product_name text, actor text, reservation_id uuid)
language sql stable set search_path = '' as $$
  select m.id, m.created_at, m.reason, m.delta, m.quantity_after, m.note, m.product_id, p.name, pr.full_name, m.reservation_id
  from public.inventory_movements m
  join public.products p on p.id = m.product_id
  left join public.profiles pr on pr.id = m.created_by
  where m.store_id = p_store and (p_product is null or m.product_id = p_product)
  order by m.created_at desc, m.id
  limit least(greatest(p_limit, 1), 100);
$$;

-- p_status: active (solicitadas e confirmadas) | picked_up | cancelled | all
create function public.store_reservations(p_store uuid, p_status text default 'active', p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, product_id uuid, product_name text, size text, quantity integer, customer_name text, customer_contact text,
               note text, status public.reservation_status, expires_at timestamptz, expired boolean, reserved_by_name text,
               created_at timestamptz, closed_at timestamptz, closed_by_name text, total bigint)
language sql stable set search_path = '' as $$
  select r.id, r.product_id, p.name, r.size, r.quantity, r.customer_name, r.customer_contact, r.note, r.status, r.expires_at,
         (r.status in ('requested', 'confirmed') and r.expires_at is not null and r.expires_at <= now()),
         rb.full_name, r.created_at, r.closed_at, cb.full_name, count(*) over ()
  from public.reservations r
  join public.products p on p.id = r.product_id
  left join public.profiles rb on rb.id = r.reserved_by
  left join public.profiles cb on cb.id = r.closed_by
  where r.store_id = p_store
    and (p_status = 'all'
         or (p_status = 'active' and r.status in ('requested', 'confirmed'))
         or (p_status = 'picked_up' and r.status = 'picked_up')
         or (p_status = 'cancelled' and r.status = 'cancelled'))
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------- gravar produto passa pelo estoque com histórico
-- (mesma função da etapa 4; só a parte do estoque mudou: usa apply_stock e NÃO ressincroniza a situação,
--  porque aqui a pessoa acabou de escolher a situação à mão)
create or replace function public.save_product(p_store uuid, p_id uuid, p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_sizes text[];
  v_status public.product_status := nullif(p ->> 'status', '')::public.product_status;
begin
  select coalesce(array_agg(x), '{}') into v_sizes
  from jsonb_array_elements_text(coalesce(p -> 'sizes', '[]'::jsonb)) x;

  if p_id is null then
    insert into public.products (store_id, name, slug, description, price, promo_price, category_id, color,
                                 sizes, sku, video_url, status, is_featured)
    values (p_store, p ->> 'name', private.next_product_slug(p_store, p ->> 'slug_base'),
            nullif(p ->> 'description', ''), (p ->> 'price')::numeric, nullif(p ->> 'promo_price', '')::numeric,
            nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'color', ''), v_sizes,
            nullif(p ->> 'sku', ''), nullif(p ->> 'video_url', ''), coalesce(v_status, 'available'),
            coalesce((p ->> 'featured')::boolean, false))
    returning id into v_id;
  else
    update public.products set
      name = p ->> 'name',
      description = nullif(p ->> 'description', ''),
      price = (p ->> 'price')::numeric,
      promo_price = nullif(p ->> 'promo_price', '')::numeric,
      category_id = nullif(p ->> 'category_id', '')::uuid,
      color = nullif(p ->> 'color', ''),
      sizes = v_sizes,
      sku = nullif(p ->> 'sku', ''),
      video_url = nullif(p ->> 'video_url', ''),
      status = coalesce(v_status, status),
      is_featured = coalesce((p ->> 'featured')::boolean, false)
    where id = p_id and store_id = p_store
    returning id into v_id;
    if v_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  if nullif(p ->> 'quantity', '') is not null then
    perform private.apply_stock(v_id, null::integer, (p ->> 'quantity')::integer,
                                (case when p_id is null then 'initial' else 'adjustment' end)::public.movement_reason,
                                case when p_id is null then 'Estoque inicial' else 'Ajuste pela edição do produto' end,
                                null::uuid, false);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke execute on function public.adjust_stock(uuid, integer, public.movement_reason, text)                                 from public, anon;
revoke execute on function public.set_stock(uuid, integer, text)                                                            from public, anon;
revoke execute on function public.create_reservation(uuid, integer, text, text, text, text, timestamptz)                    from public, anon;
revoke execute on function public.set_reservation_status(uuid, public.reservation_status)                                   from public, anon;
revoke execute on function public.store_stock_totals(uuid)                                                                  from public, anon;
revoke execute on function public.store_stock_overview(uuid, text, text, integer, integer)                                  from public, anon;
revoke execute on function public.store_stock_feed(uuid, integer, uuid)                                                     from public, anon;
revoke execute on function public.store_reservations(uuid, text, integer, integer)                                          from public, anon;
grant  execute on function public.adjust_stock(uuid, integer, public.movement_reason, text)                                 to authenticated;
grant  execute on function public.set_stock(uuid, integer, text)                                                            to authenticated;
grant  execute on function public.create_reservation(uuid, integer, text, text, text, text, timestamptz)                    to authenticated;
grant  execute on function public.set_reservation_status(uuid, public.reservation_status)                                   to authenticated;
grant  execute on function public.store_stock_totals(uuid)                                                                  to authenticated;
grant  execute on function public.store_stock_overview(uuid, text, text, integer, integer)                                  to authenticated;
grant  execute on function public.store_stock_feed(uuid, integer, uuid)                                                     to authenticated;
grant  execute on function public.store_reservations(uuid, text, integer, integer)                                          to authenticated;

-- ---------------------------------------------------------------- tempo real (Supabase Realtime respeita o RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.inventory, public.reservations, public.inventory_movements;
  end if;
end $$;

-- ---------------------------------------------------------------- painel principal: reservas ativas
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
