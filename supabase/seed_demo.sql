-- HYPERION SYSTEM — loja de demonstração para testar rápido (sem fotos: as peças aparecem com a inicial do nome).
-- COMO USAR: 1) crie uma conta no site; 2) troque o e-mail abaixo pelo da sua conta; 3) cole no SQL Editor e rode.
-- Cria a loja "Boutique Demo" (endereço /demo) com você como DONO(A), categorias, coleções, peças em várias situações
-- (disponível, poucas unidades, esgotada, reservada, com promoção) e uma reserva. Pode rodar de novo: não duplica.
-- Para apagar depois:  delete from public.stores where slug = 'demo';

do $$
declare
  v_email text := 'COLOQUE-SEU-EMAIL@AQUI.COM';
  v_user uuid; v_store uuid;
  c_vest uuid; c_midi uuid; c_blus uuid; c_bols uuid; col_prim uuid;
  p_midi uuid; p_blusa uuid; p_calca uuid; p_saia uuid; p_bolsa uuid; p_vestido uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(btrim(v_email));
  if v_user is null then
    raise exception 'Não achei uma conta com o e-mail "%". Crie a conta no site primeiro e troque o e-mail no topo deste arquivo.', v_email;
  end if;
  if exists (select 1 from public.stores where slug = 'demo') then
    raise notice 'A loja de demonstração (/demo) já existe. Nada foi alterado.';
    return;
  end if;

  insert into public.stores (slug, name, tagline, description, whatsapp, instagram_handle, address, opening_hours, created_by)
  values ('demo', 'Boutique Demo', 'Moda feminina em Natal', 'Catálogo de demonstração do Hyperion System: peças selecionadas com carinho.',
          '5584999990000', 'boutiquedemo', 'Av. Roberto Freire, 1000 — Natal/RN', 'Seg a sáb, 9h às 18h', v_user)
  returning id into v_store;
  insert into public.store_members (store_id, user_id, role) values (v_store, v_user, 'owner');

  insert into public.categories (store_id, name, slug) values (v_store, 'Vestidos', 'vestidos') returning id into c_vest;
  insert into public.categories (store_id, name, slug, parent_id) values (v_store, 'Midi', 'midi', c_vest) returning id into c_midi;
  insert into public.categories (store_id, name, slug) values (v_store, 'Blusas', 'blusas') returning id into c_blus;
  insert into public.categories (store_id, name, slug) values (v_store, 'Acessórios', 'acessorios') returning id into c_bols;

  insert into public.collections (store_id, name, slug, description, kind, new_arrivals_days, position)
  values (v_store, 'Novidades', 'novidades', 'As peças que acabaram de chegar.', 'new_arrivals', 7, -1);
  insert into public.collections (store_id, name, slug, description) values (v_store, 'Primavera', 'primavera', 'Cores leves e tecidos fluidos.') returning id into col_prim;

  insert into public.products (store_id, name, slug, description, price, promo_price, status, color, sizes, category_id, is_featured, published_at, created_by)
  values (v_store, 'Vestido Midi Terracota', 'vestido-midi-terracota', 'Midi fluido em viscose, ótimo para o dia a dia e para festas.', 189.90, 149.90, 'available', 'Terracota', array['P','M','G'], c_midi, true, now() - interval '1 day', v_user)
  returning id into p_midi;
  insert into public.products (store_id, name, slug, description, price, status, color, sizes, category_id, published_at, created_by)
  values (v_store, 'Blusa de Linho Branca', 'blusa-de-linho-branca', 'Linho leve, caimento solto.', 129.90, 'available', 'Branco', array['P','M'], c_blus, now() - interval '2 days', v_user)
  returning id into p_blusa;
  insert into public.products (store_id, name, slug, description, price, status, color, sizes, category_id, published_at, created_by)
  values (v_store, 'Calça Jeans Reta', 'calca-jeans-reta', 'Jeans clássico de cintura alta.', 289.00, 'available', 'Azul', array['38','40','42'], null, now() - interval '12 days', v_user)
  returning id into p_calca;
  insert into public.products (store_id, name, slug, description, price, status, color, sizes, category_id, published_at, created_by)
  values (v_store, 'Saia Plissada Preta', 'saia-plissada-preta', 'Saia plissada midi, tecido leve. Esgotada: teste o "Avise-me quando chegar".', 159.00, 'sold', 'Preto', array['P','M'], null, now() - interval '5 days', v_user)
  returning id into p_saia;
  insert into public.products (store_id, name, slug, description, price, status, color, sizes, category_id, published_at, created_by)
  values (v_store, 'Bolsa Nude', 'bolsa-nude', 'Bolsa estruturada, alça removível.', 79.90, 'available', 'Nude', array['Único'], c_bols, now() - interval '3 days', v_user)
  returning id into p_bolsa;
  insert into public.products (store_id, name, slug, description, price, status, color, sizes, category_id, published_at, created_by)
  values (v_store, 'Vestido Floral Verde', 'vestido-floral-verde', 'Estampa floral, decote em V.', 219.00, 'available', 'Verde', array['M'], c_vest, now() - interval '4 days', v_user)
  returning id into p_vestido;

  -- estoque: normal, poucas unidades, esgotada, reservada
  update public.inventory set quantity = 8 where product_id = p_midi;
  update public.inventory set quantity = 2 where product_id = p_blusa;
  update public.inventory set quantity = 6 where product_id = p_calca;
  update public.inventory set quantity = 0 where product_id = p_saia;
  update public.inventory set quantity = 5 where product_id = p_bolsa;
  update public.inventory set quantity = 1 where product_id = p_vestido;

  insert into public.collection_products (store_id, collection_id, product_id)
  values (v_store, col_prim, p_midi), (v_store, col_prim, p_vestido), (v_store, col_prim, p_blusa);

  -- uma reserva ativa (a peça fica "Reservado" no catálogo)
  insert into public.reservations (store_id, product_id, quantity, customer_name, customer_contact, status, reserved_by)
  values (v_store, p_vestido, 1, 'Maria (exemplo)', '84999991111', 'confirmed', v_user);
  update public.products set status = 'reserved' where id = p_vestido;

  raise notice 'Pronto! Abra o catálogo em  /demo  e o painel em  /app/demo';
end $$;
