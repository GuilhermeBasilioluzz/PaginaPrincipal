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
