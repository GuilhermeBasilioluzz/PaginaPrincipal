-- ETAPA 9 — peças relacionadas e categoria na página da peça.
begin;

insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.categories (id, store_id, name, slug, parent_id) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestidos', 'vestidos', null),
  ('cccccccc-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Midi', 'midi', 'cccccccc-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-00000000000d', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Longo', 'longo', 'cccccccc-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-00000000000e', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bolsas', 'bolsas', null);
-- alvo: Vestido Midi (categoria Midi, cor Verde, coleção Primavera)
insert into public.products (id, store_id, name, slug, price, status, color, category_id, published_at) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alvo Midi Verde',      'alvo',        100, 'available', 'Verde', 'cccccccc-0000-0000-0000-00000000000c', now() - interval '10 days'),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mesma coleção',        'mesma-colecao', 100, 'available', 'Azul',  null,                                   now() - interval '9 days'),
  ('eeeeeeee-0000-0000-0000-000000000a03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mesma categoria',      'mesma-categoria', 100, 'available', 'Preto', 'cccccccc-0000-0000-0000-00000000000c', now() - interval '8 days'),
  ('eeeeeeee-0000-0000-0000-000000000a04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Categoria irmã',       'categoria-irma', 100, 'available', 'Preto', 'cccccccc-0000-0000-0000-00000000000d', now() - interval '7 days'),
  ('eeeeeeee-0000-0000-0000-000000000a05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Categoria pai',        'categoria-pai', 100, 'available', 'Preto', 'cccccccc-0000-0000-0000-00000000000a', now() - interval '6 days'),
  ('eeeeeeee-0000-0000-0000-000000000a06', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mesma cor',           'mesma-cor',   100, 'available', 'verde', 'cccccccc-0000-0000-0000-00000000000e', now() - interval '5 days'),
  ('eeeeeeee-0000-0000-0000-000000000a07', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sem afinidade nova',   'sem-afinidade', 100, 'available', 'Rosa',  'cccccccc-0000-0000-0000-00000000000e', now() - interval '1 days'),
  ('eeeeeeee-0000-0000-0000-000000000a08', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mesma coleção esgotada','col-esgotada', 100, 'sold',      'Azul',  null,                                   now() - interval '2 days'),
  ('eeeeeeee-0000-0000-0000-000000000a09', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arquivada',            'arquivada',   100, 'archived',  'Verde', 'cccccccc-0000-0000-0000-00000000000c', now()),
  ('eeeeeeee-0000-0000-0000-000000000a0a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Indisponível',         'indisponivel', 100, 'unavailable', 'Verde', 'cccccccc-0000-0000-0000-00000000000c', now()),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Da outra loja',        'da-outra',    100, 'available', 'Verde', null, now());
update public.inventory set quantity = 5 where product_id <> 'eeeeeeee-0000-0000-0000-000000000a08';
insert into public.collections (id, store_id, name, slug, kind, new_arrivals_days, is_published) values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera', 'primavera', 'manual', null, true),
  ('dddddddd-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rascunho',  'rascunho',  'manual', null, false);
insert into public.collection_products (store_id, collection_id, product_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a02'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a08'),
  -- coleção em rascunho NÃO conta como afinidade
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-000000000a01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-000000000a07');
insert into public.product_images (store_id, product_id, path, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a02', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/capa.webp', 0);

\echo '--- afinidade'
select test.anon();
select test.ok('ordem por afinidade: coleção (3) > categoria (2) > vizinha (1, mais nova primeiro) > cor (1) > sem afinidade; esgotada por último',
  (select array_agg(slug) from (select slug, row_number() over () rn from public.catalog_related('loja-a', 'alvo')) q) =
  array['mesma-colecao', 'mesma-categoria', 'mesma-cor', 'categoria-pai', 'categoria-irma', 'sem-afinidade', 'col-esgotada']);
select test.ok('pontuações corretas',
  (select score from public.catalog_related('loja-a', 'alvo') where slug = 'mesma-colecao') = 3
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'mesma-categoria') = 2
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'categoria-irma') = 1
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'categoria-pai') = 1
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'mesma-cor') = 1
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'sem-afinidade') = 0);
select test.ok('a cor compara sem diferenciar maiúsculas e a coleção em rascunho não pontua',
  (select score from public.catalog_related('loja-a', 'alvo') where slug = 'mesma-cor') = 1
  and (select score from public.catalog_related('loja-a', 'alvo') where slug = 'sem-afinidade') = 0);

