-- ETAPA 8 (complemento) — "avise-me": clique anônimo, lista de espera da vendedora, página do produto.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');
update public.profiles set full_name = 'Bruno' where id = '00000000-0000-0000-0000-000000000002';
insert into public.stores (id, slug, name, whatsapp) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A', '5584999990000'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B', null);
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
insert into public.products (id, store_id, name, slug, price, status, sizes, description, color) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Saia Esgotada',  'saia-esgotada',  100, 'sold',      array['P','M'], 'Saia midi', 'Preto'),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Livre',  'vestido-livre',  100, 'available', array['M'], null, null),
  ('eeeeeeee-0000-0000-0000-000000000a03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Blusa Reservada','blusa-reservada', 80, 'reserved',  array['G'], null, null),
  ('eeeeeeee-0000-0000-0000-000000000a04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bolsa Oculta',   'bolsa-oculta',    80, 'unavailable', '{}', null, null),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisa B',       'camisa-b',        80, 'sold',      '{}', null, null);
update public.inventory set quantity = 0 where product_id in ('eeeeeeee-0000-0000-0000-000000000a01', 'eeeeeeee-0000-0000-0000-000000000b01');
update public.inventory set quantity = 5 where product_id = 'eeeeeeee-0000-0000-0000-000000000a02';
update public.inventory set quantity = 2 where product_id = 'eeeeeeee-0000-0000-0000-000000000a03';
insert into public.product_images (store_id, product_id, path, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/a.webp', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/b.webp', 1);

\echo '--- página pública do produto'
select test.anon();
select test.ok('a página traz o produto, fotos em ordem e o botão "avise-me" aberto quando esgotado',
  (select j -> 'product' ->> 'name' = 'Saia Esgotada' and (j -> 'product' ->> 'stock_label') = 'sold_out' and (j ->> 'interest_open')::boolean
      and j -> 'images' -> 0 ->> 'path' like '%/a.webp' and j -> 'store' ->> 'whatsapp' = '5584999990000'
   from (select public.catalog_product('loja-a', 'saia-esgotada') j) q));
select test.ok('peça disponível não abre o "avise-me"', (select not (public.catalog_product('loja-a', 'vestido-livre') ->> 'interest_open')::boolean));
select test.ok('peça toda reservada abre o "avise-me"', (select (public.catalog_product('loja-a', 'blusa-reservada') ->> 'interest_open')::boolean));
select test.ok('indisponível, inexistente ou de outra loja: null', (select public.catalog_product('loja-a', 'bolsa-oculta') is null)
  and (select public.catalog_product('loja-a', 'nada') is null) and (select public.catalog_product('loja-a', 'camisa-b') is null)
  and (select public.catalog_product('loja-x', 'saia-esgotada') is null));
select test.ok('a página não vaza id, sku, estoque ou autor',
  (select not (j -> 'product' ?| array['id','sku','quantity','created_by','status']) from (select public.catalog_product('loja-a', 'saia-esgotada') j) q));

