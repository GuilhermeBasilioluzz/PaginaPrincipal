-- ETAPA 15 — análises com privacidade: só contadores, leitura restrita a dono e gerente, entrada validada.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),   -- dona A
  ('00000000-0000-0000-0000-000000000002', 'bruno@a.com'),   -- atendente A
  ('00000000-0000-0000-0000-000000000003', 'dani@a.com'),    -- gerente A
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');   -- dona B
insert into public.stores (id, slug, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B');
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'attendant'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');
insert into public.products (id, store_id, name, slug, price, status) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido', 'vestido', 100, 'available'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rascunho', 'rascunho', 100, 'unavailable'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Da B', 'da-b', 100, 'available');
update public.inventory set quantity = 5;
insert into public.collections (id, store_id, name, slug, kind, is_published) values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera', 'primavera', 'manual', true),
  ('dddddddd-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Oculta', 'oculta', 'manual', false);

\echo '--- registrar (visitante anônimo)'
select test.anon();
select public.track_event('loja-a', 'store_view', '', 'qr');
select public.track_event('loja-a', 'store_view', '', 'qr');
select public.track_event('loja-a', 'store_view', '', '');
select public.track_event('loja-a', 'collection_view', 'primavera', 'bio');
select public.track_event('loja-a', 'product_view', 'vestido', 'story');
select public.track_event('loja-a', 'product_view', 'vestido', 'story');
select public.track_event('loja-a', 'product_view', 'vestido', 'inventada');
select public.track_event('loja-a', 'whatsapp_click', 'vestido', 'story');
select public.track_event('loja-a', 'share_click', '', '');
select test.denied('tipo inválido', $$select public.track_event('loja-a', 'hack', '', '')$$);
select test.denied('loja inexistente', $$select public.track_event('nao-existe', 'store_view', '', '')$$);
select test.denied('peça em rascunho não conta (não está no catálogo)', $$select public.track_event('loja-a', 'product_view', 'rascunho', '')$$);
select test.denied('peça de outra loja', $$select public.track_event('loja-a', 'product_view', 'da-b', '')$$);
select test.denied('coleção não publicada', $$select public.track_event('loja-a', 'collection_view', 'oculta', '')$$);
select test.denied('coleção inexistente', $$select public.track_event('loja-a', 'collection_view', 'xx', '')$$);
select test.denied('visitante não lê a tabela', $$select * from public.analytics_daily$$);
select test.denied('visitante não lê o relatório', $$select public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30)$$);
select test.denied('visitante não escreve direto', $$insert into public.analytics_daily (store_id, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'store_view')$$);

\echo '--- catálogo desligado não conta'
select test.reset();
update public.stores set catalog_enabled = false where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select test.anon();
select test.denied('loja com catálogo desligado', $$select public.track_event('loja-b', 'store_view', '', '')$$);

\echo '--- relatório'
select test.login('00000000-0000-0000-0000-000000000003');  -- gerente
create temp table rep (j jsonb); grant all on rep to public;
insert into rep select public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30);
select test.ok('totais: 3 visitas à loja, 1 coleção, 3 peças, 1 contato, 1 compartilhamento',
  (select (j #>> '{totals,store_view}')::int = 3 and (j #>> '{totals,collection_view}')::int = 1 and (j #>> '{totals,product_view}')::int = 3
      and (j #>> '{totals,whatsapp_click}')::int = 1 and (j #>> '{totals,share_click}')::int = 1 from rep));
select test.ok('origens: story 3 (2 + a inventada vira outro: story 2, outro 1), qr 2, direto 1, bio 1',
  (select (select (e ->> 'views')::int from jsonb_array_elements(j -> 'sources') e where e ->> 'source' = 'story') = 2
      and (select (e ->> 'views')::int from jsonb_array_elements(j -> 'sources') e where e ->> 'source' = 'outro') = 1
      and (select (e ->> 'views')::int from jsonb_array_elements(j -> 'sources') e where e ->> 'source' = 'qr') = 2
      and (select (e ->> 'views')::int from jsonb_array_elements(j -> 'sources') e where e ->> 'source' = 'direto') = 1
      and (select (e ->> 'views')::int from jsonb_array_elements(j -> 'sources') e where e ->> 'source' = 'bio') = 1 from rep));
select test.ok('peça mais vista: Vestido com 3 visualizações e 1 contato',
  (select j #>> '{products,0,name}' = 'Vestido' and (j #>> '{products,0,views}')::int = 3 and (j #>> '{products,0,contacts}')::int = 1 from rep));
select test.ok('coleção Primavera com 1 visualização', (select j #>> '{collections,0,name}' = 'Primavera' and (j #>> '{collections,0,views}')::int = 1 from rep));
select test.ok('série diária tem 30 dias e soma as visualizações',
  (select jsonb_array_length(j -> 'daily') = 30 and (select sum((e ->> 'views')::int) from jsonb_array_elements(j -> 'daily') e) = 7 from rep));
select test.ok('período anterior vazio', (select (j #>> '{previous,store_view}')::int = 0 from rep));
select test.ok('dias limitados a 90', (select (public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5000) ->> 'days')::int = 90));
select test.ok('o relatório só tem contadores e nomes de peças/coleções (sem campos pessoais)',
  (select (select array_agg(k order by k) from jsonb_object_keys(j) k) = array['collections', 'daily', 'days', 'previous', 'products', 'sources', 'totals']
      and (select array_agg(k order by k) from jsonb_object_keys(j -> 'products' -> 0) k) = array['avise', 'contacts', 'id', 'name', 'slug', 'status', 'views'] from rep));

\echo '--- período anterior'
select test.reset();
insert into public.analytics_daily (store_id, day, kind, source, hits)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'America/Sao_Paulo')::date - 40, 'store_view', 'qr', 9);
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('40 dias atrás cai no período anterior de 30 dias', (public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30) #>> '{previous,store_view}')::int = 9);
select test.ok('e não no atual', (public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30) #>> '{totals,store_view}')::int = 3);

\echo '--- quem NÃO pode ver'
select test.login('00000000-0000-0000-0000-000000000002');  -- atendente
select test.denied('atendente não vê o relatório', $$select public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30)$$);
select test.ok('atendente não lê a tabela', (select count(*) from public.analytics_daily) = 0);
select test.login('00000000-0000-0000-0000-000000000004');  -- dona de outra loja
select test.denied('outra loja não vê o relatório da A', $$select public.store_analytics('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30)$$);
select test.ok('outra loja não lê as linhas da A', (select count(*) from public.analytics_daily where store_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0);
select test.ok('dono lê as próprias linhas', (select count(*) from public.analytics_daily) = 0);
select test.login('00000000-0000-0000-0000-000000000001');
select test.ok('dona A lê as linhas', (select count(*) from public.analytics_daily) > 0);
select test.denied('ninguém escreve direto', $$update public.analytics_daily set hits = 999999$$);

\echo 'TESTES DE ANÁLISES OK'
rollback;
