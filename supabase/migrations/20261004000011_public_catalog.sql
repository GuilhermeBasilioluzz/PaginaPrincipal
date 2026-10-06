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
