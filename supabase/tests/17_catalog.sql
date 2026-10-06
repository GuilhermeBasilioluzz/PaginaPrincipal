-- ETAPA 8 — catálogo público: o que a cliente (anônima) enxerga, filtros, busca e vazamentos.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@a.com'),
  ('00000000-0000-0000-0000-000000000004', 'carla@b.com');
insert into public.stores (id, slug, name, tagline, whatsapp, instagram_handle) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'loja-a', 'Loja A', 'Moda feminina', '5584999990000', 'loja_a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'loja-b', 'Loja B', null, null, null);
insert into public.store_members (store_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000004', 'owner');

insert into public.categories (id, store_id, name, slug, parent_id) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestidos', 'vestidos', null),
  ('cccccccc-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Midi', 'midi', 'cccccccc-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-00000000000d', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Calças', 'calcas', null),
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisas', 'camisas', null);

-- Loja A: 6 produtos públicos + 1 arquivado + 1 indisponível; B: 1 produto
insert into public.products (id, store_id, name, slug, description, price, promo_price, status, color, sizes, sku, category_id, published_at, is_featured) values
  ('eeeeeeee-0000-0000-0000-000000000a01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Midi Floral', 'vestido-midi-floral', 'Vestido fluido para festa', 189.90, 149.90, 'available', 'Verde', array['P','M','G'], 'SEGREDO-1', 'cccccccc-0000-0000-0000-00000000000c', now() - interval '1 day', true),
  ('eeeeeeee-0000-0000-0000-000000000a02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Vestido Preto Curto', 'vestido-preto-curto', null, 120, null, 'available', 'Preto', array['P','M'], null, 'cccccccc-0000-0000-0000-00000000000a', now() - interval '20 days', false),
  ('eeeeeeee-0000-0000-0000-000000000a03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Calça Jeans Reta', 'calca-jeans-reta', 'Jeans clássico', 250, null, 'available', 'Azul', array['38','40','42'], null, 'cccccccc-0000-0000-0000-00000000000d', now() - interval '3 days', false),
  ('eeeeeeee-0000-0000-0000-000000000a04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Blusa Branca Vendida', 'blusa-branca', null, 80, null, 'sold', 'Branco', array['M'], null, null, now() - interval '5 days', false),
  ('eeeeeeee-0000-0000-0000-000000000a05', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Saia Reservada', 'saia-reservada', null, 90, null, 'reserved', 'Verde', array['P'], null, null, now() - interval '2 days', false),
  ('eeeeeeee-0000-0000-0000-000000000a06', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bolsa Poucas', 'bolsa-poucas', null, 60, null, 'available', 'Nude', array['Único'], null, null, now() - interval '4 days', false),
  ('eeeeeeee-0000-0000-0000-000000000a07', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Peça Arquivada', 'arquivada', null, 10, null, 'archived', null, '{}', null, null, now(), false),
  ('eeeeeeee-0000-0000-0000-000000000a08', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Peça Indisponível', 'indisponivel', null, 10, null, 'unavailable', null, '{}', null, null, now(), false),
  ('eeeeeeee-0000-0000-0000-000000000b01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Camisa da B', 'camisa-b', null, 70, null, 'available', 'Azul', array['M'], null, 'cccccccc-0000-0000-0000-00000000000b', now(), false);
-- estoque: a01=10 (ok), a02=10, a03=10, a04 vendido=0, a05 reservado=3 (status manual), a06=2 (pouco)
update public.inventory set quantity = 10 where product_id in ('eeeeeeee-0000-0000-0000-000000000a01','eeeeeeee-0000-0000-0000-000000000a02','eeeeeeee-0000-0000-0000-000000000a03','eeeeeeee-0000-0000-0000-000000000b01');
update public.inventory set quantity = 3 where product_id = 'eeeeeeee-0000-0000-0000-000000000a05';
update public.inventory set quantity = 2 where product_id = 'eeeeeeee-0000-0000-0000-000000000a06';

insert into public.product_images (store_id, product_id, path, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/capa.webp', 0),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-0000-0000-0000-000000000a01', 'stores/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/products/x/costas.webp', 1);

insert into public.collections (id, store_id, name, slug, kind, new_arrivals_days, is_published) values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Primavera', 'primavera', 'manual', null, true),
  ('dddddddd-0000-0000-0000-00000000000e', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Novidades', 'novidades', 'new_arrivals', 7, true),
  ('dddddddd-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rascunho', 'rascunho', 'manual', null, false);
insert into public.collection_products (store_id, collection_id, product_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a01'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-000000000a02'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-000000000a03');

\echo '--- a loja'
select test.anon();
select test.ok('anon recebe os dados públicos da loja',
  (select j -> 'store' ->> 'name' = 'Loja A' and j -> 'store' ->> 'whatsapp' = '5584999990000' and j -> 'store' ->> 'instagram_handle' = 'loja_a'
   from (select public.catalog_store('loja-a') j) q));
select test.ok('o slug aceita maiúsculas e espaços nas pontas', (select public.catalog_store('  LOJA-A ') is not null));
select test.ok('loja inexistente devolve null', (select public.catalog_store('nao-existe') is null));
select test.ok('a loja não vaza campos internos (created_by, is_active, catalog_enabled...)',
  (select not (j -> 'store' ?| array['created_by','is_active','catalog_enabled','hide_sold_out','created_at']) from (select public.catalog_store('loja-a') j) q));
select test.ok('total conta só o que o público vê (6 de 8: sem arquivado e indisponível)', (select (public.catalog_store('loja-a') ->> 'total')::int = 6));
select test.ok('categorias com contagem (subcategoria entra na principal) e nada da outra loja',
  (select (select (e ->> 'count')::int from jsonb_array_elements(j -> 'categories') e where e ->> 'slug' = 'vestidos') = 2
      and (select (e ->> 'count')::int from jsonb_array_elements(j -> 'categories') e where e ->> 'slug' = 'midi') = 1
      and (select (e ->> 'count')::int from jsonb_array_elements(j -> 'categories') e where e ->> 'slug' = 'calcas') = 1
      and jsonb_array_length(j -> 'categories') = 3
   from (select public.catalog_store('loja-a') j) q));
select test.ok('coleções: só as publicadas; Novidades automática conta os últimos 7 dias (a01, a03, a05, a06, a04, = 5)',
  (select jsonb_array_length(j -> 'collections') = 2
      and (select (e ->> 'count')::int from jsonb_array_elements(j -> 'collections') e where e ->> 'slug' = 'primavera') = 2
      and (select (e ->> 'count')::int from jsonb_array_elements(j -> 'collections') e where e ->> 'slug' = 'novidades') = 5
      and (select (e ->> 'automatic')::boolean from jsonb_array_elements(j -> 'collections') e where e ->> 'slug' = 'novidades')
   from (select public.catalog_store('loja-a') j) q));
select test.ok('filtros disponíveis: cores, tamanhos e faixa de preço (menor preço já com promoção)',
  (select j -> 'colors' @> '["Verde","Preto","Azul"]'::jsonb and j -> 'sizes' @> '["P","M","G","38","Único"]'::jsonb
      and (j ->> 'price_min')::numeric = 60 and (j ->> 'price_max')::numeric = 250
   from (select public.catalog_store('loja-a') j) q));

\echo '--- visibilidade'
select test.ok('lista só traz produtos públicos da própria loja (6)', (select count(*) from public.catalog_products('loja-a')) = 6
  and (select total from public.catalog_products('loja-a') limit 1) = 6);
select test.ok('NUNCA aparecem arquivado, indisponível nem produto de outra loja',
  (select count(*) from public.catalog_products('loja-a') where name in ('Peça Arquivada', 'Peça Indisponível', 'Camisa da B')) = 0);
select test.ok('a outra loja vê só os dela', (select count(*) from public.catalog_products('loja-b')) = 1 and (select name from public.catalog_products('loja-b')) = 'Camisa da B');
select test.ok('slug inexistente devolve lista vazia', (select count(*) from public.catalog_products('nao-existe')) = 0);
select test.ok('a lista só devolve colunas seguras (sem sku, estoque, autor)',
  (select not (to_jsonb(t) ?| array['sku','quantity','created_by','updated_by','status','low_stock_threshold','reserved']) from public.catalog_products('loja-a') t limit 1));
select test.ok('rótulos de estoque: disponível, reservado, esgotado, poucas unidades (sem expor números)',
  (select stock_label from public.catalog_products('loja-a') where slug = 'vestido-midi-floral') = 'available'
  and (select stock_label from public.catalog_products('loja-a') where slug = 'saia-reservada') = 'reserved'
  and (select stock_label from public.catalog_products('loja-a') where slug = 'blusa-branca') = 'sold_out'
  and (select stock_label from public.catalog_products('loja-a') where slug = 'bolsa-poucas') = 'low');
select test.ok('esgotados vão para o fim da lista',
  (select slug from (select slug, row_number() over () rn from public.catalog_products('loja-a')) q where rn = 6) = 'blusa-branca');
select test.ok('a capa é a primeira foto por posição', (select cover_path from public.catalog_products('loja-a') where slug = 'vestido-midi-floral') like '%capa.webp');
select test.ok('produto sem foto vem com capa nula', (select cover_path from public.catalog_products('loja-a') where slug = 'calca-jeans-reta') is null);

\echo '--- filtros'
select test.ok('categoria principal inclui as subcategorias', (select count(*) from public.catalog_products('loja-a', p_category => 'vestidos')) = 2);
select test.ok('subcategoria traz só a dela', (select count(*) from public.catalog_products('loja-a', p_category => 'midi')) = 1);
select test.ok('categoria de outra loja não funciona aqui', (select count(*) from public.catalog_products('loja-a', p_category => 'camisas')) = 0);
select test.ok('coleção manual', (select count(*) from public.catalog_products('loja-a', p_collection => 'primavera')) = 2);
select test.ok('coleção automática (Novidades)', (select count(*) from public.catalog_products('loja-a', p_collection => 'novidades')) = 5);
select test.ok('coleção em rascunho não existe para o público', (select count(*) from public.catalog_products('loja-a', p_collection => 'rascunho')) = 0);
select test.ok('cor (sem diferenciar maiúsculas)', (select count(*) from public.catalog_products('loja-a', p_color => 'VERDE')) = 2);
select test.ok('tamanho', (select count(*) from public.catalog_products('loja-a', p_size => 'm')) = 3);
select test.ok('faixa de preço usa o preço promocional (149,90 entra em ≤ 150)', (select count(*) from public.catalog_products('loja-a', p_max => 150)) = 5
  and (select count(*) from public.catalog_products('loja-a', p_min => 200)) = 1);
select test.ok('"só o que tem em estoque" tira esgotado e reservado', (select count(*) from public.catalog_products('loja-a', p_in_stock => true)) = 4);
select test.ok('filtros se combinam', (select count(*) from public.catalog_products('loja-a', p_category => 'vestidos', p_color => 'Verde', p_size => 'G')) = 1);

\echo '--- busca'
select test.ok('busca sem acento acha com acento ("calca" → Calça)', (select count(*) from public.catalog_products('loja-a', p_q => 'calca')) = 1);
select test.ok('busca com acento e maiúsculas', (select count(*) from public.catalog_products('loja-a', p_q => 'CALÇA JEANS')) = 1);
select test.ok('várias palavras: todas precisam aparecer ("vestido preto")', (select count(*) from public.catalog_products('loja-a', p_q => 'vestido preto')) = 1
  and (select slug from public.catalog_products('loja-a', p_q => 'vestido preto')) = 'vestido-preto-curto');
select test.ok('acha pela cor, pela descrição e pelo nome da categoria',
  (select count(*) from public.catalog_products('loja-a', p_q => 'nude')) = 1
  and (select count(*) from public.catalog_products('loja-a', p_q => 'festa')) = 1
  and (select count(*) from public.catalog_products('loja-a', p_q => 'midi')) = 1);
select test.ok('palavras de ligação são ignoradas ("roupa para festa" → festa)', (select count(*) from public.catalog_products('loja-a', p_q => 'roupa para festa')) = 1);
select test.ok('NÃO acha pelo SKU (código interno é privado)', (select count(*) from public.catalog_products('loja-a', p_q => 'segredo')) = 0);
select test.ok('curingas e aspas na busca são tratados como texto',
  (select count(*) from public.catalog_products('loja-a', p_q => '%%')) = 0     -- curinga é texto literal, não "tudo"
  and (select count(*) from public.catalog_products('loja-a', p_q => '__')) = 0
  and (select count(*) from public.catalog_products('loja-a', p_q => '%')) = 6  -- 1 caractere é ignorado: sem termos = tudo
  and (select count(*) from public.catalog_products('loja-a', p_q => '_')) = 6
  and (select count(*) from public.catalog_products('loja-a', p_q => 'x'' or ''1''=''1')) = 0
  and (select count(*) from public.catalog_products('loja-a', p_q => '\')) = 6);
select test.ok('texto enorme não quebra', (select count(*) from public.catalog_products('loja-a', p_q => repeat('abc ', 5000))) = 0);

\echo '--- ordem e páginas'
select test.ok('mais novos primeiro (esgotados no fim)', (select slug from public.catalog_products('loja-a', p_sort => 'new') limit 1) = 'vestido-midi-floral');
select test.ok('menor preço', (select slug from public.catalog_products('loja-a', p_sort => 'price_asc') limit 1) = 'bolsa-poucas');
select test.ok('maior preço', (select slug from public.catalog_products('loja-a', p_sort => 'price_desc') limit 1) = 'calca-jeans-reta');
select test.ok('nome', (select slug from public.catalog_products('loja-a', p_sort => 'name') limit 1) = 'bolsa-poucas');
select test.ok('paginação: limite, deslocamento e total', (select count(*) from public.catalog_products('loja-a', p_limit => 4)) = 4
  and (select count(*) from public.catalog_products('loja-a', p_limit => 4, p_offset => 4)) = 2
  and (select total from public.catalog_products('loja-a', p_limit => 4, p_offset => 4) limit 1) = 6);
select test.ok('limite abusivo é reduzido (máx. 48) e negativos são corrigidos',
  (select count(*) from public.catalog_products('loja-a', p_limit => 100000)) = 6 and (select count(*) from public.catalog_products('loja-a', p_limit => -5, p_offset => -9)) = 1);

\echo '--- configurações da loja mudam o que o público vê'
select test.reset();
update public.stores set hide_sold_out = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.ok('"ocultar esgotados" tira o vendido da lista e do total', (select count(*) from public.catalog_products('loja-a')) = 5
  and (select count(*) from public.catalog_products('loja-a') where slug = 'blusa-branca') = 0
  and (select (public.catalog_store('loja-a') ->> 'total')::int) = 5);
select test.reset();
update public.stores set hide_sold_out = false, catalog_enabled = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.ok('catálogo desligado: a loja some por completo', (select public.catalog_store('loja-a') is null) and (select count(*) from public.catalog_products('loja-a')) = 0);
select test.reset();
update public.stores set catalog_enabled = true, is_active = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select test.anon();
select test.ok('loja desativada pelo admin: some por completo', (select public.catalog_store('loja-a') is null) and (select count(*) from public.catalog_products('loja-a')) = 0);
select test.reset();
update public.stores set is_active = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- reserva real e esgotamento refletem no catálogo'
select test.login('00000000-0000-0000-0000-000000000001');
select public.create_reservation('eeeeeeee-0000-0000-0000-000000000a03', 10, 'Cliente');
select test.anon();
select test.ok('tudo reservado aparece como "reservado" para o público', (select stock_label from public.catalog_products('loja-a') where slug = 'calca-jeans-reta') = 'reserved');
select test.ok('o público nunca vê quem reservou nem quantidades', (select not (to_jsonb(t) ?| array['customer_name','reserved','quantity']) from public.catalog_products('loja-a') t limit 1));

\echo '--- permissões'
select test.login('00000000-0000-0000-0000-000000000004');
select test.ok('usuária logada de outra loja vê o catálogo público como qualquer cliente', (select count(*) from public.catalog_products('loja-a')) = 6);
select test.anon();
select test.denied('as funções internas não são chamáveis pelo navegador', $$select private.public_store('loja-a')$$);
select test.denied('anon continua sem ler produtos direto', $$select sku from public.products$$);

\echo 'TESTES DO CATÁLOGO PÚBLICO OK'
rollback;
