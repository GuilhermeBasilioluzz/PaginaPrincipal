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
