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
