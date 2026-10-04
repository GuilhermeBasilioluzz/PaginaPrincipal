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
