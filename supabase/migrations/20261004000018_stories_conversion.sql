-- HYPERION SYSTEM — ETAPA 12: conversão de Stories em produtos (várias imagens, produto existente, coleção).
--
-- Um produto costuma aparecer em vários Stories (frente, costas, detalhe): agora dá para juntar até 8 Stories num só produto
-- rascunho, ou anexar Stories como fotos de um produto que já existe. Continua valendo a regra de ouro: o produto novo nasce
-- RASCUNHO e só vai para o catálogo quando uma pessoa publicar.

-- Trava as linhas e confere: mesma loja, todas pendentes, quem chama pode cadastrar produtos. Devolve a loja.
create function private.claim_stories(p_stories uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_count integer; v_ok integer;
begin
  if p_stories is null or cardinality(p_stories) < 1 or cardinality(p_stories) > 8
     or cardinality(p_stories) <> (select count(distinct x) from unnest(p_stories) x) then
    raise exception 'invalid_selection' using errcode = '22023';
  end if;
  perform 1 from public.story_items where id = any (p_stories) order by id for update;
  select count(*), count(distinct store_id), min(store_id::text)::uuid into v_count, v_ok, v_store
  from public.story_items where id = any (p_stories);
  if v_count <> cardinality(p_stories) or v_ok <> 1
     or not private.can_write(v_store, array['owner','manager','attendant']::public.store_role[]) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.story_items where id = any (p_stories) and status <> 'pending') then
    raise exception 'story_not_pending' using errcode = '22023';
  end if;
  return v_store;
end $$;
revoke execute on function private.claim_stories(uuid[]) from public, anon, authenticated;

-- Vários Stories → 1 produto rascunho. A ORDEM de p_stories é a ordem das fotos (o app copia nessa ordem).
create function public.convert_stories(p_stories uuid[], p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_product uuid;
begin
  v_store := private.claim_stories(p_stories);
  v_product := public.save_product(v_store, null, p || jsonb_build_object('status', 'unavailable', 'source', 'instagram'));
  update public.story_items set status = 'converted', product_id = v_product where id = any (p_stories);
  return v_product;
end $$;

-- Stories → fotos de um produto que já existe (respeita o limite de 8 fotos). Não muda o status do produto.
create function public.attach_stories(p_stories uuid[], p_product uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_prod_store uuid; v_photos integer;
begin
  v_store := private.claim_stories(p_stories);
  select store_id into v_prod_store from public.products where id = p_product;
  if v_prod_store is distinct from v_store then raise exception 'not_found' using errcode = 'P0002'; end if;
  select count(*) into v_photos from public.product_images where product_id = p_product;
  if v_photos + cardinality(p_stories) > 8 then
    raise exception 'limit_reached' using errcode = '23514', hint = 'Cada produto aceita até 8 fotos.';
  end if;
  update public.story_items set status = 'converted', product_id = p_product where id = any (p_stories);
  return cardinality(p_stories);
end $$;

-- convert_story (1 Story) passa a ser um caso do novo
create or replace function public.convert_story(p_story uuid, p jsonb) returns uuid
language sql security definer set search_path = '' as $$
  select public.convert_stories(array[p_story], p);
$$;

-- quantos Stories esperam revisão (para o painel)
create function public.stories_pending_count(p_store uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.story_items where store_id = p_store and status = 'pending';
$$;

revoke execute on function public.convert_stories(uuid[], jsonb)        from public, anon;
revoke execute on function public.attach_stories(uuid[], uuid)          from public, anon;
revoke execute on function public.stories_pending_count(uuid)           from public, anon;
grant  execute on function public.convert_stories(uuid[], jsonb)        to authenticated;
grant  execute on function public.attach_stories(uuid[], uuid)          to authenticated;
grant  execute on function public.stories_pending_count(uuid)           to authenticated;
