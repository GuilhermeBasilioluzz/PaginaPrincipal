-- HYPERION SYSTEM — todas as migrations em ordem. GERADO por scripts/build-sql.sh: não edite aqui.
-- Cole tudo no Supabase → SQL Editor → New query → Run. Rode UMA vez num projeto novo.

-- ==================================================================================
-- 20261004000001_core_schema.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 1: esquema multi-loja (tenant = loja).
-- Regras de ouro:
--   * toda tabela de negócio tem store_id;
--   * chaves estrangeiras são COMPOSTAS (store_id, id): um filho nunca aponta para o pai de outra loja;
--   * store_id nunca pode ser alterado depois de criado.
-- Segurança (RLS e permissões) fica em 20261004000002_rls.sql.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------- tipos
create type public.store_role      as enum ('owner', 'manager', 'attendant');
create type public.product_status  as enum ('available', 'reserved', 'sold', 'unavailable', 'archived');
create type public.product_source  as enum ('manual', 'instagram', 'duplicate');
create type public.collection_kind as enum ('manual', 'new_arrivals');
create type public.image_kind      as enum ('front', 'back', 'side', 'detail', 'other');

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  avatar_path    text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- lojas
create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
                          and slug <> all (array['app','admin','api','login','cadastro','entrar','loja',
                                                 'colecao','produto','static','assets','_next','suporte','planos'])),
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  tagline          text,
  description      text,
  whatsapp         text check (whatsapp ~ '^[0-9]{10,15}$'),            -- só dígitos, com DDI
  instagram_handle text check (instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  address          text,
  opening_hours    text,
  logo_path        text,
  banner_path      text,
  accent_color     text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  is_active        boolean not null default true,    -- só o Super Admin altera
  catalog_enabled  boolean not null default true,    -- o dono liga/desliga o catálogo público
  hide_sold_out    boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (logo_path   is null or logo_path   like 'stores/' || id::text || '/branding/%'),
  check (banner_path is null or banner_path like 'stores/' || id::text || '/branding/%')
);

create table public.store_members (
  store_id   uuid not null references public.stores (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.store_role not null default 'attendant',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_idx on public.store_members (user_id);

-- ---------------------------------------------------------------- categorias (parent_id = subcategoria)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  parent_id  uuid,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, id),
  unique (store_id, slug),
  check (parent_id is distinct from id),
  foreign key (store_id, parent_id) references public.categories (store_id, id) on delete set null (parent_id)
);
create index categories_parent_idx on public.categories (store_id, parent_id);

-- ---------------------------------------------------------------- coleções
-- Coleção é um agrupamento por contexto, não categoria. 'new_arrivals' é a coleção automática
-- de Novidades (produtos dos últimos N dias); a regra de montagem fica na consulta, não aqui.
create table public.collections (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text,
  cover_path        text,
  kind              public.collection_kind not null default 'manual',
  new_arrivals_days integer,
  is_published      boolean not null default true,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (store_id, id),
  unique (store_id, slug),
  check ((kind = 'new_arrivals') = (new_arrivals_days is not null)),
  check (new_arrivals_days is null or new_arrivals_days between 1 and 90),
  check (cover_path is null or cover_path like 'stores/' || store_id::text || '/branding/%')
);

-- ---------------------------------------------------------------- produtos
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  price        numeric(12,2) not null check (price >= 0),
  promo_price  numeric(12,2),
  category_id  uuid,
  color        text,
  sizes        text[] not null default '{}',
  sku          text,
  video_url    text,
  status       public.product_status not null default 'available',
  is_featured  boolean not null default false,
  source       public.product_source not null default 'manual',
  published_at timestamptz not null default now(),   -- quando entrou na vitrine (base de "novidades")
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (store_id, id),
  unique (store_id, slug),
  check (promo_price is null or (promo_price >= 0 and promo_price < price)),
  foreign key (store_id, category_id) references public.categories (store_id, id) on delete set null (category_id)
);
create unique index products_sku_uidx on public.products (store_id, sku) where sku is not null;
create index products_store_status_idx    on public.products (store_id, status);
create index products_store_published_idx on public.products (store_id, published_at desc);
create index products_category_idx        on public.products (store_id, category_id);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null,
  product_id uuid not null,
  path       text not null check (path like 'stores/' || store_id::text || '/products/%'),
  kind       public.image_kind not null default 'other',
  alt        text,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.collection_products (
  store_id      uuid not null,
  collection_id uuid not null,
  product_id    uuid not null,
  position      integer not null default 0,
  added_by      uuid references public.profiles (id) on delete set null,
  added_at      timestamptz not null default now(),
  primary key (collection_id, product_id),
  foreign key (store_id, collection_id) references public.collections (store_id, id) on delete cascade,
  foreign key (store_id, product_id)    references public.products (store_id, id)    on delete cascade
);
create index collection_products_product_idx on public.collection_products (product_id);

-- Estoque por produto (por tamanho fica para uma etapa futura, se a loja precisar).
create table public.inventory (
  product_id          uuid primary key,
  store_id            uuid not null,
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  updated_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete cascade
);
create index inventory_store_idx on public.inventory (store_id);

-- ---------------------------------------------------------------- gatilhos
create function private.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Registra quem mexeu; ignora quando não há usuário logado (service role, jobs).
create function private.stamp_product_actor() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

create function private.stamp_inventory_actor() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;

create function private.forbid_store_change() returns trigger language plpgsql as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'store_id não pode ser alterado' using errcode = '23514';
  end if;
  return new;
end $$;

create function private.create_inventory_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.inventory (product_id, store_id) values (new.id, new.store_id);
  return new;
end $$;

-- Nunca deixa a loja sem dono (exceto quando a própria loja está sendo apagada).
create function private.protect_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.stores where id = old.store_id)
     and not exists (select 1 from public.store_members
                     where store_id = old.store_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'a loja precisa ter ao menos um dono' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger profiles_touch    before update on public.profiles    for each row execute function private.set_updated_at();
create trigger stores_touch      before update on public.stores      for each row execute function private.set_updated_at();
create trigger collections_touch before update on public.collections for each row execute function private.set_updated_at();
create trigger products_touch    before update on public.products    for each row execute function private.set_updated_at();
create trigger inventory_touch   before update on public.inventory   for each row execute function private.set_updated_at();

create trigger products_actor  before insert or update on public.products for each row execute function private.stamp_product_actor();
create trigger inventory_actor before update on public.inventory          for each row execute function private.stamp_inventory_actor();

create trigger products_store_fixed    before update on public.products            for each row execute function private.forbid_store_change();
create trigger images_store_fixed      before update on public.product_images      for each row execute function private.forbid_store_change();
create trigger categories_store_fixed  before update on public.categories          for each row execute function private.forbid_store_change();
create trigger collections_store_fixed before update on public.collections         for each row execute function private.forbid_store_change();
create trigger colprod_store_fixed     before update on public.collection_products for each row execute function private.forbid_store_change();
create trigger inventory_store_fixed   before update on public.inventory           for each row execute function private.forbid_store_change();

create trigger products_inventory after insert on public.products for each row execute function private.create_inventory_row();

create trigger members_last_owner before update or delete on public.store_members
  for each row execute function private.protect_last_owner();

-- ==================================================================================
-- 20261004000002_rls.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 1: permissões e RLS.
--
-- Modelo:
--   * anon          = cliente do catálogo público: lê só dados publicáveis de lojas ativas, em colunas limitadas.
--   * authenticated = equipe: lê e escreve só nas lojas em que é membro (papel decide o que pode escrever).
--   * Super Admin   = lê tudo; só altera lojas pela função admin_set_store_active().
--   * service_role  = backend (ignora RLS). Nunca vai ao navegador.
-- IMPORTANTE: o catálogo público deve usar um cliente SEM sessão de usuário (chave anon), pois as
-- políticas públicas valem só para o papel anon.
-- Duas camadas: GRANT por coluna (o que pode ser tocado) + políticas por linha (em quais lojas).

-- ---------------------------------------------------------------- funções de apoio (schema private)
create function private.try_uuid(v text) returns uuid language plpgsql immutable as $$
begin return v::uuid; exception when others then return null; end $$;

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_super_admin);
$$;

