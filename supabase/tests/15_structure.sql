-- ETAPA 6 — categorias, coleções e associação com produtos.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente A
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),    -- gerente A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),   -- dona B
  ('00000000-0000-0000-0000-000000000005', 'eva@x.com');     -- vai criar uma loja
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
insert into public.products (id, store_id, name, slug, price, status, published_at) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Novo',       'novo',       10, 'available',   now()),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Antigo',     'antigo',     10, 'available',   now() - interval '30 days'),
  ('eeeeeeee-0000-0000-0000-000000000a03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Arquivado',  'arquivado',  10, 'archived',    now()),
  ('eeeeeeee-0000-0000-0000-000000000a04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Oculto',     'oculto',     10, 'unavailable', now()),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Da B',       'da-b',       10, 'available',   now());


\echo '--- loja nova nasce com Novidades'
select test.login('00000000-0000-0000-0000-000000000005');
select public.create_store('Loja da Eva', 'loja-eva');
select test.ok('loja nova já tem a coleção automática "Novidades" (7 dias)',
  (select count(*) from public.collections where kind = 'new_arrivals' and new_arrivals_days = 7 and slug = 'novidades' and is_published) = 1
  and (select count(*) from public.collections) = 1);

\echo '--- categorias'
select test.login('00000000-0000-0000-0000-000000000003');  -- dani, gerente
create temp table cat (id uuid, sub uuid);
grant all on cat to public;
insert into cat (id) select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Vestidos","slug_base":"vestidos"}');
update cat set sub = public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, jsonb_build_object('name','Midi','slug_base','midi','parent_id',(select id from cat)));
select test.ok('gerente cria categoria e subcategoria', (select count(*) from public.categories where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2
  and (select parent_id from public.categories where id = (select sub from cat)) = (select id from cat));
select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Vestidos de novo","slug_base":"vestidos"}');
select test.ok('mesmo nome gera endereço único (-2)', (select count(*) from public.categories where slug = 'vestidos-2') = 1);
select test.denied('subcategoria de subcategoria é recusada (2 níveis no máximo)',
  format($$select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Fundo","slug_base":"fundo","parent_id":"%s"}')$$, (select sub from cat)));
select test.denied('categoria com subcategorias não vira subcategoria',
  format($$select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '%s', jsonb_build_object('name','Vestidos','parent_id',(select id from public.categories where slug = 'vestidos-2')))$$, (select id from cat)));
select test.denied('categoria não pode ser pai de si mesma',
  format($$select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '%1$s', jsonb_build_object('name','X','parent_id','%1$s'))$$, (select id from cat)));
select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from cat), '{"name":"Vestidos Longos"}');
select test.ok('renomear mantém o endereço', (select slug from public.categories where id = (select id from cat)) = 'vestidos');

