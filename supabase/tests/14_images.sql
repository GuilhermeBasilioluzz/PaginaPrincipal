-- ETAPA 5 — fotos: limite, posição, reordenação, permissões.
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
insert into public.products (id, store_id, name, slug, price) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido', 'vestido', 10),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Outro',   'outro',   10),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisa',  'camisa',  10);

\echo '--- fotos'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
-- 3 fotos em ordem; a posição é decidida pelo banco, mesmo que o cliente tente impor outra
insert into public.product_images (store_id, product_id, path, kind, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/eeeeeeee-0000-0000-0000-000000000a01/f1.webp', 'front', 99),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/eeeeeeee-0000-0000-0000-000000000a01/f2.webp', 'back', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/eeeeeeee-0000-0000-0000-000000000a01/f3.webp', 'detail', 0);
select test.ok('atendente adiciona fotos e a posição é sequencial (0, 1, 2)',
  (select array_agg(position order by position) from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = array[0,1,2]);
select test.ok('a primeira foto enviada é a principal', (select path like '%f1.webp' from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' and position = 0));

\echo '--- limite'
insert into public.product_images (store_id, product_id, path)
  select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/eeeeeeee-0000-0000-0000-000000000a01/x' || g || '.webp'
  from generate_series(1, 5) g;
select test.ok('chega a 8 fotos', (select count(*) from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 8);
select test.denied('a 9ª foto é recusada (limit_reached)',
  $$insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/eeeeeeee-0000-0000-0000-000000000a01/9.webp')$$);
select test.ok('o limite é por produto: outro produto aceita fotos',
  (select count(*) from (select 1 from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a02') q) = 0);

\echo '--- reordenar'
create temp table ids as select id, position from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01';
grant select on ids to public;
-- inverte a ordem
select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a01', (select array_agg(id order by position desc) from ids));
select test.ok('inverter a ordem: a antiga última vira principal (posição 0)',
  (select id from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' and position = 0) = (select id from ids where position = 7)
  and (select array_agg(position order by position) from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = array[0,1,2,3,4,5,6,7]);
select test.denied('lista incompleta é recusada', $$select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a01', (select array_agg(id) from (select id from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' limit 7) q))$$);
select test.denied('lista com repetidos é recusada', $$select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a01', (select array_agg(id) from (select id from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' limit 1) q, generate_series(1, 8)))$$);
select test.denied('foto de outro produto na lista é recusada', $$select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a02', (select array_agg(id) from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01'))$$);

\echo '--- permissões'
select test.affects('atendente muda o tipo da foto', $$update public.product_images set kind = 'side' where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' and position = 1$$, 1);
select test.denied('atendente NÃO troca o arquivo da foto (path)', $$update public.product_images set path = 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/hack.webp' where product_id = 'eeeeeeee-0000-0000-0000-000000000a01'$$);
select test.affects('atendente remove foto', $$delete from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01' and position = 7$$, 1);
select test.ok('depois de remover uma, volta a caber outra', (select count(*) from public.product_images where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 7);

select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.denied('outra loja NÃO reordena fotos da A', $$select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a01', (select array_agg(id) from public.product_images))$$);
select test.denied('outra loja NÃO adiciona foto em produto da A', $$insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/z.webp')$$);
select test.anon();
select test.denied('anon NÃO reordena', $$select public.reorder_product_images('eeeeeeee-0000-0000-0000-000000000a01', array[gen_random_uuid()])$$);

\echo 'TESTES DE FOTOS OK'
rollback;