create function private.is_member(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.store_members where store_id = p_store and user_id = auth.uid());
$$;

-- Escrita: papel adequado E loja ativa (o Super Admin pode congelar uma loja).
create function private.can_write(p_store uuid, p_roles public.store_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_members m join public.stores s on s.id = m.store_id
    where m.store_id = p_store and m.user_id = auth.uid() and m.role = any (p_roles) and s.is_active
  );
$$;

create function private.is_store_public(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores where id = p_store and is_active and catalog_enabled);
$$;

create function private.shares_store_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_members a join public.store_members b on a.store_id = b.store_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- Hierarquia: owner > manager > attendant.
-- ("todos" = qualquer papel; "gestão" = owner/manager; "dono" = owner)

-- ---------------------------------------------------------------- funções públicas (RPC)
-- Cria a loja e já torna quem chamou o dono, de forma atômica.
create function public.create_store(p_name text, p_slug text) returns public.stores
language plpgsql security definer set search_path = '' as $$
declare s public.stores;
begin
  if auth.uid() is null then
    raise exception 'faça login para criar uma loja' using errcode = '28000';
  end if;
  insert into public.stores (name, slug, created_by) values (p_name, lower(btrim(p_slug)), auth.uid())
    returning * into s;
  insert into public.store_members (store_id, user_id, role) values (s.id, auth.uid(), 'owner');
  return s;
end $$;

create function public.admin_set_store_active(p_store uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then
    raise exception 'apenas o Super Admin' using errcode = '42501';
  end if;
  update public.stores set is_active = p_active where id = p_store;
end $$;

revoke execute on function public.create_store(text, text)            from public, anon;
revoke execute on function public.admin_set_store_active(uuid, boolean) from public, anon;
grant  execute on function public.create_store(text, text)            to authenticated;
grant  execute on function public.admin_set_store_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- RLS ligado em tudo
alter table public.profiles            enable row level security;
alter table public.stores              enable row level security;
alter table public.store_members       enable row level security;
alter table public.categories          enable row level security;
alter table public.collections         enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.collection_products enable row level security;
alter table public.inventory           enable row level security;

-- ---------------------------------------------------------------- GRANTs (começa do zero)
revoke all on public.profiles, public.stores, public.store_members, public.categories, public.collections,
              public.products, public.product_images, public.collection_products, public.inventory
  from anon, authenticated;
grant all on public.profiles, public.stores, public.store_members, public.categories, public.collections,
             public.products, public.product_images, public.collection_products, public.inventory
  to service_role;

alter table public.collection_products alter column added_by set default auth.uid();

-- Público (anon): só colunas seguras. Ficam de fora: created_by/updated_by, sku, source, estoque.
grant select (id, slug, name, tagline, description, whatsapp, instagram_handle, address, opening_hours,
              logo_path, banner_path, accent_color, hide_sold_out) on public.stores to anon;
grant select (id, store_id, parent_id, name, slug, position) on public.categories to anon;
grant select (id, store_id, name, slug, description, cover_path, kind, new_arrivals_days, position)
  on public.collections to anon;
grant select (id, store_id, name, slug, description, price, promo_price, category_id, color, sizes, video_url,
              status, is_featured, published_at, created_at) on public.products to anon;
grant select (id, store_id, product_id, path, kind, alt, position) on public.product_images to anon;
grant select (store_id, collection_id, product_id, position) on public.collection_products to anon;

-- Equipe (authenticated): leitura nas tabelas; escrita só nas colunas abaixo.
grant select on public.profiles, public.stores, public.store_members, public.categories, public.collections,
                public.products, public.product_images, public.collection_products, public.inventory
  to authenticated;

grant update (full_name, avatar_path) on public.profiles to authenticated;
grant update (name, tagline, description, whatsapp, instagram_handle, address, opening_hours, logo_path,
              banner_path, accent_color, catalog_enabled, hide_sold_out) on public.stores to authenticated;
grant insert (store_id, user_id, role), update (role), delete on public.store_members to authenticated;
grant insert (store_id, parent_id, name, slug, position), update (parent_id, name, slug, position), delete
  on public.categories to authenticated;
grant insert (store_id, name, slug, description, cover_path, kind, new_arrivals_days, is_published, position),
      update (name, slug, description, cover_path, kind, new_arrivals_days, is_published, position), delete
  on public.collections to authenticated;
grant insert (store_id, name, slug, description, price, promo_price, category_id, color, sizes, sku, video_url,
              status, is_featured, source, published_at),
      update (name, slug, description, price, promo_price, category_id, color, sizes, sku, video_url,
              status, is_featured, published_at),
      delete on public.products to authenticated;
grant insert (store_id, product_id, path, kind, alt, position), update (kind, alt, position), delete
  on public.product_images to authenticated;
grant insert (store_id, collection_id, product_id, position), update (position), delete
  on public.collection_products to authenticated;
grant update (quantity, low_stock_threshold) on public.inventory to authenticated;   -- linha criada por gatilho

-- ---------------------------------------------------------------- políticas
-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_store_with(id) or private.is_super_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- stores
create policy stores_public_read on public.stores for select to anon
  using (is_active and catalog_enabled);
create policy stores_team_read on public.stores for select to authenticated
  using (private.is_member(id) or private.is_super_admin());
create policy stores_owner_update on public.stores for update to authenticated
  using (private.can_write(id, array['owner']::public.store_role[]))
  with check (private.can_write(id, array['owner']::public.store_role[]));

-- store_members (só o dono gerencia a equipe; qualquer um pode sair, exceto o último dono)
create policy members_read on public.store_members for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy members_owner_insert on public.store_members for insert to authenticated
  with check (private.can_write(store_id, array['owner']::public.store_role[]));
create policy members_owner_update on public.store_members for update to authenticated
  using (private.can_write(store_id, array['owner']::public.store_role[]))
  with check (private.can_write(store_id, array['owner']::public.store_role[]));
create policy members_owner_or_self_delete on public.store_members for delete to authenticated
  using (private.can_write(store_id, array['owner']::public.store_role[]) or user_id = auth.uid());

-- categories (gestão)
create policy categories_public_read on public.categories for select to anon
  using (private.is_store_public(store_id));
create policy categories_team_read on public.categories for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy categories_manage_insert on public.categories for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager']::public.store_role[]));
create policy categories_manage_update on public.categories for update to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager']::public.store_role[]));
create policy categories_manage_delete on public.categories for delete to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]));

-- collections (gestão)
create policy collections_public_read on public.collections for select to anon
  using (is_published and private.is_store_public(store_id));
create policy collections_team_read on public.collections for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy collections_manage_insert on public.collections for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager']::public.store_role[]));
create policy collections_manage_update on public.collections for update to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager']::public.store_role[]));
create policy collections_manage_delete on public.collections for delete to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]));

-- products (todos criam/editam; só a gestão apaga — a atendente arquiva)
create policy products_public_read on public.products for select to anon
  using (status in ('available', 'reserved', 'sold') and private.is_store_public(store_id));
create policy products_team_read on public.products for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy products_team_insert on public.products for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy products_team_update on public.products for update to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy products_manage_delete on public.products for delete to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]));

-- product_images (o anon só vê imagem de produto que a política de products já deixa ver)
create policy images_public_read on public.product_images for select to anon
  using (exists (select 1 from public.products p where p.id = product_id));
create policy images_team_read on public.product_images for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy images_team_insert on public.product_images for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy images_team_update on public.product_images for update to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy images_team_delete on public.product_images for delete to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));

