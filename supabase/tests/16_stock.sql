-- ETAPA 7 — estoque com histórico, reservas, situação automática, painel ao vivo.
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

create temp table p (name text, id uuid);
grant all on p to public;

\echo '--- estoque inicial e histórico'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
insert into p select 'v', public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Vestido","slug_base":"vestido","price":100,"quantity":10}'::jsonb);
insert into p select 'c', public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Camisa","slug_base":"camisa","price":50,"quantity":3}'::jsonb);
insert into p select 'z', public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Zero","slug_base":"zero","price":50,"quantity":0}'::jsonb);
select test.ok('produto novo grava o estoque inicial e o histórico (initial, +10, por Bruno)',
  (select quantity from public.inventory where product_id = (select id from p where name = 'v')) = 10
  and (select count(*) from public.inventory_movements where product_id = (select id from p where name = 'v') and reason = 'initial' and delta = 10 and quantity_after = 10 and created_by = '00000000-0000-0000-0000-000000000002') = 1);
select test.ok('estoque inicial 0 não gera movimentação e não muda a situação do produto',
  (select count(*) from public.inventory_movements where product_id = (select id from p where name = 'z')) = 0
  and (select status from public.products where id = (select id from p where name = 'z')) = 'available');

\echo '--- ajustes'
select test.ok('entrada de mercadoria soma ao estoque', public.adjust_stock((select id from p where name = 'v'), 5, 'restock', 'Chegou caixa nova') = 15);
select test.ok('venda no balcão baixa o estoque', public.adjust_stock((select id from p where name = 'v'), -2, 'sale') = 13);
select public.set_stock((select id from p where name = 'v'), 13);
select test.ok('contagem para o mesmo valor não gera movimentação (ficam 3: inicial, entrada, venda)',
  (select count(*) from public.inventory_movements where product_id = (select id from p where name = 'v')) = 3);
select public.set_stock((select id from p where name = 'v'), 12, 'Contagem do dia');
select test.ok('contagem diferente ajusta e registra a diferença (-1)',
  (select quantity from public.inventory where product_id = (select id from p where name = 'v')) = 12
  and (select delta from public.inventory_movements where product_id = (select id from p where name = 'v') and reason = 'adjustment' order by created_at desc, id limit 1) = -1);
select test.ok('o estoque registra quem mexeu por último (updated_by = Bruno)',
  (select updated_by from public.inventory where product_id = (select id from p where name = 'v')) = '00000000-0000-0000-0000-000000000002');
select test.denied('entrada com número negativo é recusada', format($$select public.adjust_stock('%s', -1, 'restock')$$, (select id from p where name = 'v')));
select test.denied('venda com número positivo é recusada', format($$select public.adjust_stock('%s', 1, 'sale')$$, (select id from p where name = 'v')));
select test.denied('variação zero é recusada', format($$select public.adjust_stock('%s', 0, 'adjustment')$$, (select id from p where name = 'v')));
select test.denied('motivo "reserved" não vale como ajuste manual', format($$select public.adjust_stock('%s', 1, 'reserved')$$, (select id from p where name = 'v')));
select test.denied('estoque nunca fica negativo (insufficient_stock)', format($$select public.adjust_stock('%s', -99, 'sale')$$, (select id from p where name = 'v')));
select test.denied('contagem negativa é recusada', format($$select public.set_stock('%s', -1)$$, (select id from p where name = 'v')));
select test.denied('NÃO altera a quantidade direto na tabela', format($$update public.inventory set quantity = 999 where product_id = '%s'$$, (select id from p where name = 'v')));
select test.denied('NÃO forja movimentação direto', format($$insert into public.inventory_movements (store_id, product_id, delta, quantity_after, reason) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '%s', 100, 100, 'restock')$$, (select id from p where name = 'v')));
select test.denied('NÃO apaga o histórico', $$delete from public.inventory_movements$$);
select test.denied('NÃO edita o histórico', $$update public.inventory_movements set delta = 0$$);