\echo '--- clique anônimo'
select public.register_interest_click('loja-a', 'saia-esgotada');
select public.register_interest_click('LOJA-A', 'saia-esgotada');
select public.register_interest_click('loja-a', 'blusa-reservada');
select test.reset();
select test.ok('cliques do mesmo dia somam numa só linha por peça (2 + 1)',
  (select clicks from public.product_interest_clicks where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 2
  and (select count(*) from public.product_interest_clicks where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2);
select test.anon();
select test.denied('peça disponível NÃO recebe clique (not_open)', $$select public.register_interest_click('loja-a', 'vestido-livre')$$);
select test.denied('peça de outra loja NÃO recebe clique', $$select public.register_interest_click('loja-a', 'camisa-b')$$);
select test.denied('peça indisponível NÃO recebe clique', $$select public.register_interest_click('loja-a', 'bolsa-oculta')$$);
select test.denied('loja inexistente NÃO recebe clique', $$select public.register_interest_click('loja-x', 'saia-esgotada')$$);
select test.denied('anon NÃO lê os cliques', $$select * from public.product_interest_clicks$$);
select test.denied('anon NÃO lê a lista de espera', $$select * from public.product_interests$$);
select test.denied('anon NÃO anota gente na lista', $$select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Maria', '84999990000')$$);
select test.denied('anon NÃO vê o painel de demanda', $$select * from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$);
select test.reset();
update public.stores set catalog_enabled = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.denied('catálogo desligado NÃO aceita clique', $$select public.register_interest_click('loja-a', 'saia-esgotada')$$);
select test.reset();
update public.stores set catalog_enabled = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- lista de espera (vendedora)'
select test.login('00000000-0000-0000-0000-000000000002');  -- bruno, atendente
create temp table lid (name text, id uuid);
grant all on lid to public;
select test.ok('atendente anota quem chamou; telefone é normalizado (+55)', public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', ' Maria ', '(84) 99999-1111', 'M', 'Quer em preto') = 'created');
select test.ok('mesma pessoa, mesma peça, mesmo número em outro formato: não duplica, atualiza',
  public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Maria S.', '+55 84 99999-1111', 'P') = 'already');
select test.ok('registro guardado certo (nome, contato 5584999991111, tamanho atualizado, observação mantida)',
  (select customer_name = 'Maria S.' and contact = '5584999991111' and size = 'P' and note = 'Quer em preto' and status = 'waiting'
   from public.product_interests where product_id = 'eeeeeeee-0000-0000-0000-000000000a01'));
select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Joana', '84 98888-2222', 'M');
select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Paula', '84 97777-3333', 'M');
select public.add_interest('eeeeeeee-0000-0000-0000-000000000a03', 'Carol', '84 96666-4444', 'G');
select test.denied('nome vazio é recusado', $$select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', '  ', '84999990000')$$);
select test.denied('telefone inválido é recusado', $$select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'X', '123')$$);
select test.denied('NÃO anota em peça de outra loja', $$select public.add_interest('eeeeeeee-0000-0000-0000-000000000b01', 'X', '84999990000')$$);

\echo '--- painel de demanda'
select test.ok('demanda por peça: cliques (30 dias), aguardando, tamanhos',
  (select clicks_30d = 2 and waiting = 3 and contacted = 0 and converted = 0 and sizes = '{"P": 1, "M": 2}'::jsonb and stock_state = 'out'
   from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Saia Esgotada'));
select test.ok('peça com só cliques (sem ninguém na lista) também aparece, e a mais pedida vem primeiro',
  (select count(*) from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 2
  and (select name from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') limit 1) = 'Saia Esgotada');
select test.ok('a lista traz o endereço da peça (para montar o link do aviso)',
  (select bool_and(product_slug in ('saia-esgotada', 'blusa-reservada')) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')));
select test.ok('lista de pessoas: abertas, por peça, com paginação',
  (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 4
  and (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01')) = 3
  and (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'open', 2, 0)) = 2
  and (select total from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'open', 2, 0) limit 1) = 4);

\echo '--- avisar e concluir'
select public.set_interest_status((select id from public.product_interests where customer_name = 'Joana'), 'contacted');
select test.ok('marcar como avisada registra quem e quando', (select status = 'contacted' and handled_by = '00000000-0000-0000-0000-000000000002' and handled_at is not null
  from public.product_interests where customer_name = 'Joana'));
select public.set_interest_status((select id from public.product_interests where customer_name = 'Paula'), 'converted');
select public.set_interest_status((select id from public.product_interests where customer_name = 'Maria S.'), 'dismissed');
select test.ok('contagens por situação se atualizam', (select waiting = 0 and contacted = 1 and converted = 1
  from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') where name = 'Saia Esgotada'));
select test.ok('"em aberto" mostra aguardando + já avisadas; filtros por situação e nome de quem tratou',
  (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'open')) = 2
  and (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'converted')) = 1
  and (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'all')) = 4
  and (select handled_by_name from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'converted')) = 'Bruno');
select public.set_interest_status((select id from public.product_interests where customer_name = 'Maria S.'), 'waiting');
select test.ok('reabrir limpa quem tratou', (select handled_by is null and handled_at is null from public.product_interests where customer_name = 'Maria S.'));
select test.ok('depois de encerrada a pessoa pode pedir de novo (novo registro)',
  (select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Paula', '84 97777-3333', 'G')) = 'created');

\echo '--- apagar (privacidade)'
select test.affects('atendente NÃO apaga pessoas da lista', $$delete from public.product_interests where customer_name = 'Joana'$$, 0);
select test.login('00000000-0000-0000-0000-000000000003');  -- dani, gerente
select test.affects('gerente apaga a pessoa a pedido dela', $$delete from public.product_interests where customer_name = 'Joana'$$, 1);

\echo '--- isolamento'
select test.login('00000000-0000-0000-0000-000000000004');  -- carla (B)
select test.ok('outra loja não vê demanda, lista nem cliques da A',
  (select count(*) from public.store_interest_overview('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) = 0
  and (select count(*) from public.store_interests('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'all')) = 0
  and (select count(*) from public.product_interests) = 0 and (select count(*) from public.product_interest_clicks) = 0);
select test.denied('outra loja NÃO anota gente em peça da A', $$select public.add_interest('eeeeeeee-0000-0000-0000-000000000a01', 'Invasora', '84999990000')$$);
select test.denied('outra loja NÃO muda situação de pessoa da A', format($$select public.set_interest_status('%s', 'dismissed')$$, (select id from (select id from public.product_interests limit 1) q)));
select test.reset();
select test.login('00000000-0000-0000-0000-000000000001');
select test.denied('sem tabela direta: dono NÃO edita pessoa por UPDATE (só pela função)', $$update public.product_interests set status = 'converted'$$);
select test.denied('nem insere direto', $$insert into public.product_interests (store_id, product_id, customer_name, contact) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'x', '5584999990000')$$);

\echo '--- painel principal e tempo real'
select test.ok('painel: pessoas aguardando e cliques dos últimos 7 dias',
  (select (j ->> 'interests')::int = 3 and (j ->> 'interest_clicks')::int = 3 from (select public.store_dashboard('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') j) q));
select test.reset();
select test.ok('lista e cliques estão na publicação do Realtime',
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('product_interests', 'product_interest_clicks')) = 2);
delete from public.products where id = 'eeeeeeee-0000-0000-0000-000000000a01';
select test.ok('excluir a peça leva junto lista e cliques dela',
  (select count(*) from public.product_interests where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 0
  and (select count(*) from public.product_interest_clicks where product_id = 'eeeeeeee-0000-0000-0000-000000000a01') = 0);

\echo 'TESTES DE AVISE-ME OK'
rollback;
