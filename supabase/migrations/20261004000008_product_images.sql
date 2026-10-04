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