\echo '--- situação automática (zero = esgotado/vendido; voltou = disponível)'
select public.adjust_stock((select id from p where name = 'c'), -3, 'sale');
select test.ok('vender tudo deixa a peça como vendida (esgotada)', (select status from public.products where id = (select id from p where name = 'c')) = 'sold');
select public.adjust_stock((select id from p where name = 'c'), 2, 'restock');
select test.ok('repor o estoque volta a peça para disponível', (select status from public.products where id = (select id from p where name = 'c')) = 'available');

\echo '--- reservas'
create temp table r (name text, id uuid);
grant all on r to public;
insert into r select 'maria', public.create_reservation((select id from p where name = 'v'), 2, '  Maria ', '11 99999-0000', 'M', 'Vem buscar sábado', null);
select test.ok('reserva criada: confirmada, com cliente, tamanho e quem reservou',
  (select status = 'confirmed' and customer_name = 'Maria' and size = 'M' and quantity = 2 and reserved_by = '00000000-0000-0000-0000-000000000002'
   from public.reservations where id = (select id from r where name = 'maria')));
select test.ok('a reserva aparece no histórico (delta 0) com o nome da cliente',
  (select count(*) from public.inventory_movements where reservation_id = (select id from r where name = 'maria') and reason = 'reserved' and delta = 0 and note = 'Reservado para Maria') = 1);