-- collection_products (atendente organiza peças dentro das coleções)
create policy colprod_public_read on public.collection_products for select to anon
  using (exists (select 1 from public.collections c where c.id = collection_id)
         and exists (select 1 from public.products p where p.id = product_id));
create policy colprod_team_read on public.collection_products for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy colprod_team_insert on public.collection_products for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy colprod_team_update on public.collection_products for update to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy colprod_team_delete on public.collection_products for delete to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));

-- inventory (sem acesso público: o catálogo mostra só "disponível / poucas unidades / esgotado")
create policy inventory_team_read on public.inventory for select to authenticated
  using (private.is_member(store_id) or private.is_super_admin());
create policy inventory_team_update on public.inventory for update to authenticated
  using (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]))
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));

-- ==================================================================================
-- 20261004000003_storage.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 1: buckets e políticas de arquivos.
-- Caminho obrigatório: stores/{store_id}/{products|branding|stories}/arquivo
--   catalog (público): fotos de produtos e identidade da loja — servidas por URL pública.
--   stories (privado): imagens importadas de Stories — só a equipe da loja lê.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog', 'catalog', true,  10485760, array['image/jpeg','image/png','image/webp','image/avif','video/mp4']),
  ('stories', 'stories', false, 20971520, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

-- Quem pode mexer num arquivo: a loja vem do 2º segmento do caminho; a pasta (3º) define o papel.
create function private.can_write_object(p_name text, p_folders text[], p_roles public.store_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = 'stores'
     and (storage.foldername(p_name))[3] = any (p_folders)
     and private.try_uuid((storage.foldername(p_name))[2]) is not null
     and private.can_write(private.try_uuid((storage.foldername(p_name))[2]), p_roles);
$$;

create function private.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = 'stores'
     and private.try_uuid((storage.foldername(p_name))[2]) is not null
     and private.is_member(private.try_uuid((storage.foldername(p_name))[2]));
$$;

-- catalog: produtos = toda a equipe; branding (logo, banner) = só o dono
create policy catalog_team_read on storage.objects for select to authenticated
  using (bucket_id = 'catalog' and private.can_read_object(name));
create policy catalog_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));
create policy catalog_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])))
  with check (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));
create policy catalog_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));

-- stories: toda a equipe lê e escreve na pasta da própria loja
create policy stories_team_read on storage.objects for select to authenticated
  using (bucket_id = 'stories' and private.can_read_object(name));
create policy stories_team_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));
create policy stories_team_update on storage.objects for update to authenticated
  using (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]))
  with check (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));
create policy stories_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));

-- ==================================================================================
-- 20261004000004_team_rpc.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 2: gestão de equipe.
-- O navegador nunca lê auth.users. Estas funções expõem só o necessário:
--   store_team()          lista a equipe (e-mail visível apenas para o dono)
--   add_member_by_email() o dono adiciona alguém que JÁ tem conta (convites por e-mail: ETAPA 10)

