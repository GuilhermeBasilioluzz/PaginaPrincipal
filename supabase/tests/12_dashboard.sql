-- ETAPA 3 — números do painel: corretos e isolados por loja.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),
  ('00000000-0000-0000-0000-000000000005', 'eva@x.com');
update public.profiles set full_name = 'Alice' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Bruno' where id = '00000000-0000-0000-0000-000000000002';

insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');

insert into public.categories (store_id, name, slug) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestidos', 'vestidos');
insert into public.collections (store_id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera', 'primavera'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Festa', 'festa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Verão', 'verao');

-- Loja A: 3 disponíveis (1 em destaque), 1 reservado, 2 vendidos, 1 indisponível, 1 arquivado (em destaque, não conta)
insert into public.products (store_id, name, slug, price, status, is_featured) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P1', 'p1', 10, 'available', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P2', 'p2', 10, 'available', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P3', 'p3', 10, 'available', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P4', 'p4', 10, 'reserved', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P5', 'p5', 10, 'sold', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P6', 'p6', 10, 'sold', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P7', 'p7', 10, 'unavailable', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P8', 'p8', 10, 'archived', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P9', 'p9', 10, 'available', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P10', 'p10', 10, 'available', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P11', 'p11', 10, 'available', false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'P12', 'p12', 10, 'available', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B1', 'b1', 10, 'available', true);
-- Estoque: p1=5 (ok), p2=2 (pouco, limite padrão 2), p3=0 (esgotado), p5 vendido=0 (não conta)
update public.inventory set quantity = 5 where product_id = (select id from public.products where slug = 'p1');
update public.inventory set quantity = 2 where product_id = (select id from public.products where slug = 'p2');
update public.inventory set quantity = 0 where product_id = (select id from public.products where slug = 'p3');
update public.inventory set quantity = 9 where product_id in (select id from public.products where slug in ('p9','p10','p11','p12','b1'));
-- p4 reservado com 1 unidade = pouco
update public.inventory set quantity = 1 where product_id = (select id from public.products where slug = 'p4');
-- atividade recente: ordem e autor (desliga o gatilho de updated_at só para forçar as datas)
alter table public.products disable trigger products_touch;
update public.products set updated_at = now() - interval '1 hour', updated_by = '00000000-0000-0000-0000-000000000002' where slug = 'p1';
update public.products set updated_at = now() + interval '1 hour', updated_by = '00000000-0000-0000-0000-000000000001' where slug = 'p2';
alter table public.products enable trigger products_touch;

\echo '--- painel'
select test.login('00000000-0000-0000-0000-000000000001');
create temp table d as select public.store_dashboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') as j;
grant select on d to public;
select test.ok('total ignora arquivados (11)', (select (j #>> '{products,total}')::int from d) = 11);
select test.ok('disponíveis = 7',   (select (j #>> '{products,available}')::int from d) = 7);
select test.ok('reservados = 1',    (select (j #>> '{products,reserved}')::int from d) = 1);
select test.ok('vendidos = 2',      (select (j #>> '{products,sold}')::int from d) = 2);
select test.ok('indisponíveis = 1', (select (j #>> '{products,unavailable}')::int from d) = 1);
select test.ok('arquivados = 1',    (select (j #>> '{products,archived}')::int from d) = 1);
select test.ok('em destaque não conta arquivado (1)', (select (j #>> '{products,featured}')::int from d) = 1);
select test.ok('coleções = 2, categorias = 1, equipe = 2',
  (select (j ->> 'collections')::int from d) = 2 and (select (j ->> 'categories')::int from d) = 1 and (select (j ->> 'team')::int from d) = 2);
select test.ok('sem reservas ativas, o painel mostra 0', (select (j ->> 'reservations')::int from d) = 0);
select test.ok('poucas unidades = 2 (p2 e p4)', (select (j #>> '{stock,low}')::int from d) = 2);
select test.ok('esgotados = 1 (p3; vendido e indisponível não contam)', (select (j #>> '{stock,out}')::int from d) = 1);
select test.ok('atividade recente: no máximo 8, mais recente primeiro, com autor',
  (select jsonb_array_length(j -> 'recent') from d) = 8
  and (select j #>> '{recent,0,name}' from d) = 'P2' and (select j #>> '{recent,0,actor}' from d) = 'Alice');
select test.ok('atividade de uma loja mostra só produtos dela',
  (select count(*) from d, jsonb_array_elements(j -> 'recent') e where e ->> 'name' like 'B%') = 0);

select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B) pedindo a Loja A
select test.ok('outra loja pedindo o painel da A recebe tudo zerado',
  (select (x #>> '{products,total}')::int = 0 and (x ->> 'collections')::int = 0 and (x ->> 'team')::int = 0
          and jsonb_array_length(x -> 'recent') = 0
   from (select public.store_dashboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') x) q));
select test.ok('a própria loja B tem 1 produto', (select (public.store_dashboard('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') #>> '{products,total}')::int = 1));

select test.login('00000000-0000-0000-0000-000000000005');  -- eva (sem loja)
select test.ok('quem não tem loja recebe zeros',
  (select (public.store_dashboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') #>> '{products,total}')::int = 0));
select test.anon();
select test.denied('anon NÃO acessa o painel', $$select public.store_dashboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);

\echo 'TESTES DO PAINEL OK'
rollback;
