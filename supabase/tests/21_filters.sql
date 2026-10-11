-- ETAPA 10.1 — público (feminino/masculino/unissex/infantil), estilos e seleção de filtros por loja.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente A
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),    -- gerente A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');   -- dona B
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');

insert into public.products (id, store_id, name, slug, price, status, audience, styles) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Floral',  'vestido',  100, 'available', 'feminine',  '{Festa,Casual}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Camisa Social',   'camisa',   100, 'available', 'masculine', '{Trabalho}'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Camiseta Básica', 'camiseta', 100, 'available', 'unisex',    '{Casual}'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Macacão Bebê',    'macacao',  100, 'available', 'kids',      '{}');
update public.inventory set quantity = 5;

\echo '--- filtro por público'
select test.anon();
select test.ok('sem filtro: as 4 peças',
  (select count(*) from public.catalog_products('loja-a')) = 4);
select test.ok('feminino traz feminino + unissex',
  (select array_agg(slug order by slug) from public.catalog_products('loja-a', p_audience => 'feminine')) = array['camiseta', 'vestido']);
select test.ok('masculino traz masculino + unissex',
  (select array_agg(slug order by slug) from public.catalog_products('loja-a', p_audience => 'masculine')) = array['camisa', 'camiseta']);
select test.ok('unissex traz só unissex',
  (select array_agg(slug) from public.catalog_products('loja-a', p_audience => 'unisex')) = array['camiseta']);
select test.ok('infantil traz só infantil',
  (select array_agg(slug) from public.catalog_products('loja-a', p_audience => 'kids')) = array['macacao']);
select test.ok('valor desconhecido de público não traz nada',
  (select count(*) from public.catalog_products('loja-a', p_audience => 'xyz')) = 0);

\echo '--- filtro por estilo'
select test.ok('estilo Casual (sem diferenciar maiúsculas)',
  (select array_agg(slug order by slug) from public.catalog_products('loja-a', p_style => 'casual')) = array['camiseta', 'vestido']);
select test.ok('estilo + público juntos',
  (select array_agg(slug) from public.catalog_products('loja-a', p_audience => 'masculine', p_style => 'Trabalho')) = array['camisa']);

\echo '--- busca entende público e estilo'
select test.ok('buscar "feminino" acha a peça feminina (e não a masculina)',
  (select array_agg(slug) from public.catalog_products('loja-a', 'feminino')) = array['vestido']);
select test.ok('buscar "infantil"',
  (select array_agg(slug) from public.catalog_products('loja-a', 'infantil')) = array['macacao']);
select test.ok('buscar "trabalho" (estilo)',
  (select array_agg(slug) from public.catalog_products('loja-a', 'trabalho')) = array['camisa']);

\echo '--- catalog_store entrega a configuração e só o que existe'
select test.ok('filtros padrão: público desligado, cor/tamanho ligados',
  (public.catalog_store('loja-a') -> 'filters' ->> 'audience') = 'false'
  and (public.catalog_store('loja-a') -> 'filters' ->> 'color') = 'true');
select test.ok('públicos habilitados por padrão: só feminino, contando feminino + unissex',
  public.catalog_store('loja-a') -> 'audiences' = '[{"value":"feminine","count":2}]'::jsonb);
select test.ok('estilos só aparecem se houver peças (Praia/Esporte sem peças ficam de fora)',
  (select array_agg(e ->> 'name') from jsonb_array_elements(public.catalog_store('loja-a') -> 'styles') e) = array['Casual', 'Festa', 'Trabalho']);
select test.ok('não vaza id de usuário nem estoque no retorno',
  public.catalog_store('loja-a')::text !~ 'quantity|sku|user_id');