create function public.store_team(p_store uuid)
returns table (user_id uuid, full_name text, email text, role public.store_role, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'faça login' using errcode = '28000';
  end if;
  if not (private.is_member(p_store) or private.is_super_admin()) then
    raise exception 'sem acesso a esta loja' using errcode = '42501';
  end if;
  v_owner := exists (select 1 from public.store_members m
                     where m.store_id = p_store and m.user_id = auth.uid() and m.role = 'owner');
  return query
    select m.user_id, p.full_name,
           case when v_owner then u.email else null end,
           m.role, m.created_at
    from public.store_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.store_id = p_store
    order by m.role, p.full_name, m.created_at;
end $$;

create function public.add_member_by_email(p_store uuid, p_email text, p_role public.store_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  -- a checagem de permissão vem ANTES da busca, para não revelar quais e-mails têm conta
  if not private.can_write(p_store, array['owner']::public.store_role[]) then
    raise exception 'apenas o dono da loja pode adicionar membros' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002',
      hint = 'A pessoa precisa criar uma conta no Hyperion primeiro.';
  end if;
  if exists (select 1 from public.store_members where store_id = p_store and user_id = v_user) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  insert into public.store_members (store_id, user_id, role) values (p_store, v_user, p_role);
end $$;

revoke execute on function public.store_team(uuid)                                from public, anon;
revoke execute on function public.add_member_by_email(uuid, text, public.store_role) from public, anon;
grant  execute on function public.store_team(uuid)                                to authenticated;
grant  execute on function public.add_member_by_email(uuid, text, public.store_role) to authenticated;

-- ==================================================================================
-- 20261004000005_reserved_slugs.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 2: endereços reservados para as rotas do app (mantenha igual a src/lib/slug.ts).
alter table public.stores drop constraint stores_slug_check;
alter table public.stores add constraint stores_slug_check
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
         and slug <> all (array['app','admin','api','login','cadastro','entrar','loja','colecao','produto',
                                'static','assets','_next','suporte','planos','auth','recuperar-senha',
                                'redefinir-senha','termos','privacidade','perfil','robots','sitemap']));

-- ==================================================================================
-- 20261004000006_store_dashboard.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 3: números do painel da loja numa única consulta.
-- SECURITY INVOKER (padrão): roda com as permissões de quem chamou, então o RLS continua valendo.
-- Quem não é da equipe recebe tudo zerado; nunca dados de outra loja.
-- Visualizações, cliques e Stories importados entram nas ETAPAS 12 e 15.

create function public.store_dashboard(p_store uuid) returns jsonb
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

revoke execute on function public.store_dashboard(uuid) from public, anon;
grant  execute on function public.store_dashboard(uuid) to authenticated;

-- ==================================================================================
-- 20261004000007_product_functions.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 4: gravar produto + estoque de forma atômica, slug único e duplicação.
-- Todas as funções são SECURITY INVOKER: rodam com as permissões de quem chamou, então RLS e GRANTs
-- por coluna continuam valendo (atendente grava, só gestão apaga, nada atravessa lojas).

-- Gera um endereço único dentro da loja: "vestido-midi", "vestido-midi-2", "vestido-midi-3"...
create function private.next_product_slug(p_store uuid, p_base text) returns text
language plpgsql stable set search_path = '' as $$
declare v_base text; v text; n int := 1;
begin
  v_base := left(btrim(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9]+', '-', 'g'), '-'), 60);
  v_base := btrim(v_base, '-');
  if v_base = '' then v_base := 'produto'; end if;
  v := v_base;
  while exists (select 1 from public.products where store_id = p_store and slug = v) loop
    n := n + 1;
    v := v_base || '-' || n;
  end loop;
  return v;
end $$;

-- Cria (p_id nulo) ou atualiza um produto e já grava o estoque, tudo ou nada.
-- p: name, slug_base, description, price, promo_price, category_id, color, sizes[], sku, video_url,
--    status, featured, quantity. O endereço (slug) é definido na criação e não muda depois,
--    para os links já compartilhados continuarem valendo. Sem "status", mantém o atual.
create function public.save_product(p_store uuid, p_id uuid, p jsonb) returns uuid
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
    update public.inventory set quantity = (p ->> 'quantity')::integer where product_id = v_id;
  end if;
  return v_id;
end $$;

-- Duplica um produto (mesmo modelo, outra cor/tamanho). A cópia nasce INDISPONÍVEL (fora do catálogo
-- público) e sem estoque nem SKU, para ninguém publicar por engano; segue nas mesmas coleções.
create function public.duplicate_product(p_product uuid) returns uuid
language plpgsql set search_path = '' as $$
declare src public.products; v_id uuid;
begin
  select * into src from public.products where id = p_product;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.products (store_id, name, slug, description, price, promo_price, category_id, color,
                               sizes, sku, video_url, status, is_featured, source)
  values (src.store_id, left(src.name, 105) || ' (cópia)', private.next_product_slug(src.store_id, left(src.slug, 50) || '-copia'),
          src.description, src.price, src.promo_price, src.category_id, src.color, src.sizes, null,
          src.video_url, 'unavailable', false, 'duplicate')
  returning id into v_id;

  insert into public.collection_products (store_id, collection_id, product_id)
  select store_id, collection_id, v_id from public.collection_products where product_id = p_product;
  return v_id;
end $$;

revoke execute on function public.save_product(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.duplicate_product(uuid)        from public, anon;
grant  execute on function public.save_product(uuid, uuid, jsonb) to authenticated;
grant  execute on function public.duplicate_product(uuid)        to authenticated;

-- ==================================================================================
-- 20261004000008_product_images.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 5: regras das fotos dos produtos.
--   * no máximo 8 fotos por produto;
--   * a posição é atribuída pelo banco (sempre no fim); posição 0 = foto principal;
--   * reordenar é atômico e só aceita exatamente as fotos daquele produto.
-- Os arquivos ficam no Storage (bucket "catalog"); aqui só o registro. Funções SECURITY INVOKER: o RLS vale.

create function private.prepare_product_image() returns trigger
language plpgsql set search_path = '' as $$
declare n integer; last_pos integer;
begin
  select count(*), coalesce(max(position), -1) into n, last_pos
  from public.product_images where product_id = new.product_id;
  if n >= 8 then
    raise exception 'limit_reached' using errcode = '23514', hint = 'Cada produto aceita até 8 fotos.';
  end if;
  new.position := last_pos + 1;
  return new;
end $$;

create trigger product_images_prepare before insert on public.product_images
  for each row execute function private.prepare_product_image();

-- p_ids = todas as fotos do produto, na nova ordem. A primeira vira a principal.
create function public.reorder_product_images(p_product uuid, p_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare total integer;
begin
  select count(*) into total from public.product_images where product_id = p_product;
  if total = 0
     or cardinality(p_ids) <> total
     or (select count(distinct x) from unnest(p_ids) x) <> total
     or exists (select 1 from unnest(p_ids) i
                where not exists (select 1 from public.product_images where id = i and product_id = p_product)) then
    raise exception 'invalid_order' using errcode = '22023';
  end if;

  update public.product_images pi set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where pi.id = o.id;
end $$;

revoke execute on function public.reorder_product_images(uuid, uuid[]) from public, anon;
grant  execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;

-- ==================================================================================
-- 20261004000009_categories_collections.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 6: categorias, coleções e associação produto ↔ coleção.
-- Funções SECURITY INVOKER (RLS e GRANTs por coluna valem), exceto create_store (já era definer).
--   * categoria: até 2 níveis (categoria > subcategoria);
--   * coleção: "manual" (peças escolhidas) ou "new_arrivals" (Novidades: monta sozinha pelos últimos N dias);
--   * collection_items() é a fonte única do conteúdo de uma coleção — o painel e o catálogo público usam a mesma.

-- ---------------------------------------------------------------- endereços únicos por loja
create function private.next_slug(p_table text, p_store uuid, p_base text) returns text
language plpgsql stable set search_path = '' as $$
declare v_base text; v text; n int := 1; taken boolean;
begin
  if p_table not in ('categories', 'collections') then
    raise exception 'tabela inválida';
  end if;
  v_base := btrim(left(btrim(regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9]+', '-', 'g'), '-'), 60), '-');
  if v_base = '' then v_base := 'item'; end if;
  v := v_base;
  loop
    execute format('select exists (select 1 from public.%I where store_id = $1 and slug = $2)', p_table)
      into taken using p_store, v;
    exit when not taken;
    n := n + 1;
    v := v_base || '-' || n;
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------- categorias
create function private.check_category_depth() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
      raise exception 'depth_exceeded' using errcode = '23514', hint = 'Subcategorias não podem ter subcategorias.';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'has_children' using errcode = '23514', hint = 'Esta categoria já tem subcategorias.';
    end if;
  end if;
  return new;
end $$;

create trigger categories_depth before insert or update of parent_id on public.categories
  for each row execute function private.check_category_depth();

-- p: name, slug_base, parent_id. O endereço é definido na criação e não muda (links compartilhados).
create function public.save_category(p_store uuid, p_id uuid, p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.categories (store_id, name, slug, parent_id)
    values (p_store, p ->> 'name', private.next_slug('categories', p_store, p ->> 'slug_base'),
            nullif(p ->> 'parent_id', '')::uuid)
    returning id into v_id;
  else
    update public.categories
       set name = p ->> 'name', parent_id = nullif(p ->> 'parent_id', '')::uuid
     where id = p_id and store_id = p_store
    returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------- coleções
-- p: name, slug_base, description, kind ('manual'|'new_arrivals'), days, published
create function public.save_collection(p_store uuid, p_id uuid, p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_kind public.collection_kind := coalesce(nullif(p ->> 'kind', ''), 'manual')::public.collection_kind;
  v_days integer := case when coalesce(nullif(p ->> 'kind', ''), 'manual') = 'new_arrivals'
                         then coalesce(nullif(p ->> 'days', '')::integer, 7) end;
begin
  if p_id is null then
    insert into public.collections (store_id, name, slug, description, kind, new_arrivals_days, is_published)
    values (p_store, p ->> 'name', private.next_slug('collections', p_store, p ->> 'slug_base'),
            nullif(p ->> 'description', ''), v_kind, v_days, coalesce((p ->> 'published')::boolean, true))
    returning id into v_id;
  else
    update public.collections
       set name = p ->> 'name', description = nullif(p ->> 'description', ''), kind = v_kind,
           new_arrivals_days = v_days, is_published = coalesce((p ->> 'published')::boolean, true)
     where id = p_id and store_id = p_store
    returning id into v_id;
    if v_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- Conteúdo de uma coleção: manual = peças escolhidas; Novidades = peças publicadas nos últimos N dias.
-- Para o público (anon) o RLS já esconde coleção não publicada e produto fora do catálogo.
create function public.collection_items(p_collection uuid)
returns table (product_id uuid, "position" integer, added_at timestamptz)
language sql stable set search_path = '' as $$
  select * from (
    select cp.product_id, cp.position, cp.added_at
    from public.collection_products cp
    join public.collections c on c.id = cp.collection_id
    where c.id = p_collection and c.kind = 'manual'
    union all
    select p.id, 0, p.published_at
    from public.collections c
    join public.products p on p.store_id = c.store_id
    where c.id = p_collection and c.kind = 'new_arrivals'
      and p.status in ('available', 'reserved', 'sold')
      and p.published_at >= now() - make_interval(days => c.new_arrivals_days)
  ) items
  order by "position", added_at desc;
$$;

create function public.store_collections_overview(p_store uuid)
returns table (id uuid, name text, slug text, description text, kind public.collection_kind,
               new_arrivals_days integer, is_published boolean, item_count bigint)
language sql stable set search_path = '' as $$
  select c.id, c.name, c.slug, c.description, c.kind, c.new_arrivals_days, c.is_published,
         (select count(*) from public.collection_items(c.id))
  from public.collections c
  where c.store_id = p_store
  order by c.kind desc, c.position, c.created_at;
$$;

-- Troca, de uma vez, as coleções MANUAIS de um produto. Coleções de outra loja ou automáticas são ignoradas.
create function public.set_product_collections(p_product uuid, p_collections uuid[]) returns void
language plpgsql set search_path = '' as $$
declare v_store uuid;
begin
  select store_id into v_store from public.products where id = p_product;
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;

  delete from public.collection_products cp
   where cp.product_id = p_product
     and cp.collection_id <> all (coalesce(p_collections, '{}'));

  insert into public.collection_products (store_id, collection_id, product_id)
  select c.store_id, c.id, p_product
  from public.collections c
  where c.id = any (coalesce(p_collections, '{}')) and c.store_id = v_store and c.kind = 'manual'
  on conflict do nothing;
end $$;

create function public.add_products_to_collection(p_collection uuid, p_products uuid[]) returns integer
language plpgsql set search_path = '' as $$
declare v_store uuid; v_kind public.collection_kind; n integer;
begin
  select store_id, kind into v_store, v_kind from public.collections where id = p_collection;
  if v_store is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_kind <> 'manual' then raise exception 'automatic_collection' using errcode = '23514'; end if;

  insert into public.collection_products (store_id, collection_id, product_id)
  select p.store_id, p_collection, p.id from public.products p
  where p.id = any (coalesce(p_products, '{}')) and p.store_id = v_store
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- toda loja nova já nasce com "Novidades"
create or replace function public.create_store(p_name text, p_slug text) returns public.stores
language plpgsql security definer set search_path = '' as $$
declare s public.stores;
begin
  if auth.uid() is null then
    raise exception 'faça login para criar uma loja' using errcode = '28000';
  end if;
  insert into public.stores (name, slug, created_by) values (p_name, lower(btrim(p_slug)), auth.uid())
    returning * into s;
  insert into public.store_members (store_id, user_id, role) values (s.id, auth.uid(), 'owner');
  insert into public.collections (store_id, name, slug, description, kind, new_arrivals_days, position)
  values (s.id, 'Novidades', 'novidades', 'As peças que acabaram de chegar.', 'new_arrivals', 7, -1);
  return s;
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke execute on function public.save_category(uuid, uuid, jsonb)                from public, anon;
revoke execute on function public.save_collection(uuid, uuid, jsonb)              from public, anon;
revoke execute on function public.store_collections_overview(uuid)                from public, anon;
revoke execute on function public.set_product_collections(uuid, uuid[])           from public, anon;
revoke execute on function public.add_products_to_collection(uuid, uuid[])        from public, anon;
grant  execute on function public.save_category(uuid, uuid, jsonb)                to authenticated;
grant  execute on function public.save_collection(uuid, uuid, jsonb)              to authenticated;
grant  execute on function public.store_collections_overview(uuid)                to authenticated;
grant  execute on function public.set_product_collections(uuid, uuid[])           to authenticated;
grant  execute on function public.add_products_to_collection(uuid, uuid[])        to authenticated;
-- collection_items também serve ao catálogo público (anon): o RLS decide o que aparece.
revoke execute on function public.collection_items(uuid) from public;
grant  execute on function public.collection_items(uuid) to anon, authenticated;

-- A ordenação por "mais recentes primeiro" usa a data de inclusão; liberar só essa coluna ao público.
grant select (added_at) on public.collection_products to anon;

-- ==================================================================================
-- 20261004000010_stock_reservations.sql
-- ==================================================================================
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

-- ==================================================================================
-- 20261004000011_public_catalog.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 8: consultas do catálogo público (cliente anônimo).
--
-- Por que SECURITY DEFINER aqui: a cliente anônima NÃO pode ler estoque, reservas, SKU nem autores — mas o catálogo
-- precisa mostrar "Esgotado / Reservado / Poucas unidades". Estas funções leem o que precisam por dentro e devolvem
-- SÓ colunas seguras e rótulos (nunca quantidades). Toda leitura parte de private.public_store(): loja ativa e com
-- catálogo ligado; qualquer outra coisa devolve vazio. Uma chamada traz tudo que a página precisa (sem N+1).
--
-- Visível ao público: situação disponível, reservado ou vendido (vendido aparece como "Esgotado", a não ser que a loja
-- tenha escolhido ocultar esgotados). Indisponível e arquivado nunca aparecem.

create extension if not exists unaccent with schema extensions;

create function private.public_store(p_slug text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.stores where slug = lower(btrim(coalesce(p_slug, ''))) and is_active and catalog_enabled;
$$;

create function private.public_products(p_store uuid)
returns table (id uuid, name text, slug text, description text, price numeric, promo_price numeric, color text,
               sizes text[], is_featured boolean, published_at timestamptz, category_id uuid, stock_label text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.slug, p.description, p.price, p.promo_price, p.color, p.sizes, p.is_featured, p.published_at, p.category_id,
         case
           when p.status = 'sold' or i.quantity = 0 then 'sold_out'
           when p.status = 'reserved' or i.quantity - r.reserved <= 0 then 'reserved'
           when i.quantity - r.reserved <= i.low_stock_threshold then 'low'
           else 'available'
         end
  from public.products p
  join public.inventory i on i.product_id = p.id
  join public.stores s on s.id = p.store_id
  cross join lateral (
    select coalesce(sum(x.quantity), 0)::integer as reserved from public.reservations x
    where x.product_id = p.id and x.status in ('requested', 'confirmed') and (x.expires_at is null or x.expires_at > now())
  ) r
  where p.store_id = p_store
    and p.status in ('available', 'reserved', 'sold')
    and not (s.hide_sold_out and (p.status = 'sold' or i.quantity = 0));
$$;

-- Dados da loja + filtros disponíveis (categorias, coleções, cores, tamanhos, faixa de preço). null = loja indisponível.
create function public.catalog_store(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  vis as materialized (select pp.* from st, private.public_products(st.id) pp)
  select case when (select id from st) is null then null else jsonb_build_object(
    'store', (select jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'tagline', s.tagline, 'description', s.description,
                                        'whatsapp', s.whatsapp, 'instagram_handle', s.instagram_handle, 'address', s.address,
                                        'opening_hours', s.opening_hours, 'logo_path', s.logo_path, 'banner_path', s.banner_path,
                                        'accent_color', s.accent_color)
              from public.stores s where s.id = (select id from st)),
    'total', (select count(*) from vis),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'parent_slug', pc.slug,
               'count', (select count(*) from vis v where v.category_id = c.id
                          or (c.parent_id is null and v.category_id in (select k.id from public.categories k where k.parent_id = c.id))))
             order by c.position, c.name)
      from public.categories c left join public.categories pc on pc.id = c.parent_id
      where c.store_id = (select id from st)), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'automatic', c.kind = 'new_arrivals',
               'count', case when c.kind = 'manual'
                             then (select count(*) from public.collection_products cp where cp.collection_id = c.id and cp.product_id in (select id from vis))
                             else (select count(*) from vis v where v.published_at >= now() - make_interval(days => c.new_arrivals_days)) end)
             order by c.kind desc, c.position, c.name)
      from public.collections c where c.store_id = (select id from st) and c.is_published), '[]'::jsonb),
    'colors', coalesce((select jsonb_agg(color order by color) from (select distinct color from vis where color is not null) q), '[]'::jsonb),
    'sizes',  coalesce((select jsonb_agg(sz) from (select distinct unnest(sizes) as sz from vis) q), '[]'::jsonb),
    'price_min', (select min(coalesce(promo_price, price)) from vis),
    'price_max', (select max(coalesce(promo_price, price)) from vis)
  ) end;
$$;

-- Lista paginada com busca e filtros. p_sort: new | price_asc | price_desc | name. Esgotados vão sempre para o fim.
-- Busca: sem acento e sem diferenciar maiúsculas (tira o acento ANTES de passar para minúsculas: funciona em qualquer idioma do banco); todas as palavras precisam aparecer (nome, descrição, cor ou categoria).
create function public.catalog_products(
  p_slug text, p_q text default '', p_category text default '', p_collection text default '', p_color text default '',
  p_size text default '', p_min numeric default null, p_max numeric default null, p_in_stock boolean default false,
  p_sort text default 'new', p_limit integer default 24, p_offset integer default 0)
returns table (id uuid, name text, slug text, price numeric, promo_price numeric, color text, sizes text[], is_featured boolean,
               published_at timestamptz, stock_label text, cover_path text, total bigint)
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  vis as materialized (select pp.* from st, private.public_products(st.id) pp),
  cat as (select c.id from st join public.categories c on c.store_id = st.id where coalesce(p_category, '') <> '' and c.slug = p_category),
  cat_ids as (select id from cat union select k.id from public.categories k join cat on k.parent_id = cat.id),
  col as (select c.id, c.kind, c.new_arrivals_days from st join public.collections c on c.store_id = st.id
          where coalesce(p_collection, '') <> '' and c.slug = p_collection and c.is_published),
  terms as (
    select t from unnest(regexp_split_to_array(lower(extensions.unaccent(left(btrim(coalesce(p_q, '')), 80))), '\s+')) t
    where length(t) >= 2 and t <> all (array['de','da','do','das','dos','para','com','em','na','no','um','uma','tamanho','cor','roupa','roupas','peca','pecas'])
  )
  select v.id, v.name, v.slug, v.price, v.promo_price, v.color, v.sizes, v.is_featured, v.published_at, v.stock_label,
         (select pi.path from public.product_images pi where pi.product_id = v.id order by pi.position limit 1),
         count(*) over ()
  from vis v
  left join public.categories ct on ct.id = v.category_id
  where (coalesce(p_category, '') = '' or v.category_id in (select id from cat_ids))
    and (coalesce(p_collection, '') = '' or exists (
          select 1 from col where (col.kind = 'manual' and exists (select 1 from public.collection_products cp where cp.collection_id = col.id and cp.product_id = v.id))
                               or (col.kind = 'new_arrivals' and v.published_at >= now() - make_interval(days => col.new_arrivals_days))))
    and (coalesce(p_color, '') = '' or lower(v.color) = lower(p_color))
    and (coalesce(p_size, '') = '' or exists (select 1 from unnest(v.sizes) z where lower(z) = lower(p_size)))
    and (p_min is null or coalesce(v.promo_price, v.price) >= p_min)
    and (p_max is null or coalesce(v.promo_price, v.price) <= p_max)
    and (not coalesce(p_in_stock, false) or v.stock_label in ('available', 'low'))
    and not exists (
          select 1 from terms
          where lower(extensions.unaccent(v.name || ' ' || coalesce(v.description, '') || ' ' || coalesce(v.color, '') || ' ' || coalesce(ct.name, '')))
                not like '%' || replace(replace(replace(terms.t, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\')
  order by (v.stock_label = 'sold_out'),
           case when p_sort = 'price_asc'  then coalesce(v.promo_price, v.price) end asc,
           case when p_sort = 'price_desc' then coalesce(v.promo_price, v.price) end desc,
           case when p_sort = 'name'       then v.name end asc,
           case when coalesce(p_sort, 'new') not in ('price_asc', 'price_desc', 'name') then v.published_at end desc,
           v.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48) offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.catalog_store(text) from public;
revoke execute on function public.catalog_products(text, text, text, text, text, text, numeric, numeric, boolean, text, integer, integer) from public;
grant  execute on function public.catalog_store(text) to anon, authenticated;
grant  execute on function public.catalog_products(text, text, text, text, text, text, numeric, numeric, boolean, text, integer, integer) to anon, authenticated;
-- as funções de apoio ficam no schema private e não são chamadas pelo navegador
revoke execute on function private.public_store(text)     from public, anon, authenticated;
revoke execute on function private.public_products(uuid) from public, anon, authenticated;

-- ==================================================================================
-- 20261004000012_product_interests.sql
-- ==================================================================================
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

-- ==================================================================================
-- 20261004000013_related_products.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 9: "Você também pode gostar" e categoria na página da peça.
--
-- Relacionadas = peças visíveis da MESMA loja, pontuadas por afinidade:
--   +3 mesma coleção (manual)   +2 mesma categoria   +1 categoria vizinha (pai/filha/irmã)   +1 mesma cor
-- Esgotadas vão para o fim; empate = mais novas primeiro. Se houver poucas afinidades, completa com as mais novas
-- (a página nunca fica com a vitrine vazia). Só colunas seguras e rótulos de estoque, como no resto do catálogo.

create function public.catalog_related(p_slug text, p_product text, p_limit integer default 8)
returns table (id uuid, name text, slug text, price numeric, promo_price numeric, color text, sizes text[], is_featured boolean,
               published_at timestamptz, stock_label text, cover_path text, score integer)
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  vis as materialized (select pp.* from st, private.public_products(st.id) pp),
  me as (select v.id, v.color, v.category_id, c.parent_id from vis v left join public.categories c on c.id = v.category_id
         where v.slug = lower(btrim(coalesce(p_product, '')))),
  my_cols as (select cp.collection_id from me join public.collection_products cp on cp.product_id = me.id
              join public.collections c on c.id = cp.collection_id and c.is_published and c.kind = 'manual')
  select v.id, v.name, v.slug, v.price, v.promo_price, v.color, v.sizes, v.is_featured, v.published_at, v.stock_label,
         (select pi.path from public.product_images pi where pi.product_id = v.id order by pi.position limit 1),
         (case when exists (select 1 from public.collection_products cp where cp.product_id = v.id and cp.collection_id in (select collection_id from my_cols)) then 3 else 0 end
        + case when v.category_id is not null and v.category_id = me.category_id then 2
               when v.category_id is not null and me.category_id is not null
                    and (vc.parent_id = me.category_id or v.category_id = me.parent_id or (vc.parent_id is not null and vc.parent_id = me.parent_id)) then 1
               else 0 end
        + case when v.color is not null and me.color is not null and lower(v.color) = lower(me.color) then 1 else 0 end)::integer as score
  from vis v
  cross join me
  left join public.categories vc on vc.id = v.category_id
  where v.id <> me.id
  order by (v.stock_label = 'sold_out'), 12 desc, v.published_at desc, v.id
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

revoke execute on function public.catalog_related(text, text, integer) from public;
grant  execute on function public.catalog_related(text, text, integer) to anon, authenticated;

-- catalog_product agora também devolve a categoria (e a principal, se for subcategoria) para o caminho de navegação
create or replace function public.catalog_product(p_slug text, p_product text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  pr as (select pp.* from st, private.public_products(st.id) pp where pp.slug = lower(btrim(coalesce(p_product, '')))),
  cat as (select c.name, c.slug, pc.name as parent_name, pc.slug as parent_slug
          from pr join public.categories c on c.id = pr.category_id left join public.categories pc on pc.id = c.parent_id)
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
    'category', (select jsonb_build_object('name', name, 'slug', slug, 'parent_name', parent_name, 'parent_slug', parent_slug) from cat),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) order by c.kind desc, c.position, c.name)
      from public.collections c
      where c.store_id = (select id from st) and c.is_published
        and ((c.kind = 'manual' and exists (select 1 from public.collection_products cp where cp.collection_id = c.id and cp.product_id = (select id from pr)))
          or (c.kind = 'new_arrivals' and (select published_at from pr) >= now() - make_interval(days => c.new_arrivals_days)))), '[]'::jsonb),
    'interest_open', (select stock_label in ('sold_out', 'reserved') from pr)
  ) end;
$$;

-- ==================================================================================
-- 20261004000014_reserved_slugs_2.sql
-- ==================================================================================
-- HYPERION SYSTEM — ETAPA 10: "convite" passa a ser endereço do sistema (mantenha igual a src/lib/slug.ts).
alter table public.stores drop constraint stores_slug_check;
alter table public.stores add constraint stores_slug_check
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
         and slug <> all (array['app','admin','api','login','cadastro','entrar','loja','colecao','produto',
                                'static','assets','_next','suporte','planos','auth','recuperar-senha',
                                'redefinir-senha','termos','privacidade','perfil','robots','sitemap','convite']));

-- ==================================================================================
-- 20261004000015_team_invites_activity.sql
-- ==================================================================================
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

-- ==================================================================================
-- 20261004000016_catalog_filters.sql
-- ==================================================================================
-- HYPERION SYSTEM — filtros do catálogo por loja: público (feminino/masculino/unissex/infantil), estilo e "seleção de filtros".
--
-- Cada loja escolhe QUAIS filtros a cliente vê (stores.catalog_filters) e QUAIS públicos existem. Uma loja só feminina
-- desliga "Público" e o campo some do cadastro; uma loja unissex liga. O tipo de peça (blusas, calças, acessórios...) continua
-- sendo a categoria. Em "Feminino" ou "Masculino" entram também as peças unissex.

-- ================================================================ colunas
alter table public.products
  add column audience text not null default 'unisex' check (audience in ('feminine', 'masculine', 'unisex', 'kids')),
  add column styles   text[] not null default '{}' check (cardinality(styles) <= 8);
create index products_audience_idx on public.products (store_id, audience);

create function private.valid_catalog_filters(j jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(j) = 'object'
     and (select bool_and(coalesce(jsonb_typeof(j -> k) = 'boolean', false))
          from unnest(array['search','collection','category','audience','style','color','size','price','stock','sort']) k)
     and jsonb_typeof(j -> 'audiences') = 'array'
     and jsonb_array_length(j -> 'audiences') between 1 and 4
     and not exists (select 1 from jsonb_array_elements_text(j -> 'audiences') a where a not in ('feminine','masculine','unisex','kids'))
     and jsonb_typeof(j -> 'styles') = 'array'
     and jsonb_array_length(j -> 'styles') <= 12
     and not exists (select 1 from jsonb_array_elements_text(j -> 'styles') s where char_length(btrim(s)) not between 1 and 30);
$$;

alter table public.stores
  add column catalog_filters jsonb not null default
    '{"search":true,"collection":true,"category":true,"audience":false,"style":false,"color":true,"size":true,"price":true,"stock":true,"sort":true,"audiences":["feminine"],"styles":["Casual","Festa","Trabalho","Praia","Esporte"]}'::jsonb
    check (private.valid_catalog_filters(catalog_filters));

-- só o dono altera (mesma regra das demais configurações da loja); produtos aceitam os novos campos
grant update (catalog_filters) on public.stores to authenticated;
grant insert (audience, styles), update (audience, styles) on public.products to authenticated;

-- ================================================================ gravar produto com público e estilos
create or replace function public.save_product(p_store uuid, p_id uuid, p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_sizes text[];
  v_styles text[];
  v_status public.product_status := nullif(p ->> 'status', '')::public.product_status;
  v_audience text := nullif(p ->> 'audience', '');
begin
  select coalesce(array_agg(x), '{}') into v_sizes
  from jsonb_array_elements_text(coalesce(p -> 'sizes', '[]'::jsonb)) x;
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_styles
  from jsonb_array_elements_text(coalesce(p -> 'styles', '[]'::jsonb)) x where btrim(x) <> '';

  if p_id is null then
    insert into public.products (store_id, name, slug, description, price, promo_price, category_id, color,
                                 sizes, sku, video_url, status, is_featured, audience, styles)
    values (p_store, p ->> 'name', private.next_product_slug(p_store, p ->> 'slug_base'),
            nullif(p ->> 'description', ''), (p ->> 'price')::numeric, nullif(p ->> 'promo_price', '')::numeric,
            nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'color', ''), v_sizes,
            nullif(p ->> 'sku', ''), nullif(p ->> 'video_url', ''), coalesce(v_status, 'available'),
            coalesce((p ->> 'featured')::boolean, false), coalesce(v_audience, 'unisex'), v_styles)
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
      is_featured = coalesce((p ->> 'featured')::boolean, false),
      audience = coalesce(v_audience, audience),
      styles = case when p ? 'styles' then v_styles else styles end
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

-- ================================================================ ajudas para montar o catálogo mais rápido
-- Cria as categorias sugeridas que ainda não existem (compara pelo slug, que o app gera sem acento). Devolve quantas criou.
-- p_items: [{"name": "Blusas", "slug": "blusas"}, ...]
create function public.add_categories(p_store uuid, p_items jsonb) returns integer
language plpgsql set search_path = '' as $$
declare n integer := 0; it jsonb; v_name text; v_slug text;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'invalid_items' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(p_items) limit 30 loop
    v_name := btrim(coalesce(it ->> 'name', ''));
    v_slug := private.next_slug('categories', p_store, it ->> 'slug');
    continue when v_name = '' or char_length(v_name) > 60;
    continue when exists (select 1 from public.categories where store_id = p_store and slug = btrim(coalesce(it ->> 'slug', '')));
    insert into public.categories (store_id, name, slug) values (p_store, v_name, v_slug);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Edição em lote (até 200 peças): público, categoria e estilo (adicionar/remover). O RLS decide em quais peças vale.
create function public.bulk_update_products(p_ids uuid[], p jsonb) returns integer
language plpgsql set search_path = '' as $$
declare n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200 then
    raise exception 'invalid_selection' using errcode = '22023';
  end if;
  update public.products set
    audience = coalesce(nullif(p ->> 'audience', ''), audience),
    category_id = case when p ? 'category_id' then nullif(p ->> 'category_id', '')::uuid else category_id end,
    styles = (select coalesce(array_agg(distinct s order by s), '{}')
              from unnest(case when nullif(p ->> 'style_add', '') is not null then styles || (p ->> 'style_add') else styles end) s
              where s is distinct from nullif(p ->> 'style_remove', ''))
  where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- ================================================================ catálogo público
drop function public.catalog_products(text, text, text, text, text, text, numeric, numeric, boolean, text, integer, integer);
drop function private.public_products(uuid);

create function private.public_products(p_store uuid)
returns table (id uuid, name text, slug text, description text, price numeric, promo_price numeric, color text,
               sizes text[], is_featured boolean, published_at timestamptz, category_id uuid, stock_label text,
               audience text, styles text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.slug, p.description, p.price, p.promo_price, p.color, p.sizes, p.is_featured, p.published_at, p.category_id,
         case
           when p.status = 'sold' or i.quantity = 0 then 'sold_out'
           when p.status = 'reserved' or i.quantity - r.reserved <= 0 then 'reserved'
           when i.quantity - r.reserved <= i.low_stock_threshold then 'low'
           else 'available'
         end,
         p.audience, p.styles
  from public.products p
  join public.inventory i on i.product_id = p.id
  join public.stores s on s.id = p.store_id
  cross join lateral (
    select coalesce(sum(x.quantity), 0)::integer as reserved from public.reservations x
    where x.product_id = p.id and x.status in ('requested', 'confirmed') and (x.expires_at is null or x.expires_at > now())
  ) r
  where p.store_id = p_store
    and p.status in ('available', 'reserved', 'sold')
    and not (s.hide_sold_out and (p.status = 'sold' or i.quantity = 0));
$$;
revoke execute on function private.public_products(uuid) from public, anon, authenticated;

-- Dados da loja + filtros disponíveis + a configuração de filtros escolhida pela loja.
create or replace function public.catalog_store(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  vis as materialized (select pp.* from st, private.public_products(st.id) pp),
  cfg as (select s.catalog_filters as f from public.stores s where s.id = (select id from st))
  select case when (select id from st) is null then null else jsonb_build_object(
    'store', (select jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'tagline', s.tagline, 'description', s.description,
                                        'whatsapp', s.whatsapp, 'instagram_handle', s.instagram_handle, 'address', s.address,
                                        'opening_hours', s.opening_hours, 'logo_path', s.logo_path, 'banner_path', s.banner_path,
                                        'accent_color', s.accent_color)
              from public.stores s where s.id = (select id from st)),
    'filters', (select f from cfg),
    'total', (select count(*) from vis),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'parent_slug', pc.slug,
               'count', (select count(*) from vis v where v.category_id = c.id
                          or (c.parent_id is null and v.category_id in (select k.id from public.categories k where k.parent_id = c.id))))
             order by c.position, c.name)
      from public.categories c left join public.categories pc on pc.id = c.parent_id
      where c.store_id = (select id from st)), '[]'::jsonb),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'automatic', c.kind = 'new_arrivals',
               'count', case when c.kind = 'manual'
                             then (select count(*) from public.collection_products cp where cp.collection_id = c.id and cp.product_id in (select id from vis))
                             else (select count(*) from vis v where v.published_at >= now() - make_interval(days => c.new_arrivals_days)) end)
             order by c.kind desc, c.position, c.name)
      from public.collections c where c.store_id = (select id from st) and c.is_published), '[]'::jsonb),
    -- público: só os que a loja habilitou; feminino/masculino contam também as unissex
    'audiences', coalesce((
      select jsonb_agg(jsonb_build_object('value', a.value, 'count',
               case when a.value in ('feminine', 'masculine') then (select count(*) from vis v where v.audience in (a.value, 'unisex'))
                    else (select count(*) from vis v where v.audience = a.value) end) order by a.ord)
      from (select value, ord from jsonb_array_elements_text((select f -> 'audiences' from cfg)) with ordinality as t(value, ord)) a), '[]'::jsonb),
    'styles', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'count', s.n) order by s.ord)
      from (select t.name, t.ord, (select count(*) from vis v where exists (select 1 from unnest(v.styles) z where lower(z) = lower(t.name))) as n
            from jsonb_array_elements_text((select f -> 'styles' from cfg)) with ordinality as t(name, ord)) s
      where s.n > 0), '[]'::jsonb),
    'colors', coalesce((select jsonb_agg(color order by color) from (select distinct color from vis where color is not null) q), '[]'::jsonb),
    'sizes',  coalesce((select jsonb_agg(sz) from (select distinct unnest(sizes) as sz from vis) q), '[]'::jsonb),
    'price_min', (select min(coalesce(promo_price, price)) from vis),
    'price_max', (select max(coalesce(promo_price, price)) from vis)
  ) end;
