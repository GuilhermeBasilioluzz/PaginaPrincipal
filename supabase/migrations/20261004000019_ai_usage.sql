-- HYPERION SYSTEM — ETAPA 13: sugestões de IA. Só o CONTROLE DE USO fica no banco (a chave da IA nunca entra aqui).
--
-- A IA apenas SUGERE (nome, descrição, cor, categoria, coleção, público, estilo). Preço, estoque e situação nunca passam
-- por ela, e nada vai para o catálogo sem uma pessoa revisar e publicar. Cada chamada custa dinheiro: por isso há um
-- limite diário POR LOJA, contado antes de chamar a IA e imposto aqui, não no navegador.

create table public.ai_usage (
  store_id uuid not null references public.stores (id) on delete cascade,
  day      date not null default (now() at time zone 'America/Sao_Paulo')::date,
  calls    integer not null default 0 check (calls >= 0),
  primary key (store_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
create policy ai_usage_read on public.ai_usage for select to authenticated using (private.is_member(store_id) or private.is_super_admin());

-- Reserva UMA chamada de IA para a loja (quem pode cadastrar produtos). Devolve quantas ainda restam hoje.
-- Estourou o limite → erro 'ai_limit'. O limite máximo aceito é 200 para ninguém burlar passando um número alto.
create function public.ai_register_call(p_store uuid, p_limit integer default 40) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 200); v_calls integer;
begin
  if not private.can_write(p_store, array['owner','manager','attendant']::public.store_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.ai_usage (store_id, day, calls) values (p_store, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (store_id, day) do update set calls = public.ai_usage.calls + 1
    where public.ai_usage.calls < v_limit
  returning calls into v_calls;
  if v_calls is null then raise exception 'ai_limit' using errcode = '53400'; end if;
  return v_limit - v_calls;
end $$;

-- devolve a reserva quando a chamada nem chegou a ser feita (falha antes da IA, p.ex. imagem ilegível)
create function public.ai_refund_call(p_store uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_write(p_store, array['owner','manager','attendant']::public.store_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.ai_usage set calls = greatest(calls - 1, 0)
   where store_id = p_store and day = (now() at time zone 'America/Sao_Paulo')::date;
end $$;

revoke execute on function public.ai_register_call(uuid, integer) from public, anon;
revoke execute on function public.ai_refund_call(uuid)            from public, anon;
grant  execute on function public.ai_register_call(uuid, integer) to authenticated;
grant  execute on function public.ai_refund_call(uuid)            to authenticated;
