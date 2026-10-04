-- HYPERION SYSTEM — ETAPA 1: buckets e políticas de arquivos.
-- Caminho obrigatório: stores/{store_id}/{products|branding|stories}/arquivo
--   catalog (público): fotos de produtos e identidade da loja — servidas por URL pública.
--   stories (privado): imagens importadas de Stories — só a equipe da loja lê.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog', 'catalog', true,  10485760, array['image/jpeg','image/png','image/webp','image/avif','video/mp4']),
  ('stories', 'stories', false, 20971520, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

-- Quem pode mexer num arquivo: a loja vem do 2º segmento do caminho; a pasta (3º) define o papel.
create function private.can_write_object(p_name text, p_folders text[], p_roles public.store_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = 'stores'
     and (storage.foldername(p_name))[3] = any (p_folders)
     and private.try_uuid((storage.foldername(p_name))[2]) is not null
     and private.can_write(private.try_uuid((storage.foldername(p_name))[2]), p_roles);
$$;

create function private.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = 'stores'
     and private.try_uuid((storage.foldername(p_name))[2]) is not null
     and private.is_member(private.try_uuid((storage.foldername(p_name))[2]));
$$;

-- catalog: produtos = toda a equipe; branding (logo, banner) = só o dono
create policy catalog_team_read on storage.objects for select to authenticated
  using (bucket_id = 'catalog' and private.can_read_object(name));
create policy catalog_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));
create policy catalog_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])))
  with check (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));
create policy catalog_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog' and (
    private.can_write_object(name, array['products'], array['owner','manager','attendant']::public.store_role[])
    or private.can_write_object(name, array['branding'], array['owner']::public.store_role[])));

-- stories: toda a equipe lê e escreve na pasta da própria loja
create policy stories_team_read on storage.objects for select to authenticated
  using (bucket_id = 'stories' and private.can_read_object(name));
create policy stories_team_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));
create policy stories_team_update on storage.objects for update to authenticated
  using (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]))
  with check (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));
create policy stories_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stories'
    and private.can_write_object(name, array['stories'], array['owner','manager','attendant']::public.store_role[]));
