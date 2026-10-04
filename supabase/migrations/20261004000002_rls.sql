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
