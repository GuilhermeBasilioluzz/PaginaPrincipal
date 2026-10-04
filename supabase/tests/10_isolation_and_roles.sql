-- ETAPA 1 — testes de isolamento entre lojas, papéis, catálogo público e storage.
-- Roda tudo numa transação e desfaz no final.
begin;

-- ===================================================== fixtures (como superusuário)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona da Loja A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente da Loja A
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),    -- gerente da Loja A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),   -- dona da Loja B
  ('00000000-0000-0000-0000-000000000005', 'eva@x.com'),     -- sem loja
  ('00000000-0000-0000-0000-000000000006', 'root@hyperion'); -- Super Admin
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000006';

insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');

insert into public.categories (id, store_id, name, slug) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestidos', 'vestidos'),
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisas',  'camisas');

insert into public.collections (id, store_id, name, slug, is_published) values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera',  'primavera', true),
  ('dddddddd-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rascunho',   'rascunho',  false),
  ('dddddddd-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Verão',      'verao',     true);

insert into public.products (id, store_id, name, slug, price, status, sku, category_id) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Midi',  'vestido-midi',  189.90, 'available',   'V1', 'cccccccc-0000-0000-0000-00000000000a'),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Antigo', 'vestido-antigo', 99.90,  'archived',    'V2', null),
  ('eeeeeeee-0000-0000-0000-000000000a03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Oculto', 'vestido-oculto', 99.90,  'unavailable', 'V3', null),
  ('eeeeeeee-0000-0000-0000-000000000a04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Vendido','vestido-vendido',99.90,  'sold',        'V4', null),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisa Linho',   'camisa-linho',  129.90, 'available',   'V1', 'cccccccc-0000-0000-0000-00000000000b');

insert into public.product_images (store_id, product_id, path) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/a01-front.jpg'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a02', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/a02-front.jpg'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-0000-0000-0000-000000000b01', 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/products/b01-front.jpg');