select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
select test.denied('atendente NÃO cria categoria', $$select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x"}')$$);
select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.denied('outra loja NÃO cria categoria na A', $$select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x"}')$$);
select test.denied('outra loja NÃO usa categoria da A como pai',
  format($$select public.save_category('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, '{"name":"X","slug_base":"x","parent_id":"%s"}')$$, (select id from cat)));

\echo '--- excluir categoria'
select test.login('00000000-0000-0000-0000-000000000003');
select test.reset();
update public.products set category_id = (select id from cat) where slug = 'novo';
select test.login('00000000-0000-0000-0000-000000000003');
select test.affects('gerente exclui a categoria', format($$delete from public.categories where id = '%s'$$, (select id from cat)), 1);
select test.ok('subcategoria vira categoria principal e produto fica sem categoria',
  (select parent_id from public.categories where id = (select sub from cat)) is null
  and (select category_id from public.products where slug = 'novo') is null);

\echo '--- coleções'
create temp table col (manual uuid, auto uuid, man2 uuid);
grant all on col to public;
insert into col (manual) select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Primavera","slug_base":"primavera","kind":"manual","published":true}');
update col set auto = public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Novidades","slug_base":"novidades","kind":"new_arrivals","days":7,"published":true}');
update col set man2 = public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Rascunho","slug_base":"rascunho","kind":"manual","published":false}');
select test.ok('gerente cria coleção manual e automática', (select count(*) from public.collections where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 3
  and (select new_arrivals_days from public.collections where id = (select auto from col)) = 7
  and (select new_arrivals_days from public.collections where id = (select manual from col)) is null);
select test.denied('dias fora de 1 a 90 são recusados',
  $$select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","kind":"new_arrivals","days":200}')$$);
select test.denied('tipo inválido é recusado', $$select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","kind":"magica"}')$$);
select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select manual from col), '{"name":"Primavera 2026","kind":"manual","published":true,"description":"Cores leves"}');
select test.ok('editar mantém o endereço e muda os dados', (select slug = 'primavera' and name = 'Primavera 2026' and description = 'Cores leves' from public.collections where id = (select manual from col)));
select test.login('00000000-0000-0000-0000-000000000002');
select test.denied('atendente NÃO cria coleção', $$select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x"}')$$);
select test.denied('atendente NÃO edita coleção', format($$select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '%s', '{"name":"Hack"}')$$, (select manual from col)));

\echo '--- produtos nas coleções'
select test.login('00000000-0000-0000-0000-000000000002');  -- atendente organiza peças
select public.set_product_collections('eeeeeeee-0000-0000-0000-000000000a01', array[(select manual from col), (select man2 from col)]);
select test.ok('atendente coloca produto em 2 coleções',
  (select count(*) from public.collection_products where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 2);
select public.set_product_collections('eeeeeeee-0000-0000-0000-000000000a01', array[(select manual from col), (select auto from col)]);
select test.ok('trocar a lista remove as antigas e ignora a automática (Novidades não tem membros fixos)',
  (select array_agg(collection_id) from public.collection_products where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = array[(select manual from col)]);
select public.set_product_collections('eeeeeeee-0000-0000-0000-000000000a01', array[]::uuid[]);
select test.ok('lista vazia tira o produto de todas', (select count(*) from public.collection_products where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 0);
select test.denied('NÃO mexe em produto de outra loja', $$select public.set_product_collections('eeeeeeee-0000-0000-0000-000000000b01', array[]::uuid[])$$);

select test.ok('adicionar vários de uma vez devolve quantos entraram',
  public.add_products_to_collection((select manual from col), array['eeeeeeee-0000-0000-0000-000000000a01','eeeeeeee-0000-0000-0000-000000000a02','eeeeeeee-0000-0000-0000-000000000a03','eeeeeeee-0000-0000-0000-000000000b01']::uuid[]) = 3);
select test.ok('adicionar de novo não duplica', public.add_products_to_collection((select manual from col), array['eeeeeeee-0000-0000-0000-000000000a01']::uuid[]) = 0);
select test.ok('produto de OUTRA loja não entra (ficaram 3, não 4)', (select count(*) from public.collection_products where collection_id = (select manual from col)) = 3);
select test.denied('NÃO adiciona manualmente à coleção automática',
  format($$select public.add_products_to_collection('%s', array['eeeeeeee-0000-0000-0000-000000000a01']::uuid[])$$, (select auto from col)));
select test.affects('atendente tira peça da coleção', format($$delete from public.collection_products where collection_id = '%s' and product_id = 'eeeeeeee-0000-0000-0000-000000000a03'$$, (select manual from col)), 1);

\echo '--- conteúdo das coleções'
select test.ok('manual: devolve as peças escolhidas (inclui as que o painel precisa ver)', (select count(*) from public.collection_items((select manual from col))) = 2);
select test.ok('Novidades: só o publicado nos últimos 7 dias e visível (exclui antigo, arquivado, indisponível)',
  (select array_agg(product_id) from public.collection_items((select auto from col))) = array['eeeeeeee-0000-0000-0000-000000000a01']::uuid[]);
select test.reset();
update public.collections set new_arrivals_days = 60 where id = (select auto from col);
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('aumentar a janela para 60 dias inclui o produto de 30 dias', (select count(*) from public.collection_items((select auto from col))) = 2);
select test.ok('visão geral traz as contagens certas',
  (select item_count from public.store_collections_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where id = (select manual from col)) = 2
  and (select item_count from public.store_collections_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where id = (select auto from col)) = 2
  and (select count(*) from public.store_collections_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 3);

\echo '--- visão do público e de outras lojas'
select test.anon();
select test.ok('anon vê o conteúdo da coleção publicada', (select count(*) from public.collection_items((select manual from col))) = 2);
select test.reset();
update public.products set status = 'unavailable' where slug = 'antigo';
select test.anon();
select test.ok('anon NÃO vê peça fora do catálogo dentro da coleção', (select count(*) from public.collection_items((select manual from col))) = 1);
select test.ok('anon NÃO vê o conteúdo de coleção em rascunho', (select count(*) from public.collection_items((select man2 from col))) = 0);
select test.reset();
insert into public.collection_products (store_id, collection_id, product_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select man2 from col), 'eeeeeeee-0000-0000-0000-000000000a01');
select test.anon();
select test.ok('anon NÃO vê itens de coleção em rascunho mesmo com peças dentro', (select count(*) from public.collection_items((select man2 from col))) = 0);
select test.denied('anon NÃO usa a visão geral', $$select * from public.store_collections_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);
select test.denied('anon NÃO salva coleção', $$select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"x"}')$$);
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('outra loja vê zero itens e zero coleções da A',
  (select count(*) from public.collection_items((select manual from col))) = 0
  and (select count(*) from public.store_collections_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);
select test.denied('outra loja NÃO adiciona peças à coleção da A',
  format($$select public.add_products_to_collection('%s', array['eeeeeeee-0000-0000-0000-000000000b01']::uuid[])$$, (select manual from col)));

\echo 'TESTES DE CATEGORIAS E COLEÇÕES OK'
rollback;
