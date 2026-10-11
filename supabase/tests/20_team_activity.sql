-- ETAPA 10 — convites por link e histórico de atividades.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente A
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),    -- gerente A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com'),   -- dona B
  ('00000000-0000-0000-0000-000000000005', 'eva@x.com'),     -- sem loja
  ('00000000-0000-0000-0000-000000000006', 'fabio@x.com');   -- sem loja
update public.profiles set full_name = 'Alice' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Bruno' where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set full_name = 'Dani'  where id = '00000000-0000-0000-0000-000000000003';
update public.profiles set full_name = 'Eva'   where id = '00000000-0000-0000-0000-000000000005';
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
-- o que foi montado como superusuário não conta como atividade de ninguém: limpa para os testes de histórico
delete from public.activity_logs;

create temp table tk (name text, token text);
grant all on tk to public;

\echo '--- criar convite'
select test.login('00000000-0000-0000-0000-000000000001');  -- alice (dona)
insert into tk select 'atendente', public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant', 'Para a Eva', 7, 1);
insert into tk select 'gerente2', public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'manager', null, 3, 2);
select test.ok('o código tem 64 caracteres hexadecimais (256 bits de aleatoriedade)', (select token ~ '^[0-9a-f]{64}$' from tk where name = 'atendente'));
select test.reset();
select test.ok('o banco NÃO guarda o código, só o resumo (hash SHA-256)',
  (select count(*) from public.store_invites where token_hash = (select token from tk where name = 'atendente')) = 0
  and (select count(*) from public.store_invites where token_hash = encode(sha256(convert_to((select token from tk where name = 'atendente'), 'UTF8')), 'hex')) = 1
  and (select count(*) from public.store_invites where token_hash ~ '^[0-9a-f]{64}$') = 2);
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('não existe convite de DONO (promove-se um membro)', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner')$$);
select test.denied('prazo fora de 1 a 30 dias é recusado', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant', null, 90, 1)$$);
select test.denied('usos fora de 1 a 20 é recusado', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant', null, 7, 99)$$);
select test.denied('NÃO convida para a loja de outra pessoa', $$select public.create_invite('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'attendant')$$);
select test.login('00000000-0000-0000-0000-000000000003');  -- dani (gerente)
select test.denied('gerente NÃO convida', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant')$$);
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno (atendente)
select test.denied('atendente NÃO convida', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant')$$);
select test.anon();
select test.denied('anon NÃO convida', $$select public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant')$$);
select test.denied('anon NÃO lê a tabela de convites', $$select * from public.store_invites$$);
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('nem o dono grava convite direto na tabela', $$insert into public.store_invites (store_id, token_hash, role, expires_at) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'manager', now() + interval '1 day')$$);
select test.denied('nem altera direto (só pelas funções)', $$update public.store_invites set max_uses = 20$$);

\echo '--- pré-visualização (sem login)'
select test.anon();
select test.ok('o link mostra a loja e o papel, nada além disso',
  (select (j ->> 'valid')::boolean and j ->> 'store_name' = 'Loja A' and j ->> 'role' = 'attendant' and not (j ?| array['store_id','slug','token_hash','id','created_by'])
   from (select public.invite_preview((select token from tk where name = 'atendente')) j) q));
select test.ok('código errado ou vazio: inválido (not_found)',
  (select j ->> 'reason' = 'not_found' and not (j ->> 'valid')::boolean from (select public.invite_preview('abc') j) q)
  and (select j ->> 'reason' = 'not_found' from (select public.invite_preview('') j) q)
  and (select j ->> 'reason' = 'not_found' from (select public.invite_preview(null) j) q));

\echo '--- aceitar'
select test.denied('sem login não dá para aceitar', format($$select public.accept_invite('%s')$$, (select token from tk where name = 'atendente')));
select test.login('00000000-0000-0000-0000-000000000005');  -- eva
select test.denied('código inexistente é recusado (invite_not_found)', $$select public.accept_invite('0000000000000000000000000000000000000000000000000000000000000000')$$);
create temp table acc (j jsonb);
grant all on acc to public;
insert into acc select public.accept_invite((select token from tk where name = 'atendente'));
select test.ok('eva entra na loja como atendente', (select j ->> 'status' = 'joined' and j ->> 'slug' = 'loja-a' and j ->> 'role' = 'attendant' from acc)
  and (select role from public.store_members where user_id = '00000000-0000-0000-0000-000000000005') = 'attendant');
select test.ok('depois de entrar, ela enxerga a loja', (select count(*) from public.stores) = 1);
select test.ok('aceitar de novo não gasta nada e avisa que já é membro',
  (select public.accept_invite((select token from tk where name = 'atendente')) ->> 'status') = 'already_member');
select test.login('00000000-0000-0000-0000-000000000006');  -- fabio
select test.denied('convite de uso único já usado NÃO vale para outra pessoa (invite_used)', format($$select public.accept_invite('%s')$$, (select token from tk where name = 'atendente')));
select test.anon();
select test.ok('a pré-visualização também mostra "usado"', (select j ->> 'reason' = 'used' from (select public.invite_preview((select token from tk where name = 'atendente')) j) q));
select test.reset();
select test.ok('o convite registra 1 uso', (select uses from public.store_invites where label = 'Para a Eva') = 1);

\echo '--- vários usos, prazo e revogação'
select test.login('00000000-0000-0000-0000-000000000006');
select test.ok('convite de 2 usos aceita a primeira pessoa', (select public.accept_invite((select token from tk where name = 'gerente2')) ->> 'role') = 'manager');
select test.login('00000000-0000-0000-0000-000000000001');
insert into tk select 'vence', public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant', 'Vai vencer', 1, 1);
insert into tk select 'revoga', public.create_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'attendant', 'Vai revogar', 5, 1);
select public.revoke_invite((select id from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where label = 'Vai revogar'));
select test.reset();
update public.store_invites set expires_at = now() - interval '1 minute' where label = 'Vai vencer';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000007', 'gabi@x.com');
select test.login('00000000-0000-0000-0000-000000000007');
select test.denied('convite vencido é recusado (invite_expired)', format($$select public.accept_invite('%s')$$, (select token from tk where name = 'vence')));
select test.denied('convite revogado é recusado (invite_revoked)', format($$select public.accept_invite('%s')$$, (select token from tk where name = 'revoga')));
select test.anon();
select test.ok('a pré-visualização distingue vencido e revogado',
  (select j ->> 'reason' = 'expired' from (select public.invite_preview((select token from tk where name = 'vence')) j) q)
  and (select j ->> 'reason' = 'revoked' from (select public.invite_preview((select token from tk where name = 'revoga')) j) q));
select test.reset();
update public.stores set is_active = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.login('00000000-0000-0000-0000-000000000001');
select test.reset();
update public.store_invites set expires_at = now() + interval '3 days', revoked_at = null, uses = 0, max_uses = 5 where label = 'Vai revogar';
select test.login('00000000-0000-0000-0000-000000000007');
select test.denied('loja desativada: ninguém entra (store_inactive)', format($$select public.accept_invite('%s')$$, (select token from tk where name = 'revoga')));
select test.reset();
update public.stores set is_active = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- lista de convites (dono)'
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('a lista mostra a situação de cada convite e quem criou, sem expor o código',
  (select count(*) from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 4
  and (select status from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where label = 'Para a Eva') = 'used'
  and (select status from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where label = 'Vai vencer') = 'expired'
  and (select status from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where label = 'Vai revogar') = 'active'
  and (select created_by_name from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') limit 1) = 'Alice'
  and (select not (to_jsonb(t) ?| array['token','token_hash']) from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') t limit 1));
select test.login('00000000-0000-0000-0000-000000000003');
select test.ok('gerente não vê convites', (select count(*) from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);
select test.denied('gerente NÃO revoga', format($$select public.revoke_invite('%s')$$, (select id from (select id from public.store_invites limit 1) q)));
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('outra loja não vê convites da A', (select count(*) from public.store_invites_list('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);

\echo '--- histórico: o que é registrado'
select test.reset();
delete from public.activity_logs;
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno (atendente) trabalha
create temp table pid (id uuid);
grant all on pid to public;
insert into pid select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Vestido","slug_base":"vestido","price":100,"quantity":4}'::jsonb);
select test.ok('criar produto registra "product.created" por Bruno com o preço (e o estoque inicial não duplica)',
  (select count(*) from public.activity_logs where action = 'product.created' and entity_name = 'Vestido' and actor_id = '00000000-0000-0000-0000-000000000002' and (details ->> 'price')::numeric = 100) = 1
  and (select count(*) from public.activity_logs where action = 'stock.initial') = 0);
select public.save_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from pid), '{"name":"Vestido Midi","price":120,"promo_price":99,"sizes":["P","M"],"quantity":4,"featured":true}'::jsonb);
select test.ok('editar registra o que mudou (nome e preço com antes e depois, destaque, tamanhos)',
  (select details -> 'changes' -> 'price' = '[100.00, 120.00]'::jsonb and details -> 'changes' -> 'name' = '["Vestido", "Vestido Midi"]'::jsonb
      and details -> 'changes' ? 'featured' and details -> 'changes' ? 'sizes' and details -> 'changes' ? 'promo_price'
   from public.activity_logs where action = 'product.updated' and entity_name = 'Vestido Midi'));
select count(*) as antes from public.activity_logs \gset
select test.reset();
update public.products set updated_at = now() where id = (select id from pid);
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('mexer sem mudar nada que importa NÃO gera atividade', (select count(*) from public.activity_logs) = :antes);
select public.adjust_stock((select id from pid), 6, 'restock', 'Chegou caixa');
select public.adjust_stock((select id from pid), -2, 'sale');
select test.ok('entrada e venda de estoque viram atividades com a variação e o saldo',
  (select details = '{"delta": 6, "after": 10}'::jsonb from public.activity_logs where action = 'stock.restock')
  and (select details = '{"delta": -2, "after": 8}'::jsonb from public.activity_logs where action = 'stock.sale'));
select public.create_reservation((select id from pid), 2, 'Maria Segredo', '84999990000');
select test.ok('reserva aparece no histórico SEM o nome da cliente',
  (select count(*) from public.activity_logs where action = 'stock.reserved') = 1
  and (select count(*) from public.activity_logs where to_jsonb(activity_logs)::text ilike '%Segredo%') = 0
  and (select count(*) from public.activity_logs where to_jsonb(activity_logs)::text ilike '%99999%') = 0);
select public.add_interest((select id from pid), 'Joana Sigilo', '84 98888-7777');
select test.ok('lista de espera registra só a peça, nunca a pessoa (exclusão de dados não deixa rastro)',
  (select count(*) from public.activity_logs where action = 'interest.added' and entity_name = 'Vestido Midi') = 1
  and (select count(*) from public.activity_logs where to_jsonb(activity_logs)::text ilike '%Sigilo%') = 0
  and (select count(*) from public.activity_logs where to_jsonb(activity_logs)::text ilike '%98888%') = 0);
select test.ok('mudança de situação do produto aparece com de/para', (select count(*) from public.activity_logs where action = 'product.status') = 0);
select public.set_stock((select id from pid), 2);   -- 2 reservadas: tudo reservado? 2 = reservado 2 → situação "reserved"
select test.ok('o sistema trocar a situação por causa do estoque também fica registrado, com o autor',
  (select details = '{"from": "available", "to": "reserved"}'::jsonb and actor_id = '00000000-0000-0000-0000-000000000002' from public.activity_logs where action = 'product.status'));
select test.login('00000000-0000-0000-0000-000000000003');  -- dani (gerente) organiza
select public.save_category('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Vestidos","slug_base":"vestidos"}');
select public.save_collection('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, '{"name":"Primavera","slug_base":"primavera","kind":"manual","published":true}');
insert into public.product_images (store_id, product_id, path) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from pid), 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/1.webp');
select test.ok('categoria, coleção e foto também entram no histórico',
  (select count(*) from public.activity_logs where action = 'category.created' and entity_name = 'Vestidos') = 1
  and (select count(*) from public.activity_logs where action = 'collection.created' and entity_name = 'Primavera') = 1
  and (select count(*) from public.activity_logs where action = 'image.added' and entity_name = 'Vestido Midi') = 1);
select test.login('00000000-0000-0000-0000-000000000001');  -- alice (dona)
select test.ok('mudar a função de um membro registra de/para', (select count(*) from public.store_members where user_id = '00000000-0000-0000-0000-000000000005') = 1);
update public.store_members set role = 'manager' where user_id = '00000000-0000-0000-0000-000000000005';
update public.stores set whatsapp = '5584999990000', tagline = 'Moda', catalog_enabled = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.ok('papel e configurações da loja ficam registrados (quais campos, e o catálogo ligado/desligado)',
  (select details = '{"from": "attendant", "to": "manager"}'::jsonb and entity_name = 'Eva' from public.activity_logs where action = 'member.role')
  and (select details -> 'fields' @> '["WhatsApp", "textos"]'::jsonb from public.activity_logs where action = 'store.updated')
  and (select (details ->> 'enabled')::boolean = false from public.activity_logs where action = 'store.catalog'));
select test.ok('convites e entradas na equipe aparecem', (select count(*) from public.activity_logs where action = 'member.role') = 1);
delete from public.store_members where user_id = '00000000-0000-0000-0000-000000000005';
select test.ok('remover membro registra "member.removed"', (select count(*) from public.activity_logs where action = 'member.removed' and entity_name = 'Eva') = 1);
select test.login('00000000-0000-0000-0000-000000000006');   -- fabio entrou como gerente pelo convite de 2 usos
delete from public.store_members where user_id = '00000000-0000-0000-0000-000000000006';
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('sair da loja (a própria pessoa) é "member.left", não "removed"', (select count(*) from public.activity_logs where action = 'member.left') = 1
  and (select count(*) from public.activity_logs where action = 'member.removed') = 1);

\echo '--- histórico: quem enxerga'
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('a dona vê tudo', (select count(*) from public.activity_logs) > 15
  and (select count(distinct actor_id) from public.activity_logs) >= 3);
create temp table all_n as select count(*) n from public.activity_logs;
grant select on all_n to public;
select test.login('00000000-0000-0000-0000-000000000003');
select test.ok('o gerente vê tudo', (select count(*) from public.activity_logs) = (select n from all_n));
select test.login('00000000-0000-0000-0000-000000000002');
select test.ok('o atendente vê SÓ as próprias ações',
  (select count(*) from public.activity_logs) > 0
  and (select count(*) from public.activity_logs where actor_id is distinct from '00000000-0000-0000-0000-000000000002') = 0
  and (select count(*) from public.activity_logs) < (select n from all_n));
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('outra loja não vê nada da A', (select count(*) from public.activity_logs) = 0);
select test.anon();
select test.denied('anon NÃO lê o histórico', $$select * from public.activity_logs$$);
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('ninguém grava no histórico (nem a dona)', $$insert into public.activity_logs (store_id, action, entity_type) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'y')$$);
select test.denied('ninguém apaga o histórico', $$delete from public.activity_logs$$);
select test.denied('ninguém edita o histórico', $$update public.activity_logs set action = 'x'$$);

\echo '--- consulta do histórico'
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('mais recente primeiro (nenhuma linha é mais nova que a anterior) e com o nome de quem fez',
  (select bool_and(created_at <= prev) from (select created_at, lag(created_at) over (order by rn) as prev
     from (select created_at, row_number() over () as rn from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, null, null, 100)) x) y where prev is not null)
  and (select actor_name from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002') limit 1) = 'Bruno');
select test.ok('filtra por pessoa', (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', null, null, 100)) > 0
  and (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', null, null, 100) where actor_id <> '00000000-0000-0000-0000-000000000002') = 0);
select test.ok('filtra por tipo e por peça', (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'category', null, 100)) = 1
  and (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'product', (select id from pid), 100) where entity_id <> (select id from pid)) = 0
  and (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'product', (select id from pid), 100)) >= 7);
select test.ok('paginação e limite máximo', (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, null, null, 3, 0)) = 3
  and (select total from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, null, null, 3, 0) limit 1) = (select n from all_n)
  and (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, null, null, 100000)) <= 100);
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('outra loja consultando a A recebe vazio', (select count(*) from public.store_activity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0);

\echo '--- quem alterou cada produto (campos do próprio produto)'
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('o produto guarda quem criou e quem alterou por último',
  (select created_by = '00000000-0000-0000-0000-000000000002' from public.products where id = (select id from pid))
  and (select updated_by is not null from public.products where id = (select id from pid)));

\echo '--- loja apagada e tempo real'
select test.reset();
delete from public.stores where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select test.ok('apagar uma loja não falha por causa dos gatilhos do histórico', (select count(*) from public.stores where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0);
delete from public.stores where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.ok('apagar a loja com produtos, fotos, equipe e convites leva o histórico junto (sem erro)',
  (select count(*) from public.activity_logs) = 0 and (select count(*) from public.store_invites) = 0);
select test.ok('histórico e convites estão na publicação do Realtime',
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('activity_logs', 'store_invites')) = 2);

\echo 'TESTES DE EQUIPE E HISTÓRICO OK'
rollback;
