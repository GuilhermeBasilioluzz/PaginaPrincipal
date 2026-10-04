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
