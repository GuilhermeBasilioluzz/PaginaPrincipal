-- HYPERION SYSTEM — ETAPA 11 (pista A): caixa "Stories recebidos", entrada MANUAL.
--
-- A equipe envia a imagem/print de um Story (ou várias) e transforma em produto. Nada depende da Meta.
-- A coluna `source` já aceita 'instagram' para quando a conexão oficial (pista B) existir: ela só vai INSERIR aqui,
-- o resto do fluxo (revisar → converter → publicar) não muda.
-- Regras: arquivos ficam no bucket PRIVADO `stories`; converter cria o produto como RASCUNHO ("indisponível"):
-- só vai para o catálogo quando uma pessoa publicar (sem automação que publique sozinha).

create type public.story_status as enum ('pending', 'converted', 'discarded');

create table public.story_items (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  path       text not null check (path like 'stores/' || store_id::text || '/stories/%'),
  caption    text check (char_length(caption) <= 500),
  source     text not null default 'manual' check (source in ('manual', 'instagram')),
  status     public.story_status not null default 'pending',
  product_id uuid,
  posted_at  timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, id),
  foreign key (store_id, product_id) references public.products (store_id, id) on delete set null (product_id)
);
create index story_items_store_idx on public.story_items (store_id, status, posted_at desc);

create function private.stamp_story() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end $$;
create trigger story_items_stamp before insert or update on public.story_items for each row execute function private.stamp_story();
create trigger story_items_store_fixed before update on public.story_items for each row execute function private.forbid_store_change();

alter table public.story_items enable row level security;
revoke all on public.story_items from anon, authenticated;
grant select on public.story_items to authenticated;
grant insert (store_id, path, caption, posted_at), update (caption, status, posted_at), delete on public.story_items to authenticated;

create policy stories_read   on public.story_items for select to authenticated using (private.is_member(store_id) or private.is_super_admin());
create policy stories_insert on public.story_items for insert to authenticated
  with check (private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
-- "convertido" só nasce por convert_story (que cria o produto): ninguém marca ou edita isso na mão
create policy stories_update on public.story_items for update to authenticated
  using (status <> 'converted' and private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]))
  with check (status <> 'converted' and private.can_write(store_id, array['owner','manager','attendant']::public.store_role[]));
create policy stories_delete on public.story_items for delete to authenticated
  using (private.can_write(store_id, array['owner','manager']::public.store_role[]));

-- Converte um Story pendente em produto RASCUNHO. p = mesmos campos de save_product (name, price, quantity, sizes…).
-- O status é sempre "indisponível": publicar é uma ação humana separada, na tela do produto.
create function public.convert_story(p_story uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.story_items; v_product uuid;
begin
  select * into s from public.story_items where id = p_story for update;
  -- mesma regra de quem cadastra produto; para quem não é da loja o Story "não existe"
  if not found or not private.can_write(s.store_id, array['owner','manager','attendant']::public.store_role[]) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if s.status <> 'pending' then raise exception 'story_not_pending' using errcode = '22023'; end if;
  v_product := public.save_product(s.store_id, null,
    p || jsonb_build_object('status', 'unavailable', 'source', 'instagram'));
  update public.story_items set status = 'converted', product_id = v_product where id = p_story;
  return v_product;
end $$;

-- histórico: recebido / transformado em produto / descartado (sem guardar legenda no log)
create function private.trg_log_story() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.store_id, 'story.received', 'story', new.id, 'Story');
  elsif new.status is distinct from old.status then
    perform private.log_activity(new.store_id, 'story.' || new.status::text, 'story', new.id, 'Story',
                                 jsonb_build_object('product_id', new.product_id));
  end if;
  return new;
end $$;
create trigger story_items_log after insert or update on public.story_items for each row execute function private.trg_log_story();

-- contagem de pendentes no painel é feita pelo app (consulta simples); a função abaixo devolve a lista com o autor
create function public.store_stories(p_store uuid, p_status public.story_status default 'pending', p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, path text, caption text, status public.story_status, product_id uuid, product_name text, posted_at timestamptz,
               created_at timestamptz, author text, total bigint)
language sql stable set search_path = '' as $$
  select s.id, s.path, s.caption, s.status, s.product_id, p.name, s.posted_at, s.created_at, pr.full_name, count(*) over ()
  from public.story_items s
  left join public.products p on p.id = s.product_id
  left join public.profiles pr on pr.id = s.created_by
  where s.store_id = p_store and s.status = p_status
  order by s.posted_at desc, s.id
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

revoke execute on function public.convert_story(uuid, jsonb) from public, anon;
revoke execute on function public.store_stories(uuid, public.story_status, integer, integer) from public, anon;
grant  execute on function public.convert_story(uuid, jsonb) to authenticated;
grant  execute on function public.store_stories(uuid, public.story_status, integer, integer) to authenticated;
