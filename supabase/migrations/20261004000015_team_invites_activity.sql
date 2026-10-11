-- HYPERION SYSTEM — ETAPA 10: multiatendente.
--   1) Convites por LINK (o dono copia e manda por WhatsApp). O banco guarda só o resumo (hash) do código: quem lê o banco
--      não consegue montar um link. O link aparece uma única vez, na criação. Vale por prazo e por número de usos.
--   2) Histórico de atividades: quem fez o quê e quando, gravado por gatilhos (a equipe não consegue escrever nem apagar).
--      Dono e gerente veem tudo; atendente vê só as próprias ações.

-- ================================================================ convites
create table public.store_invites (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  token_hash  text not null unique,
  role        public.store_role not null check (role in ('manager', 'attendant')),   -- dono não se convida: promove-se um membro
  label       text check (char_length(label) <= 80),
  max_uses    integer not null default 1 check (max_uses between 1 and 20),
  uses        integer not null default 0 check (uses >= 0),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index store_invites_store_idx on public.store_invites (store_id, created_at desc);

alter table public.store_invites enable row level security;
revoke all on public.store_invites from anon, authenticated;
grant all on public.store_invites to service_role;
grant select on public.store_invites to authenticated;
create policy invites_owner_read on public.store_invites for select to authenticated
  using (private.can_write(store_id, array['owner']::public.store_role[]) or private.is_super_admin());

-- ================================================================ histórico
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  store_id    uuid not null references public.stores (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  entity_name text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default clock_timestamp()
);
create index activity_logs_store_idx  on public.activity_logs (store_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (store_id, entity_type, entity_id, created_at desc);
create index activity_logs_actor_idx  on public.activity_logs (store_id, actor_id, created_at desc);

create function private.can_view_all_activity(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.store_members where store_id = p_store and user_id = auth.uid() and role in ('owner', 'manager'));
$$;

alter table public.activity_logs enable row level security;
revoke all on public.activity_logs from anon, authenticated;
grant all on public.activity_logs to service_role;
grant select on public.activity_logs to authenticated;
create policy activity_read on public.activity_logs for select to authenticated
  using (private.is_super_admin()
         or (private.is_member(store_id) and (actor_id = auth.uid() or private.can_view_all_activity(store_id))));

-- Única porta de escrita do histórico. Ignora loja que está sendo apagada (cascata).
create function private.log_activity(p_store uuid, p_action text, p_type text, p_entity uuid, p_name text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.stores where id = p_store) then return; end if;
  insert into public.activity_logs (store_id, actor_id, action, entity_type, entity_id, entity_name, details)
  values (p_store, auth.uid(), p_action, p_type, p_entity, left(p_name, 120), coalesce(p_details, '{}'));
end $$;

-- ---------------------------------------------------------------- gatilhos
create function private.trg_log_product() returns trigger language plpgsql security definer set search_path = '' as $$
declare ch jsonb := '{}';
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.store_id, 'product.created', 'product', new.id, new.name,
                                 jsonb_build_object('price', new.price, 'source', new.source));
    return new;
  elsif tg_op = 'DELETE' then
    perform private.log_activity(old.store_id, 'product.deleted', 'product', old.id, old.name);
    return old;
  end if;

  if new.status is distinct from old.status then
    perform private.log_activity(new.store_id, 'product.status', 'product', new.id, new.name,
                                 jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.name is distinct from old.name then ch := ch || jsonb_build_object('name', jsonb_build_array(old.name, new.name)); end if;
  if new.price is distinct from old.price then ch := ch || jsonb_build_object('price', jsonb_build_array(old.price, new.price)); end if;
  if new.promo_price is distinct from old.promo_price then ch := ch || jsonb_build_object('promo_price', jsonb_build_array(old.promo_price, new.promo_price)); end if;
  if new.is_featured is distinct from old.is_featured then ch := ch || jsonb_build_object('featured', jsonb_build_array(old.is_featured, new.is_featured)); end if;
  if new.color is distinct from old.color then ch := ch || jsonb_build_object('color', jsonb_build_array(old.color, new.color)); end if;
  if new.sizes is distinct from old.sizes then ch := ch || jsonb_build_object('sizes', jsonb_build_array(old.sizes, new.sizes)); end if;
  if new.category_id is distinct from old.category_id then ch := ch || jsonb_build_object('category', true); end if;
  if new.sku is distinct from old.sku then ch := ch || jsonb_build_object('sku', true); end if;
  if new.description is distinct from old.description then ch := ch || jsonb_build_object('description', true); end if;
  if new.video_url is distinct from old.video_url then ch := ch || jsonb_build_object('video', true); end if;
  if ch <> '{}'::jsonb then
    perform private.log_activity(new.store_id, 'product.updated', 'product', new.id, new.name, jsonb_build_object('changes', ch));
  end if;
  return new;
end $$;
create trigger products_log after insert or update or delete on public.products for each row execute function private.trg_log_product();

create function private.trg_log_collection() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform private.log_activity(new.store_id, 'collection.created', 'collection', new.id, new.name, jsonb_build_object('kind', new.kind));
  elsif tg_op = 'DELETE' then perform private.log_activity(old.store_id, 'collection.deleted', 'collection', old.id, old.name);
  elsif new.name is distinct from old.name or new.is_published is distinct from old.is_published or new.kind is distinct from old.kind
        or new.new_arrivals_days is distinct from old.new_arrivals_days or new.description is distinct from old.description then
    perform private.log_activity(new.store_id, 'collection.updated', 'collection', new.id, new.name,
      jsonb_build_object('published', jsonb_build_array(old.is_published, new.is_published), 'renamed', new.name is distinct from old.name));
  end if;
  return coalesce(new, old);
end $$;
create trigger collections_log after insert or update or delete on public.collections for each row execute function private.trg_log_collection();

create function private.trg_log_category() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform private.log_activity(new.store_id, 'category.created', 'category', new.id, new.name);
  elsif tg_op = 'DELETE' then perform private.log_activity(old.store_id, 'category.deleted', 'category', old.id, old.name);
  elsif new.name is distinct from old.name or new.parent_id is distinct from old.parent_id then
    perform private.log_activity(new.store_id, 'category.updated', 'category', new.id, new.name, jsonb_build_object('from', old.name));
  end if;
  return coalesce(new, old);
end $$;
create trigger categories_log after insert or update or delete on public.categories for each row execute function private.trg_log_category();

create function private.trg_log_member() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select full_name into v_name from public.profiles where id = coalesce(new.user_id, old.user_id);
  if tg_op = 'INSERT' then
    perform private.log_activity(new.store_id, 'member.added', 'member', new.user_id, v_name, jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform private.log_activity(old.store_id, case when old.user_id = auth.uid() then 'member.left' else 'member.removed' end,
                                 'member', old.user_id, v_name, jsonb_build_object('role', old.role));
  elsif new.role is distinct from old.role then
    perform private.log_activity(new.store_id, 'member.role', 'member', new.user_id, v_name, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return coalesce(new, old);
end $$;
create trigger members_log after insert or update or delete on public.store_members for each row execute function private.trg_log_member();

-- Movimentações de estoque viram atividades (o estoque inicial já aparece em "produto criado").
-- Reservas e liberações não copiam o nome da cliente para o histórico.
create function private.trg_log_movement() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.reason = 'initial' then return new; end if;
  select name into v_name from public.products where id = new.product_id;
  perform private.log_activity(new.store_id, 'stock.' || new.reason::text, 'product', new.product_id, v_name,
                               jsonb_build_object('delta', new.delta, 'after', new.quantity_after));
  return new;
end $$;
create trigger movements_log after insert on public.inventory_movements for each row execute function private.trg_log_movement();

create function private.trg_log_image() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text; v_store uuid := coalesce(new.store_id, old.store_id); v_prod uuid := coalesce(new.product_id, old.product_id);
begin
  select name into v_name from public.products where id = v_prod;
  if v_name is null then return coalesce(new, old); end if;   -- produto sendo apagado
  perform private.log_activity(v_store, case when tg_op = 'INSERT' then 'image.added' else 'image.removed' end, 'product', v_prod, v_name);
  return coalesce(new, old);
end $$;
create trigger images_log after insert or delete on public.product_images for each row execute function private.trg_log_image();

create function private.trg_log_store() returns trigger language plpgsql security definer set search_path = '' as $$
declare ch text[] := '{}';
begin
  if new.is_active is distinct from old.is_active then
    perform private.log_activity(new.id, 'store.active', 'store', new.id, new.name, jsonb_build_object('active', new.is_active));
  end if;
  if new.catalog_enabled is distinct from old.catalog_enabled then
    perform private.log_activity(new.id, 'store.catalog', 'store', new.id, new.name, jsonb_build_object('enabled', new.catalog_enabled));
  end if;
  if new.name is distinct from old.name then ch := array_append(ch, 'nome'); end if;
  if new.tagline is distinct from old.tagline or new.description is distinct from old.description then ch := array_append(ch, 'textos'); end if;
  if new.whatsapp is distinct from old.whatsapp then ch := array_append(ch, 'WhatsApp'); end if;
  if new.instagram_handle is distinct from old.instagram_handle then ch := array_append(ch, 'Instagram'); end if;
  if new.address is distinct from old.address or new.opening_hours is distinct from old.opening_hours then ch := array_append(ch, 'endereço e horário'); end if;
  if new.logo_path is distinct from old.logo_path then ch := array_append(ch, 'logo'); end if;
  if new.banner_path is distinct from old.banner_path then ch := array_append(ch, 'banner'); end if;
  if new.hide_sold_out is distinct from old.hide_sold_out then ch := array_append(ch, 'ocultar esgotados'); end if;
  if new.accent_color is distinct from old.accent_color then ch := array_append(ch, 'cor de destaque'); end if;
  if array_length(ch, 1) > 0 then
    perform private.log_activity(new.id, 'store.updated', 'store', new.id, new.name, jsonb_build_object('fields', to_jsonb(ch)));
  end if;
  return new;
end $$;
create trigger stores_log after update on public.stores for each row execute function private.trg_log_store();

-- Lista de espera: registra a peça, nunca o nome nem o telefone da cliente (pedido de exclusão não deixa rastro).
create function private.trg_log_interest() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select name into v_name from public.products where id = new.product_id;
  if tg_op = 'INSERT' then
    perform private.log_activity(new.store_id, 'interest.added', 'product', new.product_id, v_name);
  elsif new.status is distinct from old.status then
    perform private.log_activity(new.store_id, 'interest.status', 'product', new.product_id, v_name, jsonb_build_object('to', new.status));
  end if;
  return new;
end $$;
create trigger interests_log after insert or update on public.product_interests for each row execute function private.trg_log_interest();

-- ================================================================ funções de convite
create function public.create_invite(p_store uuid, p_role public.store_role, p_label text default null,
                                     p_days integer default 7, p_max_uses integer default 1) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_name text;
begin
  if not private.can_write(p_store, array['owner']::public.store_role[]) then
    raise exception 'apenas o dono da loja pode convidar' using errcode = '42501';
  end if;
  if p_role not in ('manager', 'attendant') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_days is null or p_days not between 1 and 30 or p_max_uses is null or p_max_uses not between 1 and 20 then
    raise exception 'invalid_invite' using errcode = '22023';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- 64 caracteres hexadecimais
  insert into public.store_invites (store_id, token_hash, role, label, max_uses, expires_at, created_by)
  values (p_store, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_role, nullif(btrim(p_label), ''), p_max_uses,
          now() + make_interval(days => p_days), auth.uid());
  select name into v_name from public.stores where id = p_store;
  perform private.log_activity(p_store, 'invite.created', 'invite', null, nullif(btrim(p_label), ''),
                               jsonb_build_object('role', p_role, 'days', p_days, 'max_uses', p_max_uses));
  return v_token;
end $$;

create function public.revoke_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_label text;
begin
  select store_id, label into v_store, v_label from public.store_invites where id = p_id;
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.can_write(v_store, array['owner']::public.store_role[]) then
    raise exception 'apenas o dono da loja pode revogar convites' using errcode = '42501';
  end if;
  update public.store_invites set revoked_at = now() where id = p_id and revoked_at is null;
  perform private.log_activity(v_store, 'invite.revoked', 'invite', p_id, v_label);
end $$;

-- Lista de convites com a situação já calculada (só o dono enxerga, pelo RLS).
create function public.store_invites_list(p_store uuid)
returns table (id uuid, role public.store_role, label text, uses integer, max_uses integer, expires_at timestamptz,
               revoked_at timestamptz, created_at timestamptz, created_by_name text, status text)
language sql stable set search_path = '' as $$
  select i.id, i.role, i.label, i.uses, i.max_uses, i.expires_at, i.revoked_at, i.created_at, p.full_name,
         case when i.revoked_at is not null then 'revoked' when i.uses >= i.max_uses then 'used'
              when i.expires_at <= now() then 'expired' else 'active' end
  from public.store_invites i left join public.profiles p on p.id = i.created_by
  where i.store_id = p_store
  order by i.created_at desc
  limit 50;
$$;

-- Pré-visualização para quem abriu o link (sem login): mostra a loja e o papel, nunca dados internos.
create function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare inv public.store_invites; s public.stores;
begin
  select * into inv from public.store_invites where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if inv.id is null then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  select * into s from public.stores where id = inv.store_id;
  if inv.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', 'revoked'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('valid', false, 'reason', 'used'); end if;
  if inv.expires_at <= now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
  if not s.is_active then return jsonb_build_object('valid', false, 'reason', 'store_inactive'); end if;
  return jsonb_build_object('valid', true, 'store_name', s.name, 'role', inv.role, 'expires_at', inv.expires_at);
end $$;

create function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare inv public.store_invites; s public.stores; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'faça login para aceitar o convite' using errcode = '28000'; end if;
  select * into inv from public.store_invites
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') for update;
  if inv.id is null then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  select * into s from public.stores where id = inv.store_id;

  if exists (select 1 from public.store_members where store_id = inv.store_id and user_id = v_uid) then
    return jsonb_build_object('slug', s.slug, 'status', 'already_member');          -- não gasta o convite
  end if;
  if inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = '23514'; end if;
  if inv.uses >= inv.max_uses then raise exception 'invite_used' using errcode = '23514'; end if;
  if inv.expires_at <= now() then raise exception 'invite_expired' using errcode = '23514'; end if;
  if not s.is_active then raise exception 'store_inactive' using errcode = '23514'; end if;

  insert into public.store_members (store_id, user_id, role) values (inv.store_id, v_uid, inv.role);
  update public.store_invites set uses = uses + 1 where id = inv.id;
  perform private.log_activity(inv.store_id, 'invite.accepted', 'invite', inv.id, inv.label, jsonb_build_object('role', inv.role));
  return jsonb_build_object('slug', s.slug, 'role', inv.role, 'status', 'joined');
end $$;

-- ================================================================ consulta do histórico
create function public.store_activity(p_store uuid, p_actor uuid default null, p_type text default null, p_entity uuid default null,
                                      p_limit integer default 30, p_offset integer default 0)
returns table (id bigint, created_at timestamptz, action text, entity_type text, entity_id uuid, entity_name text, details jsonb,
               actor_id uuid, actor_name text, total bigint)
language sql stable set search_path = '' as $$
  select a.id, a.created_at, a.action, a.entity_type, a.entity_id, a.entity_name, a.details, a.actor_id, p.full_name, count(*) over ()
  from public.activity_logs a left join public.profiles p on p.id = a.actor_id
  where a.store_id = p_store
    and (p_actor is null or a.actor_id = p_actor)
    and (p_type is null or a.entity_type = p_type)
    and (p_entity is null or a.entity_id = p_entity)
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- ================================================================ permissões de execução
revoke execute on function public.create_invite(uuid, public.store_role, text, integer, integer) from public, anon;
revoke execute on function public.revoke_invite(uuid)                                            from public, anon;
revoke execute on function public.store_invites_list(uuid)                                       from public, anon;
revoke execute on function public.accept_invite(text)                                            from public, anon;
revoke execute on function public.store_activity(uuid, uuid, text, uuid, integer, integer)       from public, anon;
revoke execute on function public.invite_preview(text)                                           from public;
grant  execute on function public.create_invite(uuid, public.store_role, text, integer, integer) to authenticated;
grant  execute on function public.revoke_invite(uuid)                                            to authenticated;
grant  execute on function public.store_invites_list(uuid)                                       to authenticated;
grant  execute on function public.accept_invite(text)                                            to authenticated;
grant  execute on function public.store_activity(uuid, uuid, text, uuid, integer, integer)       to authenticated;
grant  execute on function public.invite_preview(text)                                           to anon, authenticated;

-- ================================================================ painel principal: últimas atividades reais
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
    -- últimas atividades (o RLS decide: dono e gerente veem tudo, atendente só as próprias)
    'recent', coalesce((
      select jsonb_agg(r)
      from (select a.id, a.created_at, a.action, a.entity_type, a.entity_name, a.details, pr.full_name as actor
            from public.activity_logs a left join public.profiles pr on pr.id = a.actor_id
            where a.store_id = p_store
            order by a.created_at desc, a.id desc limit 8) r), '[]'::jsonb)
  );
$$;

-- tempo real: a tela de atividades e a equipe se atualizam sozinhas
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_logs, public.store_invites;
  end if;
end $$;