\echo '--- o que NÃO aparece'
select test.ok('nunca aparece a própria peça, arquivada, indisponível nem peça de outra loja',
  (select count(*) from public.catalog_related('loja-a', 'alvo') where slug in ('alvo', 'arquivada', 'indisponivel', 'da-outra')) = 0);
select test.ok('só colunas seguras (sem sku, estoque, status, autor)',
  (select not (to_jsonb(t) ?| array['sku','quantity','status','created_by','store_id','category_id']) from public.catalog_related('loja-a', 'alvo') t limit 1));
select test.ok('capa vem da primeira foto', (select cover_path from public.catalog_related('loja-a', 'alvo') where slug = 'mesma-colecao') like '%capa.webp');
select test.ok('peça inexistente, arquivada, indisponível ou loja errada: lista vazia',
  (select count(*) from public.catalog_related('loja-a', 'nada')) = 0
  and (select count(*) from public.catalog_related('loja-a', 'arquivada')) = 0
  and (select count(*) from public.catalog_related('loja-a', 'indisponivel')) = 0
  and (select count(*) from public.catalog_related('loja-b', 'alvo')) = 0
  and (select count(*) from public.catalog_related('loja-x', 'alvo')) = 0);
select test.ok('a outra loja só se relaciona com a própria (sem outras peças = vazio)', (select count(*) from public.catalog_related('loja-b', 'da-outra')) = 0);

\echo '--- limite e configurações'
select test.ok('limite respeitado (e abusivo reduzido)', (select count(*) from public.catalog_related('loja-a', 'alvo', 3)) = 3
  and (select count(*) from public.catalog_related('loja-a', 'alvo', 100000)) = 7 and (select count(*) from public.catalog_related('loja-a', 'alvo', -4)) = 1);
select test.ok('o limite corta pelas mais afins', (select array_agg(slug) from public.catalog_related('loja-a', 'alvo', 2)) = array['mesma-colecao', 'mesma-categoria']);
select test.reset();
update public.stores set hide_sold_out = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.ok('"ocultar esgotados" também vale nas relacionadas', (select count(*) from public.catalog_related('loja-a', 'alvo') where slug = 'col-esgotada') = 0);
select test.reset();
update public.stores set hide_sold_out = false, catalog_enabled = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.ok('catálogo desligado: nada', (select count(*) from public.catalog_related('loja-a', 'alvo')) = 0);
select test.reset();
update public.stores set catalog_enabled = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- categoria na página da peça'
select test.anon();
select test.ok('subcategoria traz a principal para o caminho de navegação',
  (select j -> 'category' ->> 'name' = 'Midi' and j -> 'category' ->> 'parent_slug' = 'vestidos' and j -> 'category' ->> 'parent_name' = 'Vestidos'
   from (select public.catalog_product('loja-a', 'alvo') j) q));
select test.ok('categoria principal não tem pai', (select j -> 'category' ->> 'slug' = 'vestidos' and (j -> 'category' -> 'parent_slug') = 'null'::jsonb
   from (select public.catalog_product('loja-a', 'categoria-pai') j) q));
select test.ok('peça sem categoria devolve category nulo', (select (j -> 'category') = 'null'::jsonb or j -> 'category' is null from (select public.catalog_product('loja-a', 'mesma-colecao') j) q));
select test.ok('as coleções da peça aparecem (só as publicadas)', (select jsonb_array_length(j -> 'collections') = 1 and j -> 'collections' -> 0 ->> 'slug' = 'primavera'
   from (select public.catalog_product('loja-a', 'alvo') j) q));
select test.denied('as funções continuam internas ao banco: acesso direto às tabelas', $$select * from public.collection_products$$);

\echo 'TESTES DE RELACIONADAS OK'
rollback;
