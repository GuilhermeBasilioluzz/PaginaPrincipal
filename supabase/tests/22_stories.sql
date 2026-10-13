-- ETAPA 11 (pista A) — caixa de Stories recebidos (entrada manual) e conversão em produto rascunho.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');   -- dona B
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
delete from public.activity_logs;

\echo '--- receber'
select test.login('00000000-0000-0000-0000-000000000002');  -- atendente
select test.affects('atendente recebe um Story',
  $$insert into public.story_items (store_id, path, caption) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/s1.webp', 'Vestido novo')$$, 1);
select test.denied('caminho de outra loja é recusado',
  $$insert into public.story_items (store_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/stories/x.webp')$$);
select test.denied('legenda longa demais é recusada',
  format($f$insert into public.story_items (store_id, path, caption) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/y.webp', '%s')$f$, repeat('x', 501)));
select test.denied('não dá para criar já como convertido nem como instagram',
  $$insert into public.story_items (store_id, path, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/z.webp', 'converted')$$);
select test.denied('não dá para se passar por origem instagram',
  $$insert into public.story_items (store_id, path, source) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/w.webp', 'instagram')$$);
select test.ok('autor registrado', (select created_by = '00000000-0000-0000-0000-000000000002' from public.story_items limit 1));

\echo '--- isolamento'
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('outra loja não vê', (select count(*) from public.story_items) = 0);
select test.ok('lista da função também não', (select count(*) from public.store_stories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);
select test.denied('outra loja não converte', $$select public.convert_story((select id from public.story_items), '{"name":"X","price":"1","slug_base":"x"}'::jsonb)$$);
select test.anon();
select test.denied('visitante não acessa a tabela', $$select * from public.story_items$$);

\echo '--- converter'
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('lista tem 1 pendente com autor', (select count(*) from public.store_stories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 1);
select test.ok('converte', public.convert_story((select id from public.story_items), '{"name":"Vestido do Story","price":"199.9","slug_base":"vestido-do-story","quantity":"3","status":"available"}'::jsonb) is not null);
select test.ok('produto nasce RASCUNHO (indisponível) mesmo pedindo "available", origem instagram, fora do catálogo',
  (select status = 'unavailable' and source = 'instagram' from public.products where slug = 'vestido-do-story')
  and (select count(*) from public.catalog_products('loja-a')) = 0);
select test.ok('story marcado como convertido e ligado ao produto',
  (select status = 'converted' and product_id = (select id from public.products where slug = 'vestido-do-story') from public.story_items));
select test.ok('estoque inicial gravado', (select quantity = 3 from public.inventory where product_id = (select id from public.products where slug = 'vestido-do-story')));
select test.denied('não converte duas vezes', $$select public.convert_story((select id from public.story_items), '{"name":"Outra","price":"1","slug_base":"o"}'::jsonb)$$);
select test.ok('lista de pendentes esvaziou', (select count(*) from public.store_stories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);
select test.ok('lista de convertidos traz o nome do produto',
  (select product_name = 'Vestido do Story' from public.store_stories('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'converted')));

\echo '--- descartar e excluir'
select test.login('00000000-0000-0000-0000-000000000001');
insert into public.story_items (store_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/stories/d.webp');
select test.affects('descartar', $$update public.story_items set status = 'discarded' where path like '%/d.webp'$$, 1);
select test.affects('restaurar para pendente', $$update public.story_items set status = 'pending' where path like '%/d.webp'$$, 1);
select test.denied('não dá para marcar convertido na mão',
  $$update public.story_items set status = 'converted' where path like '%/d.webp'$$);
select test.login('00000000-0000-0000-0000-000000000002');
select test.affects('atendente não exclui o registro', $$delete from public.story_items where path like '%/d.webp'$$, 0);
select test.login('00000000-0000-0000-0000-000000000001');
select test.affects('dono exclui', $$delete from public.story_items where path like '%/d.webp'$$, 1);

\echo '--- apagar o produto não apaga o Story'
select test.affects('excluir produto', $$delete from public.products where slug = 'vestido-do-story'$$, 1);
select test.ok('story continua, sem produto', (select count(*) from public.story_items where status = 'converted' and product_id is null) = 1);

\echo '--- histórico'
select test.reset();
select test.ok('log: recebido, convertido e descartado, sem legenda',
  (select count(*) from public.activity_logs where action = 'story.received') = 2
  and (select count(*) from public.activity_logs where action = 'story.converted') = 1
  and (select count(*) from public.activity_logs where action = 'story.discarded') = 1
  and not exists (select 1 from public.activity_logs where details::text ilike '%Vestido novo%'));

\echo 'TESTES DE STORIES OK'
rollback;