insert into public.collection_products (store_id, collection_id, product_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-000000000a01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000b01');

select test.ok('perfis criados automaticamente para cada usuário', (select count(*) from public.profiles) = 6);
select test.ok('inventário criado automaticamente para cada produto', (select count(*) from public.inventory) = 5);

-- ===================================================== 1. ISOLAMENTO ENTRE LOJAS
\echo '--- isolamento entre lojas'
select test.login('00000000-0000-0000-0000-000000000001');  -- alice (A)
select test.ok('alice vê só a Loja A', (select count(*) from public.stores) = 1 and (select slug from public.stores) = 'loja-a');
select test.ok('alice vê os 4 produtos da A e nenhum da B', (select count(*) from public.products) = 4
                and (select count(*) from public.products where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0);
select test.ok('alice não vê categorias/coleções/imagens/estoque da B',
  (select count(*) from public.categories where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.collections where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.product_images where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.collection_products where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.inventory where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0);
select test.ok('alice vê só a equipe da própria loja (3 membros)', (select count(*) from public.store_members) = 3);
select test.ok('alice vê só perfis de colegas de loja', (select count(*) from public.profiles) = 3);
select test.denied('alice NÃO cria produto na Loja B',
  $$insert into public.products (store_id, name, slug, price) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Invasor', 'invasor', 1)$$);
select test.affects('alice NÃO edita produto da B', $$update public.products set name = 'x' where id = 'eeeeeeee-0000-0000-0000-000000000b01'$$, 0);
select test.affects('alice NÃO apaga produto da B', $$delete from public.products where id = 'eeeeeeee-0000-0000-0000-000000000b01'$$, 0);
select test.affects('alice NÃO edita a Loja B', $$update public.stores set name = 'x' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, 0);
select test.denied('alice NÃO mexe no estoque da B (nem direto, nem pelas funções)', $$update public.inventory set quantity = 99 where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$);
select test.denied('alice NÃO ajusta estoque de produto da B pela função', $$select public.adjust_stock('eeeeeeee-0000-0000-0000-000000000b01', 5, 'restock')$$);
select test.denied('alice NÃO move produto da A para a B (store_id é imutável)',
  $$update public.products set store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.denied('alice NÃO se adiciona como membro da B',
  $$insert into public.store_members (store_id, user_id, role) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'owner')$$);
select test.denied('produto da A NÃO aceita categoria da B (FK composta)',
  $$update public.products set category_id = 'cccccccc-0000-0000-0000-00000000000b' where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.denied('imagem da A NÃO aceita arquivo da pasta da B',
  $$insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/products/x.jpg')$$);
select test.denied('imagem da A NÃO se liga a produto da B',
  $$insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000b01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x.jpg')$$);
select test.denied('coleção da A NÃO recebe produto da B (FK composta)',
  $$insert into public.collection_products (store_id, collection_id, product_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000b01')$$);

select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.ok('carla vê só a Loja B e seu único produto',
  (select count(*) from public.stores) = 1 and (select count(*) from public.products) = 1);
select test.ok('mesmo SKU/slug pode existir em lojas diferentes (V1 existe na A e na B)',
  (select sku from public.products) = 'V1');

select test.login('00000000-0000-0000-0000-000000000005');  -- eva (sem loja)
select test.ok('usuário sem loja não vê nada',
  (select count(*) from public.stores) = 0 and (select count(*) from public.products) = 0
  and (select count(*) from public.store_members) = 0 and (select count(*) from public.inventory) = 0);

-- ===================================================== 2. PAPÉIS
\echo '--- papéis dentro da loja'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno (atendente A)
select test.affects('atendente cria produto',
  $$insert into public.products (store_id, name, slug, price) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Blusa Nova', 'blusa-nova', 99.90)$$, 1);
select test.ok('produto registra quem criou (bruno) e o estoque nasce zerado',
  (select created_by from public.products where slug = 'blusa-nova') = '00000000-0000-0000-0000-000000000002'
  and (select i.quantity from public.inventory i join public.products p on p.id = i.product_id where p.slug = 'blusa-nova') = 0);
select test.denied('atendente NÃO forja created_by',
  $$insert into public.products (store_id, name, slug, price, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fake', 'fake', 1, '00000000-0000-0000-0000-000000000001')$$);
select test.affects('atendente edita produto', $$update public.products set status = 'reserved' where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$, 1);
select test.ok('edição registra updated_by = bruno', (select updated_by from public.products where id = 'eeeeeeee-0000-0000-0000-000000000a01') = '00000000-0000-0000-0000-000000000002');
select test.denied('atendente NÃO altera a quantidade direto na tabela (só pelas funções, com histórico)', $$update public.inventory set quantity = 5 where product_id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.ok('atendente atualiza estoque pela função', public.set_stock('eeeeeeee-0000-0000-0000-000000000a01', 5, 'contagem') = 5);
select test.ok('estoque registra updated_by = bruno', (select updated_by from public.inventory where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = '00000000-0000-0000-0000-000000000002');
select test.denied('estoque não aceita quantidade negativa', $$update public.inventory set quantity = -1 where product_id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.affects('atendente coloca peça em coleção',
  $$insert into public.collection_products (store_id, collection_id, product_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a04')$$, 1);
select test.ok('coleção registra quem adicionou', (select added_by from public.collection_products where product_id = 'eeeeeeee-0000-0000-0000-000000000a04') = '00000000-0000-0000-0000-000000000002');
select test.affects('atendente adiciona foto',
  $$insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a04', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/a04.jpg')$$, 1);
select test.affects('atendente NÃO apaga produto (só arquiva)', $$delete from public.products where id = 'eeeeeeee-0000-0000-0000-000000000a02'$$, 0);
select test.affects('atendente arquiva produto', $$update public.products set status = 'archived' where id = 'eeeeeeee-0000-0000-0000-000000000a03'$$, 1);
select test.denied('atendente NÃO cria categoria', $$insert into public.categories (store_id, name, slug) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bolsas', 'bolsas')$$);
select test.denied('atendente NÃO cria coleção', $$insert into public.collections (store_id, name, slug) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Festa', 'festa')$$);
select test.affects('atendente NÃO edita a loja', $$update public.stores set name = 'Hack' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 0);
select test.denied('atendente NÃO adiciona membros', $$insert into public.store_members (store_id, user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000005', 'attendant')$$);
select test.affects('atendente NÃO promove a si mesmo', $$update public.store_members set role = 'owner' where user_id = '00000000-0000-0000-0000-000000000002'$$, 0);
select test.denied('ninguém se torna Super Admin pelo perfil', $$update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000002'$$);
select test.affects('usuário edita o próprio perfil', $$update public.profiles set full_name = 'Bruno' where id = '00000000-0000-0000-0000-000000000002'$$, 1);
select test.affects('usuário NÃO edita perfil de outro', $$update public.profiles set full_name = 'X' where id = '00000000-0000-0000-0000-000000000001'$$, 0);

select test.login('00000000-0000-0000-0000-000000000003');  -- dani (gerente A)
select test.affects('gerente cria categoria', $$insert into public.categories (store_id, name, slug) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bolsas', 'bolsas')$$, 1);
select test.affects('gerente cria coleção', $$insert into public.collections (store_id, name, slug) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Festa', 'festa')$$, 1);
select test.affects('gerente cria coleção automática de Novidades',
  $$insert into public.collections (store_id, name, slug, kind, new_arrivals_days) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Novidades', 'novidades', 'new_arrivals', 7)$$, 1);
select test.denied('coleção manual NÃO aceita new_arrivals_days',
  $$insert into public.collections (store_id, name, slug, new_arrivals_days) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Errada', 'errada', 7)$$);
select test.affects('gerente apaga produto', $$delete from public.products where id = 'eeeeeeee-0000-0000-0000-000000000a02'$$, 1);
select test.affects('gerente NÃO edita a loja', $$update public.stores set name = 'Hack' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 0);
select test.denied('gerente NÃO adiciona membros', $$insert into public.store_members (store_id, user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000005', 'attendant')$$);

select test.login('00000000-0000-0000-0000-000000000001');  -- alice (dona A)
select test.affects('dona edita a loja', $$update public.stores set name = 'Loja A Premium', whatsapp = '5511999998888' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$, 1);
select test.denied('dona NÃO se reativa/desativa sozinha (is_active é do Super Admin)', $$update public.stores set is_active = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('dona NÃO troca o slug por aqui', $$update public.stores set slug = 'outra' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('WhatsApp inválido é recusado', $$update public.stores set whatsapp = '(11) 9999' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.denied('logo só pode apontar para a pasta da própria loja',
  $$update public.stores set logo_path = 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/branding/logo.png' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$);
select test.affects('dona adiciona atendente à equipe', $$insert into public.store_members (store_id, user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000005', 'attendant')$$, 1);
select test.affects('dona muda o papel de um membro', $$update public.store_members set role = 'manager' where user_id = '00000000-0000-0000-0000-000000000005'$$, 1);
select test.affects('dona remove membro', $$delete from public.store_members where user_id = '00000000-0000-0000-0000-000000000005'$$, 1);
select test.denied('último dono NÃO pode sair', $$delete from public.store_members where user_id = '00000000-0000-0000-0000-000000000001'$$);
select test.denied('último dono NÃO pode se rebaixar', $$update public.store_members set role = 'manager' where user_id = '00000000-0000-0000-0000-000000000001'$$);
select test.denied('preço promocional precisa ser menor que o preço', $$update public.products set promo_price = 500 where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.denied('SKU duplicado na mesma loja é recusado', $$update public.products set sku = 'V3' where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.denied('slug duplicado na mesma loja é recusado', $$update public.products set slug = 'vestido-vendido' where id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);

-- ===================================================== 3. CATÁLOGO PÚBLICO (anon)
\echo '--- catálogo público (anônimo)'
select test.anon();
select test.ok('anon vê as 2 lojas ativas', (select count(*) from public.stores) = 2);
select test.ok('anon vê só produtos publicáveis (disponível/reservado/vendido): A tem 3 (a01 reservado, a04 vendido, + Blusa Nova) e B tem 1',
  (select count(*) from public.products) = 4);
select test.ok('anon NÃO vê arquivado nem indisponível',
  (select count(*) from public.products where slug in ('vestido-antigo', 'vestido-oculto')) = 0);
select test.ok('anon vê imagens só de produtos visíveis (a01, a04 e b01)', (select count(*) from public.product_images) = 3);
select test.ok('anon NÃO vê coleção não publicada', (select count(*) from public.collections where slug = 'rascunho') = 0);
select test.ok('anon NÃO vê itens de coleção não publicada',
  (select count(*) from public.collection_products where collection_id = 'dddddddd-0000-0000-0000-00000000000c') = 0);
select test.ok('anon vê itens de coleção publicada', (select count(*) from public.collection_products where collection_id = 'dddddddd-0000-0000-0000-00000000000a') = 2);
select test.denied('anon NÃO lê SKU', $$select sku from public.products$$);
select test.denied('anon NÃO lê quem criou/alterou', $$select created_by from public.products$$);
select test.denied('anon NÃO lê created_by da loja', $$select created_by from public.stores$$);
select test.denied('anon NÃO lê is_active', $$select is_active from public.stores$$);
select test.denied('anon NÃO lê estoque', $$select * from public.inventory$$);
select test.denied('anon NÃO lê equipe', $$select * from public.store_members$$);
select test.denied('anon NÃO lê perfis', $$select * from public.profiles$$);
select test.denied('anon NÃO cria produto', $$insert into public.products (store_id, name, slug, price) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'x', 1)$$);
select test.denied('anon NÃO edita produto', $$update public.products set price = 1$$);
select test.denied('anon NÃO apaga produto', $$delete from public.products$$);
select test.denied('anon NÃO cria loja', $$select public.create_store('X', 'xis')$$);
select test.denied('anon NÃO desativa loja', $$select public.admin_set_store_active('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false)$$);

-- catálogo desligado pelo dono some do público, mas a equipe continua vendo
select test.login('00000000-0000-0000-0000-000000000004');
select test.affects('dona da B desliga o catálogo', $$update public.stores set catalog_enabled = false where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, 1);
select test.ok('a equipe da B ainda vê os próprios dados', (select count(*) from public.products) = 1);
select test.anon();
select test.ok('anon não vê mais a Loja B nem seus produtos',
  (select count(*) from public.stores) = 1 and (select count(*) from public.products where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0
  and (select count(*) from public.product_images where store_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0);

-- ===================================================== 4. SUPER ADMIN
\echo '--- super admin'
select test.login('00000000-0000-0000-0000-000000000006');
select test.ok('super admin vê todas as lojas e produtos',
  (select count(*) from public.stores) = 2 and (select count(*) from public.products) = 5
  and (select count(*) from public.profiles) = 6);
select test.affects('super admin NÃO edita produtos de lojas', $$update public.products set name = 'x'$$, 0);
select test.denied('super admin NÃO apaga loja por SQL direto', $$delete from public.stores$$);
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('dona NÃO chama a função de admin', $$select public.admin_set_store_active('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false)$$);
select test.login('00000000-0000-0000-0000-000000000006');
select public.admin_set_store_active('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select test.ok('super admin desativa a Loja A', (select is_active from public.stores where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = false);
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('loja desativada: a equipe ainda LÊ', (select count(*) from public.products) > 0);
select test.denied('loja desativada: a equipe NÃO escreve',
  $$insert into public.products (store_id, name, slug, price) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Novo', 'novo', 1)$$);
select test.anon();
select test.ok('loja desativada some do catálogo público', (select count(*) from public.stores) = 0 and (select count(*) from public.products) = 0);
select test.login('00000000-0000-0000-0000-000000000006');
select public.admin_set_store_active('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- ===================================================== 5. STORAGE
\echo '--- storage'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno (atendente A)
select test.affects('atendente envia foto de produto da própria loja',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/p1.jpg')$$, 1);
select test.denied('atendente NÃO envia para a pasta da Loja B',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/products/p1.jpg')$$);
select test.denied('atendente NÃO envia logo/banner (branding é do dono)',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/branding/logo.png')$$);
select test.denied('caminho com loja inválida é recusado (sem estourar erro de cast)',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/nao-e-uuid/products/p1.jpg')$$);
select test.denied('caminho fora do padrão stores/ é recusado',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'qualquer/coisa.jpg')$$);
select test.affects('atendente envia imagem de Story da própria loja',
  $$insert into storage.objects (bucket_id, name) values ('stories', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/s1.jpg')$$, 1);
select test.denied('Story NÃO vai para o bucket do catálogo público',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/s1.jpg')$$);
select test.login('00000000-0000-0000-0000-000000000001');
select test.affects('dona envia logo',
  $$insert into storage.objects (bucket_id, name) values ('catalog', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/branding/logo.png')$$, 1);
select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.ok('carla NÃO enxerga arquivos da Loja A (catálogo e stories)', (select count(*) from storage.objects) = 0);
select test.affects('carla NÃO apaga arquivos da Loja A', $$delete from storage.objects$$, 0);
select test.denied('carla NÃO envia Story para a pasta da Loja A',
  $$insert into storage.objects (bucket_id, name) values ('stories', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/x.jpg')$$);
select test.anon();
select test.denied('anon NÃO lista objetos do storage', $$select * from storage.objects$$);
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('equipe da A enxerga os 4 arquivos da própria loja', (select count(*) from storage.objects) = 3);

-- ===================================================== 6. CRIAÇÃO DE LOJA
\echo '--- criação de loja'
select test.login('00000000-0000-0000-0000-000000000005');  -- eva
select public.create_store('Loja da Eva', 'Loja-Eva');
select test.ok('eva cria a loja (slug normalizado) e vira dona',
  (select slug from public.stores) = 'loja-eva' and (select role from public.store_members) = 'owner');
select test.ok('eva vê só a própria loja', (select count(*) from public.stores) = 1);
select test.denied('slug reservado (admin) é recusado', $$select public.create_store('X', 'admin')$$);
select test.denied('slug inválido é recusado', $$select public.create_store('X', 'Loja Com Espaço')$$);
select test.denied('slug duplicado é recusado', $$select public.create_store('X', 'loja-a')$$);
select test.denied('nome vazio é recusado', $$select public.create_store('   ', 'loja-vazia')$$);

-- ===================================================== 7. REMOÇÃO EM CASCATA
select test.reset();
delete from public.stores where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.ok('apagar a loja leva junto produtos, estoque, fotos, coleções e equipe (sem travar no último dono)',
  (select count(*) from public.products where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0
  and (select count(*) from public.inventory where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0
  and (select count(*) from public.store_members where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0
  and (select count(*) from public.collections where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0);

\echo 'TODOS OS TESTES PASSARAM'
rollback;
