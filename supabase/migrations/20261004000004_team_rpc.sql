-- HYPERION SYSTEM — ETAPA 2: gestão de equipe.
-- O navegador nunca lê auth.users. Estas funções expõem só o necessário:
--   store_team()          lista a equipe (e-mail visível apenas para o dono)
--   add_member_by_email() o dono adiciona alguém que JÁ tem conta (convites por e-mail: ETAPA 10)

create function public.store_team(p_store uuid)
returns table (user_id uuid, full_name text, email text, role public.store_role, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'faça login' using errcode = '28000';
  end if;
  if not (private.is_member(p_store) or private.is_super_admin()) then
    raise exception 'sem acesso a esta loja' using errcode = '42501';
  end if;
  v_owner := exists (select 1 from public.store_members m
                     where m.store_id = p_store and m.user_id = auth.uid() and m.role = 'owner');
  return query
    select m.user_id, p.full_name,
           case when v_owner then u.email else null end,
           m.role, m.created_at
    from public.store_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.store_id = p_store
    order by m.role, p.full_name, m.created_at;
end $$;

create function public.add_member_by_email(p_store uuid, p_email text, p_role public.store_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  -- a checagem de permissão vem ANTES da busca, para não revelar quais e-mails têm conta
  if not private.can_write(p_store, array['owner']::public.store_role[]) then
    raise exception 'apenas o dono da loja pode adicionar membros' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002',
      hint = 'A pessoa precisa criar uma conta no Hyperion primeiro.';
  end if;
  if exists (select 1 from public.store_members where store_id = p_store and user_id = v_user) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  insert into public.store_members (store_id, user_id, role) values (p_store, v_user, p_role);
end $$;

revoke execute on function public.store_team(uuid)                                from public, anon;
revoke execute on function public.add_member_by_email(uuid, text, public.store_role) from public, anon;
grant  execute on function public.store_team(uuid)                                to authenticated;
grant  execute on function public.add_member_by_email(uuid, text, public.store_role) to authenticated;
