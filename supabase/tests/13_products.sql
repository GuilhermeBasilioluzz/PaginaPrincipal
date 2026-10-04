-- ETAPA 4 — gravar, atualizar e duplicar produtos.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),
  ('00000000-0000-0000-0000-000000000005', 'eva@x.com');
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
insert into public.categories (id, store_id, name, slug) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestidos', 'vestidos'),
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisas', 'camisas');
insert into public.collections (id, store_id, name, slug) values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera', 'primavera');
insert into public.products (id, store_id, name, slug, price) values
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisa B', 'camisa-b', 50);

\echo '--- criar'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
create temp table made (id uuid);
grant all on made to public;
insert into made select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, $j${
  "name":"Vestido Midi","slug_base":"vestido-midi","price":189.90,"promo_price":"","color":"Terracota",
  "sizes":["P","M","G"],"sku":"VM-01","category_id":"cccccccc-0000-0000-0000-00000000000a",
  "description":"Midi fluido","status":"available","featured":true,"quantity":7}$j$::jsonb);
select test.ok('atendente cria produto com preço, tamanhos, cor e categoria',
  (select price = 189.90 and sizes = array['P','M','G'] and color = 'Terracota' and is_featured and slug = 'vestido-midi'
   from public.products where id = (select id from made)));
select test.ok('o estoque já nasce com a quantidade informada (7)', (select quantity from public.inventory where product_id = (select id from made)) = 7);
select test.ok('registra quem criou', (select created_by from public.products where id = (select id from made)) = '00000000-0000-0000-0000-000000000002');

insert into made select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null,
  '{"name":"Vestido Midi","slug_base":"vestido-midi","price":99,"quantity":1}'::jsonb);
insert into made select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null,
  '{"name":"Vestido Midi","slug_base":"vestido-midi","price":99,"quantity":1}'::jsonb);
select test.ok('nome repetido gera endereços únicos (-2, -3)',
  (select array_agg(slug order by slug) from public.products where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  = array['vestido-midi','vestido-midi-2','vestido-midi-3']);
select test.ok('base vazia ou só símbolos vira "produto"',
  private.next_product_slug('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '') = 'produto'
  and private.next_product_slug('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '!!!') = 'produto'
  and private.next_product_slug('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Blusa Nova') = 'blusa-nova');

\echo '--- validações do banco'
select test.denied('SKU repetido na mesma loja é recusado',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":10,"sku":"VM-01","quantity":1}'::jsonb)$$);
select test.denied('promoção precisa ser menor que o preço',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":10,"promo_price":10,"quantity":1}'::jsonb)$$);
select test.denied('preço negativo é recusado',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":-1,"quantity":1}'::jsonb)$$);
select test.denied('estoque negativo é recusado (e nada é gravado: tudo ou nada)',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Falha","slug_base":"falha","price":10,"quantity":-5}'::jsonb)$$);
select test.ok('a criação que falhou no estoque não deixou produto pela metade',
  (select count(*) from public.products where name = 'Falha') = 0);
select test.denied('status inválido é recusado',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":10,"status":"sumido","quantity":1}'::jsonb)$$);
select test.denied('categoria de OUTRA loja é recusada',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"X","slug_base":"x","price":10,"category_id":"cccccccc-0000-0000-0000-00000000000b","quantity":1}'::jsonb)$$);

\echo '--- isolamento'
select test.denied('NÃO cria produto em loja alheia',
  $$select public.save_product('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, '{"name":"Invasor","slug_base":"invasor","price":1,"quantity":1}'::jsonb)$$);
select test.denied('NÃO edita produto de loja alheia',
  $$select public.save_product('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-0000-0000-0000-000000000b01', '{"name":"Hack","price":1,"quantity":1}'::jsonb)$$);
select test.denied('NÃO edita produto da B usando o id com a loja A',
  $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000b01', '{"name":"Hack","price":1,"quantity":1}'::jsonb)$$);
select test.denied('NÃO duplica produto de loja alheia', $$select public.duplicate_product('eeeeeeee-0000-0000-0000-000000000b01')$$);

\echo '--- editar'
select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from made limit 1),
  '{"name":"Vestido Midi Terracota","slug_base":"outro","price":179.9,"promo_price":149.9,"color":"","sizes":["M"],"sku":"","quantity":3,"featured":false,"status":"reserved"}'::jsonb);
select test.ok('edição altera os campos, limpa vazios (cor, sku) e atualiza o estoque',
  (select name = 'Vestido Midi Terracota' and price = 179.9 and promo_price = 149.9 and color is null and sku is null
          and sizes = array['M'] and status = 'reserved' and not is_featured
   from public.products where id = (select id from made limit 1))
  and (select quantity from public.inventory where product_id = (select id from made limit 1)) = 3);
select test.ok('o endereço (slug) NÃO muda ao editar o nome (links compartilhados continuam valendo)',
  (select slug from public.products where id = (select id from made limit 1)) = 'vestido-midi');
select test.ok('registra quem editou', (select updated_by from public.products where id = (select id from made limit 1)) = '00000000-0000-0000-0000-000000000002');

select test.reset();
update public.products set status = 'archived' where id = (select id from made limit 1);
select test.login('00000000-0000-0000-0000-000000000002');
select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from made limit 1),
  '{"name":"Arquivado editado","price":10,"quantity":2}'::jsonb);
select test.ok('sem "status" na edição, o produto arquivado continua arquivado',
  (select status from public.products where id = (select id from made limit 1)) = 'archived');

\echo '--- duplicar'
select test.reset();
insert into public.collection_products (store_id, collection_id, product_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', (select id from made limit 1));
update public.products set sku = 'VM-01', status = 'available', is_featured = true where id = (select id from made limit 1);
update public.inventory set quantity = 9 where product_id = (select id from made limit 1);
select test.login('00000000-0000-0000-0000-000000000002');
create temp table copy1 (id uuid);
grant all on copy1 to public;
insert into copy1 select public.duplicate_product((select id from made limit 1));
select test.ok('cópia: mesmo modelo, nome "(cópia)", fora do catálogo, sem SKU, sem destaque, origem "duplicate"',
  (select name like '% (cópia)' and status = 'unavailable' and sku is null and not is_featured and source = 'duplicate'
          and price = 10 and slug like '%-copia'
   from public.products where id = (select id from copy1)));
select test.ok('cópia nasce sem estoque', (select quantity from public.inventory where product_id = (select id from copy1)) = 0);
select test.ok('cópia continua nas mesmas coleções',
  (select count(*) from public.collection_products where product_id = (select id from copy1) and collection_id = 'dddddddd-0000-0000-0000-00000000000a') = 1);
create temp table copy2 (id uuid);
grant all on copy2 to public;
insert into copy2 select public.duplicate_product((select id from made limit 1));
select test.ok('duplicar de novo gera outro endereço', (select slug from public.products where id = (select id from copy2)) like '%-copia-2');

select test.anon();
select test.denied('anon NÃO grava produto', $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"x","price":1}'::jsonb)$$);
select test.denied('anon NÃO duplica', $$select public.duplicate_product('eeeeeeee-0000-0000-0000-000000000b01')$$);
select test.login('00000000-0000-0000-0000-000000000005');
select test.denied('quem não é da loja NÃO grava', $$select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"x","price":1}'::jsonb)$$);

\echo 'TESTES DE PRODUTOS OK'
rollback;