\echo '--- dono escolhe os filtros'
select test.login('00000000-0000-0000-0000-000000000001');
select test.affects('dono grava a seleção de filtros',
  $$update public.stores set catalog_filters = '{"search":true,"collection":false,"category":true,"audience":true,"style":true,"color":false,"size":true,"price":true,"stock":false,"sort":true,"audiences":["feminine","masculine","unisex"],"styles":["Casual","Festa"]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 1);
select test.anon();
select test.ok('catálogo reflete: 3 públicos',
  jsonb_array_length(public.catalog_store('loja-a') -> 'audiences') = 3);
select test.ok('unissex conta só unissex; masculino conta masculino + unissex',
  (public.catalog_store('loja-a') -> 'audiences' -> 1 ->> 'count') = '2'
  and (public.catalog_store('loja-a') -> 'audiences' -> 2 ->> 'count') = '1');
select test.ok('estilos limitados aos escolhidos',
  (select array_agg(e ->> 'name') from jsonb_array_elements(public.catalog_store('loja-a') -> 'styles') e) = array['Casual', 'Festa']);

\echo '--- quem NÃO pode mudar os filtros'
select test.login('00000000-0000-0000-0000-000000000003');  -- gerente
select test.affects('gerente não altera filtros', $$update public.stores set catalog_filters = catalog_filters where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 0);
select test.login('00000000-0000-0000-0000-000000000004');  -- dona de outra loja
select test.affects('dona de outra loja não altera', $$update public.stores set catalog_filters = catalog_filters where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 0);

\echo '--- validação da configuração'
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('sem nenhum público é recusado',
  $$update public.stores set catalog_filters = '{"search":true,"collection":true,"category":true,"audience":true,"style":true,"color":true,"size":true,"price":true,"stock":true,"sort":true,"audiences":[],"styles":[]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('público inventado é recusado',
  $$update public.stores set catalog_filters = '{"search":true,"collection":true,"category":true,"audience":true,"style":true,"color":true,"size":true,"price":true,"stock":true,"sort":true,"audiences":["alien"],"styles":[]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('chave faltando é recusada',
  $$update public.stores set catalog_filters = '{"audiences":["feminine"],"styles":[]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('valor não booleano é recusado',
  $$update public.stores set catalog_filters = '{"search":"sim","collection":true,"category":true,"audience":true,"style":true,"color":true,"size":true,"price":true,"stock":true,"sort":true,"audiences":["feminine"],"styles":[]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('estilo grande demais é recusado',
  format($f$update public.stores set catalog_filters = '{"search":true,"collection":true,"category":true,"audience":true,"style":true,"color":true,"size":true,"price":true,"stock":true,"sort":true,"audiences":["feminine"],"styles":["%s"]}'::jsonb where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$f$, repeat('x', 31)));

\echo '--- salvar peça com público e estilos'
select test.login('00000000-0000-0000-0000-000000000002');  -- atendente cadastra
select test.ok('atendente cria peça com público e estilos',
  public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null,
    '{"name":"Calça Jeans","slug_base":"calca-jeans","price":"150","audience":"masculine","styles":["Casual"," Casual ","Esporte"]}'::jsonb) is not null);
select test.ok('estilos sem repetição e público gravado',
  (select audience = 'masculine' and styles = array['Casual', 'Esporte'] from public.products where slug = 'calca-jeans'));
select test.denied('público inválido é recusado pelo banco',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":"1","audience":"alien"}'::jsonb)$$);
select test.denied('mais de 8 estilos é recusado',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Y","slug_base":"y","price":"1","styles":["a","b","c","d","e","f","g","h","i"]}'::jsonb)$$);
select test.ok('editar peça funciona',
  public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from public.products where slug = 'calca-jeans'),
    '{"name":"Calça Jeans 2","price":"150"}'::jsonb) is not null);
select test.ok('editar sem mandar público mantém o atual',
  (select audience = 'masculine' and styles = array['Casual', 'Esporte'] from public.products where slug = 'calca-jeans'));

\echo '--- categorias sugeridas'
select test.login('00000000-0000-0000-0000-000000000003');  -- gerente
select test.ok('cria as 2 categorias',
  public.add_categories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[{"name":"Blusas","slug":"blusas"},{"name":"Calças","slug":"calcas"}]'::jsonb) = 2);
select test.ok('pula repetidas e cria só a nova',
  public.add_categories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[{"name":"Blusas","slug":"blusas"},{"name":"Vestidos","slug":"vestidos"}]'::jsonb) = 1);
select test.login('00000000-0000-0000-0000-000000000002');  -- atendente
select test.denied('atendente não cria categorias',
  $$select public.add_categories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[{"name":"Saias","slug":"saias"}]'::jsonb)$$);
select test.login('00000000-0000-0000-0000-000000000004');  -- outra loja
select test.denied('outra loja não cria categorias aqui',
  $$select public.add_categories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '[{"name":"Saias","slug":"saias"}]'::jsonb)$$);

\echo '--- edição em lote'
select test.login('00000000-0000-0000-0000-000000000003');  -- gerente
select test.ok('lote: afeta 2 peças',
  public.bulk_update_products(array['eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002']::uuid[],
    '{"audience":"unisex","style_add":"Praia"}'::jsonb) = 2);
select test.ok('lote: público + estilo adicionado',
  (select bool_and(audience = 'unisex' and 'Praia' = any (styles)) from public.products
       where id in ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002')));
select test.ok('lote: remover estilo afeta 1',
  public.bulk_update_products(array['eeeeeeee-0000-0000-0000-000000000001']::uuid[], '{"style_remove":"Praia"}'::jsonb) = 1);
select test.ok('lote: estilo removido',
  (select not ('Praia' = any (styles)) from public.products where id = 'eeeeeeee-0000-0000-0000-000000000001'));
select test.denied('lote vazio é recusado', $$select public.bulk_update_products(array[]::uuid[], '{"audience":"kids"}'::jsonb)$$);
select test.login('00000000-0000-0000-0000-000000000004');  -- outra loja: o RLS não deixa tocar
select test.ok('lote de outra loja não altera nada',
  public.bulk_update_products(array['eeeeeeee-0000-0000-0000-000000000003']::uuid[], '{"audience":"kids"}'::jsonb) = 0);

\echo '--- histórico registra a mudança de filtros'
select test.reset();
select test.ok('log de "filtros do catálogo"',
  exists (select 1 from public.activity_logs where action = 'store.updated' and (details -> 'fields') ? 'filtros do catálogo'));

\echo 'TESTES DE FILTROS OK'
rollback;
