-- ETAPA 12 — vários Stories num produto, anexar a produto existente, contagem de pendentes.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
insert into public.story_items (id, store_id, path) select
  ('11111111-0000-0000-0000-00000000000' || n)::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/s' || n || '.webp' from generate_series(1, 9) n;
insert into public.story_items (id, store_id, path) values
  ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/stories/b1.webp');
insert into public.products (id, store_id, name, slug, price, status) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Existente', 'existente', 100, 'available'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Da B', 'da-b', 100, 'available');

\echo '--- contagem'
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('9 pendentes na loja A', public.stories_pending_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 9);
select test.ok('loja B é outra conta', public.stories_pending_count('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0);

\echo '--- vários Stories → 1 produto'
create temp table r (pid uuid); grant all on r to public;
insert into r select public.convert_stories(array['11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003']::uuid[],
  '{"name":"Conjunto","price":"250","slug_base":"conjunto","quantity":"2","audience":"feminine","styles":["Festa"]}'::jsonb);
select test.ok('um produto rascunho, origem instagram, com público e estilo',
  (select count(*) = 1 and bool_and(status = 'unavailable' and source = 'instagram' and audience = 'feminine' and styles = array['Festa']) from public.products where slug = 'conjunto'));
select test.ok('3 stories ligados ao mesmo produto',
  (select count(*) = 3 from public.story_items where product_id = (select pid from r) and status = 'converted'));
select test.ok('pendentes caiu para 6', public.stories_pending_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 6);
select test.denied('não reaproveita Story já convertido',
  $$select public.convert_stories(array['11111111-0000-0000-0000-000000000001']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.ok('falha não deixa produto pela metade: nenhum "x"', (select count(*) from public.products where slug = 'x') = 0);
select test.denied('lista vazia', $$select public.convert_stories(array[]::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.denied('repetido na lista', $$select public.convert_stories(array['11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.denied('mais de 8',
  $$select public.convert_stories(array['11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000003']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.denied('misturar lojas é recusado',
  $$select public.convert_stories(array['11111111-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);

\echo '--- anexar a produto existente'
select test.ok('anexa 2 Stories', public.attach_stories(array['11111111-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000005']::uuid[], 'eeeeeeee-0000-0000-0000-000000000001') = 2);
select test.ok('ficam ligados ao produto e o produto continua como estava',
  (select count(*) = 2 from public.story_items where product_id = 'eeeeeeee-0000-0000-0000-000000000001' and status = 'converted')
  and (select status = 'available' from public.products where id = 'eeeeeeee-0000-0000-0000-000000000001'));
select test.denied('produto de outra loja', $$select public.attach_stories(array['11111111-0000-0000-0000-000000000006']::uuid[], 'eeeeeeee-0000-0000-0000-00000000000b')$$);
select test.denied('produto inexistente', $$select public.attach_stories(array['11111111-0000-0000-0000-000000000006']::uuid[], gen_random_uuid())$$);
-- limite de 8 fotos
insert into public.product_images (store_id, product_id, path, position)
  select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000001', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/p/' || n || '.webp', n from generate_series(1, 7) n;
select test.denied('passar de 8 fotos é recusado', $$select public.attach_stories(array['11111111-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000007']::uuid[], 'eeeeeeee-0000-0000-0000-000000000001')$$);
select test.ok('recusa não consumiu os Stories', public.stories_pending_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 4);

\echo '--- isolamento'
select test.login('00000000-0000-0000-0000-000000000004');
select test.denied('outra loja não converte Story da A', $$select public.convert_stories(array['11111111-0000-0000-0000-000000000006']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.denied('outra loja não anexa Story da A', $$select public.attach_stories(array['11111111-0000-0000-0000-000000000006']::uuid[], 'eeeeeeee-0000-0000-0000-00000000000b')$$);
select test.anon();
select test.denied('visitante não converte', $$select public.convert_stories(array['11111111-0000-0000-0000-000000000006']::uuid[], '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.denied('visitante não conta', $$select public.stories_pending_count('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);

\echo 'TESTES DE CONVERSÃO OK'
rollback;
