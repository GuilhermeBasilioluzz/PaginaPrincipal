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
