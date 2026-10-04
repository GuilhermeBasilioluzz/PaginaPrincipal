-- ETAPA 2 — testes das funções de equipe.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),
  ('00000000-0000-0000-0000-000000000005', 'Eva@X.com'),
  ('00000000-0000-0000-0000-000000000006', 'root@hyperion');
update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-000000000006';
update public.profiles set full_name = 'Alice' where id = '00000000-0000-0000-0000-000000000001';

insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');

\echo '--- equipe'
select test.login('00000000-0000-0000-0000-000000000001');  -- alice, dona da A
select test.ok('dona vê a equipe da A com e-mails', (select count(*) from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 2
  and (select count(*) from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where email is not null) = 2);
select test.denied('dona NÃO vê a equipe da B', $$select * from public.store_team('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$);

select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
select test.ok('atendente vê a equipe, mas SEM e-mails',
  (select count(*) from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 2
  and (select count(*) from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where email is not null) = 0);
select test.denied('atendente NÃO adiciona membro', $$select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eva@x.com', 'attendant')$$);

select test.login('00000000-0000-0000-0000-000000000005');  -- eva (sem loja)
select test.denied('quem não é da loja NÃO vê a equipe', $$select * from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);
select test.denied('quem não é dono NÃO sonda e-mails (erro é de permissão, não de "não existe")',
  $$select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'qualquer@coisa.com', 'attendant')$$);

select test.login('00000000-0000-0000-0000-000000000001');
select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '  EVA@x.com ', 'manager');
select test.ok('dona adiciona por e-mail (sem diferenciar maiúsculas) com o papel escolhido',
  (select role from public.store_members where user_id = '00000000-0000-0000-0000-000000000005') = 'manager');
select test.denied('adicionar quem já é membro é recusado', $$select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eva@x.com', 'attendant')$$);
select test.denied('e-mail sem conta é recusado (user_not_found)', $$select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ninguem@x.com', 'attendant')$$);
select test.denied('dona da A NÃO adiciona membro na Loja B', $$select public.add_member_by_email('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bruno@a.com', 'attendant')$$);

select test.login('00000000-0000-0000-0000-000000000005');
select test.ok('o novo membro passa a enxergar a loja', (select count(*) from public.stores) = 1);

select test.anon();
select test.denied('anon NÃO lista equipe', $$select * from public.store_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);
select test.denied('anon NÃO adiciona membro', $$select public.add_member_by_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eva@x.com', 'owner')$$);

select test.login('00000000-0000-0000-0000-000000000006');  -- super admin
select test.ok('super admin vê a equipe de qualquer loja (sem e-mail)',
  (select count(*) from public.store_team('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')) = 1
  and (select count(*) from public.store_team('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') where email is not null) = 0);

\echo '--- endereços reservados'
select test.login('00000000-0000-0000-0000-000000000005');
select test.denied('slug "entrar" é reservado', $$select public.create_store('X', 'entrar')$$);
select test.denied('slug "recuperar-senha" é reservado', $$select public.create_store('X', 'recuperar-senha')$$);
select test.denied('slug "auth" é reservado', $$select public.create_store('X', 'auth')$$);

\echo 'TESTES DE EQUIPE OK'
rollback;