select test.ok('reservar não muda a quantidade física, só o disponível',
  (select quantity = 12 and reserved = 2 and available = 10 and stock_state = 'ok' from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido'));
select test.denied('não reserva mais do que o disponível (insufficient_stock)', format($$select public.create_reservation('%s', 11, 'João')$$, (select id from p where name = 'v')));
select test.denied('nome da cliente é obrigatório', format($$select public.create_reservation('%s', 1, '   ')$$, (select id from p where name = 'v')));
select test.denied('quantidade zero é recusada', format($$select public.create_reservation('%s', 0, 'João')$$, (select id from p where name = 'v')));
select test.denied('validade no passado é recusada', format($$select public.create_reservation('%s', 1, 'João', null, null, null, now() - interval '1 hour')$$, (select id from p where name = 'v')));
select test.denied('não dá para baixar o estoque abaixo do que está reservado (below_reserved)', format($$select public.set_stock('%s', 1)$$, (select id from p where name = 'v')));
select test.denied('nem vendendo mais do que sobra livre', format($$select public.adjust_stock('%s', -11, 'sale')$$, (select id from p where name = 'v')));

insert into r select 'joao', public.create_reservation((select id from p where name = 'v'), 10, 'João');
select test.ok('reservar tudo marca a peça como reservada (estado "reserved")',
  (select status from public.products where id = (select id from p where name = 'v')) = 'reserved'
  and (select stock_state = 'reserved' and available = 0 from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido'));
select public.set_reservation_status((select id from r where name = 'joao'), 'cancelled');
select test.ok('cancelar libera a peça: volta a disponível e registra a liberação',
  (select status from public.products where id = (select id from p where name = 'v')) = 'available'
  and (select status = 'cancelled' and closed_by = '00000000-0000-0000-0000-000000000002' and closed_at is not null from public.reservations where id = (select id from r where name = 'joao'))
  and (select count(*) from public.inventory_movements where reservation_id = (select id from r where name = 'joao') and reason = 'reservation_released') = 1);
select test.denied('reserva cancelada não muda mais (already_closed)', format($$select public.set_reservation_status('%s', 'picked_up')$$, (select id from r where name = 'joao')));

select public.set_reservation_status((select id from r where name = 'maria'), 'picked_up');
select test.ok('retirada vira venda: baixa 2 do estoque, fecha a reserva e liga a movimentação à reserva',
  (select quantity from public.inventory where product_id = (select id from p where name = 'v')) = 10
  and (select status from public.reservations where id = (select id from r where name = 'maria')) = 'picked_up'
  and (select count(*) from public.inventory_movements where reservation_id = (select id from r where name = 'maria') and reason = 'sale' and delta = -2) = 1
  and (select reserved from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido') = 0);

\echo '--- transições e solicitações'
select test.reset();
insert into public.reservations (id, store_id, product_id, quantity, customer_name, status)
  values ('99999999-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from p where name = 'v'), 1, 'Cliente do site', 'requested');
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('solicitação do cliente conta como reservada até alguém decidir',
  (select reserved from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido') = 1);
select public.set_reservation_status('99999999-0000-0000-0000-000000000001', 'confirmed');
select test.ok('solicitada → confirmada', (select status from public.reservations where id = '99999999-0000-0000-0000-000000000001') = 'confirmed');
select test.denied('confirmar o que já está confirmado é recusado (invalid_transition)', $$select public.set_reservation_status('99999999-0000-0000-0000-000000000001', 'confirmed')$$);
select test.denied('voltar para "solicitada" é recusado', $$select public.set_reservation_status('99999999-0000-0000-0000-000000000001', 'requested')$$);
select public.set_reservation_status('99999999-0000-0000-0000-000000000001', 'cancelled');

\echo '--- validade'
insert into r select 'exp', public.create_reservation((select id from p where name = 'v'), 3, 'Ana', null, null, null, now() + interval '2 hours');
select test.ok('reserva com validade futura conta enquanto vale', (select reserved from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido') = 3);
select test.reset();
update public.reservations set expires_at = now() - interval '1 minute' where id = (select id from r where name = 'exp');
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('reserva vencida deixa de segurar a peça e aparece como vencida na lista',
  (select reserved from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Vestido') = 0
  and (select expired from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active') where customer_name = 'Ana'));
select public.set_reservation_status((select id from r where name = 'exp'), 'cancelled');

\echo '--- peças que o sistema não mexe'
select test.reset();
update public.products set status = 'unavailable' where id = (select id from p where name = 'c');
select test.login('00000000-0000-0000-0000-000000000002');
select test.denied('peça indisponível não pode ser reservada (not_reservable)', format($$select public.create_reservation('%s', 1, 'João')$$, (select id from p where name = 'c')));
select public.adjust_stock((select id from p where name = 'c'), -2, 'sale');
select test.ok('"indisponível" é decisão humana: o sistema não troca para vendido mesmo com estoque zero',
  (select status from public.products where id = (select id from p where name = 'c')) = 'unavailable');

\echo '--- painel: totais, filtros, histórico'
select test.reset();
update public.products set status = 'available' where id = (select id from p where name = 'c');
select test.login('00000000-0000-0000-0000-000000000002');
-- v: 10 em estoque; c: 0; z: 0
select test.ok('totais: 3 peças, 10 unidades, 0 reservadas, 1 com estoque, 2 esgotadas',
  (select (j ->> 'products')::int = 3 and (j ->> 'units')::int = 10 and (j ->> 'reserved')::int = 0 and (j ->> 'available')::int = 10
          and (j ->> 'out')::int = 2 and (j ->> 'low')::int = 0 and (j ->> 'reservations')::int = 0
   from (select public.store_stock_totals('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') j) q));
select test.ok('filtro "out" traz só as esgotadas e "all" traz todas, esgotadas primeiro',
  (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'out')) = 2
  and (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all')) = 3
  and (select stock_state from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all') limit 1) = 'out'
  and (select total from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all') limit 1) = 3);
select public.adjust_stock((select id from p where name = 'c'), 2, 'restock');
select test.ok('poucas unidades: quantidade livre dentro do limite (2 ≤ 2) aparece em "low"',
  (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'low')) = 1
  and (select name from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'low')) = 'Camisa');
insert into r select 'live', public.create_reservation((select id from p where name = 'v'), 4, 'Paula');
select test.ok('filtro "reserved" traz as peças com reserva, e a reserva vem com cliente e quem reservou',
  (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reserved')) = 1
  and (select reservations -> 0 ->> 'customer' from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reserved')) = 'Paula'
  and (select reservations -> 0 ->> 'by' from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reserved')) = 'Bruno');
select test.ok('busca por nome e por código', (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all', 'vest')) = 1
  and (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all', 'zzzz')) = 0);
select test.ok('paginação: limite e deslocamento',
  (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all', '', 2, 0)) = 2
  and (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all', '', 2, 2)) = 1);
select test.ok('linha do tempo: mais recente primeiro, com autor e produto',
  (select reason from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10) limit 1) = 'reserved'
  and (select product_name from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10) limit 1) = 'Vestido'
  and (select actor from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 10) limit 1) = 'Bruno');
select test.ok('histórico por produto traz só o produto pedido e respeita o limite',
  (select count(*) from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100, (select id from p where name = 'c')) where product_name <> 'Camisa') = 0
  and (select count(*) from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2)) = 2);
select test.ok('lista de reservas: ativas, retiradas e canceladas',
  (select count(*) from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active')) = 1
  and (select count(*) from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'picked_up')) = 1
  and (select count(*) from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cancelled')) >= 3
  and (select reserved_by_name from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active')) = 'Bruno');

\echo '--- isolamento e permissões'
select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.ok('outra loja não vê estoque, reservas nem histórico da A',
  (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0
  and (select count(*) from public.store_reservations('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'all')) = 0
  and (select count(*) from public.store_stock_feed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0
  and (select count(*) from public.reservations) = 0 and (select count(*) from public.inventory_movements) = 0
  and (select (j ->> 'units')::int from (select public.store_stock_totals('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') j) q) = 0);
select test.denied('outra loja NÃO ajusta o estoque da A', format($$select public.adjust_stock('%s', 5, 'restock')$$, (select id from p where name = 'v')));
select test.denied('outra loja NÃO reserva peça da A', format($$select public.create_reservation('%s', 1, 'Invasor')$$, (select id from p where name = 'v')));
select test.denied('outra loja NÃO mexe em reserva da A', format($$select public.set_reservation_status('%s', 'cancelled')$$, (select id from r where name = 'live')));
select test.login('00000000-0000-0000-0000-000000000005');  -- eva (sem loja)
select test.denied('quem não tem loja NÃO ajusta estoque', format($$select public.adjust_stock('%s', 5, 'restock')$$, (select id from p where name = 'v')));
select test.anon();
select test.denied('anon NÃO ajusta estoque', format($$select public.adjust_stock('%s', 5, 'restock')$$, (select id from p where name = 'v')));
select test.denied('anon NÃO reserva', format($$select public.create_reservation('%s', 1, 'x')$$, (select id from p where name = 'v')));
select test.denied('anon NÃO lê reservas', $$select * from public.reservations$$);
select test.denied('anon NÃO lê histórico', $$select * from public.inventory_movements$$);
select test.denied('anon NÃO vê o painel de estoque', $$select * from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);

\echo '--- loja desativada congela o estoque'
select test.reset();
update public.stores set is_active = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.login('00000000-0000-0000-0000-000000000002');
select test.denied('loja desativada: NÃO ajusta estoque', format($$select public.adjust_stock('%s', 1, 'restock')$$, (select id from p where name = 'v')));
select test.denied('loja desativada: NÃO reserva', format($$select public.create_reservation('%s', 1, 'x')$$, (select id from p where name = 'v')));
select test.ok('loja desativada: a equipe ainda LÊ o painel', (select count(*) from public.store_stock_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 3);

\echo '--- tempo real'
select test.reset();
select test.ok('inventário, reservas e histórico estão na publicação do Realtime',
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('inventory', 'reservations', 'inventory_movements')) = 3);

delete from public.products where id = (select id from p where name = 'v');
select test.ok('excluir o produto leva junto reservas e histórico dele',
  (select count(*) from public.reservations where product_id = (select id from p where name = 'v')) = 0
  and (select count(*) from public.inventory_movements where product_id = (select id from p where name = 'v')) = 0);

\echo 'TESTES DE ESTOQUE E RESERVAS OK'
rollback;