$$;

-- Lista paginada com busca e filtros. p_audience: feminine|masculine|unisex|kids (feminino e masculino incluem unissex).
create function public.catalog_products(
  p_slug text, p_q text default '', p_category text default '', p_collection text default '', p_color text default '',
  p_size text default '', p_min numeric default null, p_max numeric default null, p_in_stock boolean default false,
  p_sort text default 'new', p_limit integer default 24, p_offset integer default 0,
  p_audience text default '', p_style text default '')
returns table (id uuid, name text, slug text, price numeric, promo_price numeric, color text, sizes text[], is_featured boolean,
               published_at timestamptz, stock_label text, cover_path text, total bigint)
language sql stable security definer set search_path = '' as $$
  with st as (select private.public_store(p_slug) as id),
  vis as materialized (select pp.* from st, private.public_products(st.id) pp),
  cat as (select c.id from st join public.categories c on c.store_id = st.id where coalesce(p_category, '') <> '' and c.slug = p_category),
  cat_ids as (select id from cat union select k.id from public.categories k join cat on k.parent_id = cat.id),
  col as (select c.id, c.kind, c.new_arrivals_days from st join public.collections c on c.store_id = st.id
          where coalesce(p_collection, '') <> '' and c.slug = p_collection and c.is_published),
  terms as (
    select t from unnest(regexp_split_to_array(lower(extensions.unaccent(left(btrim(coalesce(p_q, '')), 80))), '\s+')) t
    where length(t) >= 2 and t <> all (array['de','da','do','das','dos','para','com','em','na','no','um','uma','tamanho','cor','roupa','roupas','peca','pecas'])
  )
  select v.id, v.name, v.slug, v.price, v.promo_price, v.color, v.sizes, v.is_featured, v.published_at, v.stock_label,
         (select pi.path from public.product_images pi where pi.product_id = v.id order by pi.position limit 1),
         count(*) over ()
  from vis v
  left join public.categories ct on ct.id = v.category_id
  where (coalesce(p_category, '') = '' or v.category_id in (select id from cat_ids))
    and (coalesce(p_collection, '') = '' or exists (
          select 1 from col where (col.kind = 'manual' and exists (select 1 from public.collection_products cp where cp.collection_id = col.id and cp.product_id = v.id))
                               or (col.kind = 'new_arrivals' and v.published_at >= now() - make_interval(days => col.new_arrivals_days))))
    and (coalesce(p_color, '') = '' or lower(v.color) = lower(p_color))
    and (coalesce(p_size, '') = '' or exists (select 1 from unnest(v.sizes) z where lower(z) = lower(p_size)))
    and (p_min is null or coalesce(v.promo_price, v.price) >= p_min)
    and (p_max is null or coalesce(v.promo_price, v.price) <= p_max)
    and (not coalesce(p_in_stock, false) or v.stock_label in ('available', 'low'))
    and (coalesce(p_audience, '') = '' or v.audience = p_audience or (p_audience in ('feminine', 'masculine') and v.audience = 'unisex'))
    and (coalesce(p_style, '') = '' or exists (select 1 from unnest(v.styles) z where lower(z) = lower(p_style)))
    and not exists (
          select 1 from terms
          where lower(extensions.unaccent(v.name || ' ' || coalesce(v.description, '') || ' ' || coalesce(v.color, '') || ' ' || coalesce(ct.name, '') || ' '
                                          || array_to_string(v.styles, ' ') || ' '
                                          || case v.audience when 'feminine' then 'feminino' when 'masculine' then 'masculino' when 'kids' then 'infantil' else 'unissex' end))
                not like '%' || replace(replace(replace(terms.t, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\')
  order by (v.stock_label = 'sold_out'),
           case when p_sort = 'price_asc'  then coalesce(v.promo_price, v.price) end asc,
           case when p_sort = 'price_desc' then coalesce(v.promo_price, v.price) end desc,
           case when p_sort = 'name'       then v.name end asc,
           case when coalesce(p_sort, 'new') not in ('price_asc', 'price_desc', 'name') then v.published_at end desc,
           v.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ================================================================ histórico: público e estilos também
create or replace function private.trg_log_product() returns trigger language plpgsql security definer set search_path = '' as $$
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
  if new.audience is distinct from old.audience then ch := ch || jsonb_build_object('audience', jsonb_build_array(old.audience, new.audience)); end if;
  if new.styles is distinct from old.styles then ch := ch || jsonb_build_object('styles', true); end if;
  if new.sku is distinct from old.sku then ch := ch || jsonb_build_object('sku', true); end if;
  if new.description is distinct from old.description then ch := ch || jsonb_build_object('description', true); end if;
  if new.video_url is distinct from old.video_url then ch := ch || jsonb_build_object('video', true); end if;
  if ch <> '{}'::jsonb then
    perform private.log_activity(new.store_id, 'product.updated', 'product', new.id, new.name, jsonb_build_object('changes', ch));
  end if;
  return new;
end $$;

create or replace function private.trg_log_store() returns trigger language plpgsql security definer set search_path = '' as $$
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
  if new.catalog_filters is distinct from old.catalog_filters then ch := array_append(ch, 'filtros do catálogo'); end if;
  if array_length(ch, 1) > 0 then
    perform private.log_activity(new.id, 'store.updated', 'store', new.id, new.name, jsonb_build_object('fields', to_jsonb(ch)));
  end if;
  return new;
end $$;

-- ================================================================ permissões de execução
revoke execute on function public.add_categories(uuid, jsonb)           from public, anon;
revoke execute on function public.bulk_update_products(uuid[], jsonb)    from public, anon;
grant  execute on function public.add_categories(uuid, jsonb)           to authenticated;
grant  execute on function public.bulk_update_products(uuid[], jsonb)    to authenticated;
revoke execute on function public.catalog_store(text) from public;
revoke execute on function public.catalog_products(text, text, text, text, text, text, numeric, numeric, boolean, text, integer, integer, text, text) from public;
grant  execute on function public.catalog_store(text) to anon, authenticated;
grant  execute on function public.catalog_products(text, text, text, text, text, text, numeric, numeric, boolean, text, integer, integer, text, text) to anon, authenticated;
