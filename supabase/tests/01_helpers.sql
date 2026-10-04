-- Pequena biblioteca de asserções. Qualquer falha aborta o script (psql -v ON_ERROR_STOP=1).
create schema test;
grant usage on schema test to public;

create function test.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FALHOU: %', p_name; end if;
  raise notice 'ok   - %', p_name;
end $$;

-- Entra como usuário logado (papel authenticated) ou anônimo; sai com test.reset().
create function test.login(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function test.anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;

create function test.reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- O comando DEVE falhar (permissão, RLS, constraint...).
create function test.denied(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok   - % (bloqueado: %)', p_name, sqlerrm;
    return;
  end;
  raise exception 'FALHOU (era para ser bloqueado): %', p_name;
end $$;

-- O comando deve afetar exatamente N linhas (RLS filtra update/delete em silêncio).
create function test.affects(p_name text, p_sql text, p_expected int) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n <> p_expected then raise exception 'FALHOU: % (afetou %, esperado %)', p_name, n, p_expected; end if;
  raise notice 'ok   - % (% linha(s))', p_name, n;
end $$;

create function test.count_rows(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute 'select count(*) from (' || p_sql || ') q' into n; return n; end $$;
