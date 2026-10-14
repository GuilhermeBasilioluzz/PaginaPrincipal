-- ETAPA 13 — limite diário de chamadas de IA por loja.
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

select test.login('00000000-0000-0000-0000-000000000002');  -- atendente
select test.ok('1ª chamada: restam 2 (limite 3)', public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3) = 2);
select test.ok('2ª: resta 1', public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3) = 1);
select test.ok('3ª: resta 0', public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3) = 0);
select test.denied('4ª: estourou o limite', $$select public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3)$$);
select test.ok('contador não passou do limite', (select calls = 3 from public.ai_usage));
select public.ai_refund_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select test.ok('agora há 2 usadas', (select calls = 2 from public.ai_usage));
select test.login('00000000-0000-0000-0000-000000000001');  -- dona: mesma contagem da loja
select test.ok('a dona vê o mesmo contador', (select calls = 2 from public.ai_usage));
select test.ok('limite pedido absurdo é limitado a 200', public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100000) = 197);

\echo '--- isolamento'
select test.login('00000000-0000-0000-0000-000000000004');
select test.denied('outra loja não gasta a cota da A', $$select public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3)$$);
select test.denied('outra loja não devolve', $$select public.ai_refund_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);
select test.ok('outra loja não vê o contador da A', (select count(*) from public.ai_usage where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0);
select test.ok('a cota da B é separada', public.ai_register_call('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3) = 2);
select test.login('00000000-0000-0000-0000-000000000005');
select test.denied('quem não é da equipe não usa', $$select public.ai_register_call('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3)$$);
select test.denied('ninguém escreve direto na tabela', $$update public.ai_usage set calls = 0$$);
select test.anon();
select test.denied('visitante não acessa', $$select * from public.ai_usage$$);
select test.denied('visitante não registra', $$select public.ai_register_call('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3)$$);

\echo 'TESTES DE USO DE IA OK'
rollback;
