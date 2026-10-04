-- HYPERION SYSTEM — ETAPA 2: endereços reservados para as rotas do app (mantenha igual a src/lib/slug.ts).
alter table public.stores drop constraint stores_slug_check;
alter table public.stores add constraint stores_slug_check
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
         and slug <> all (array['app','admin','api','login','cadastro','entrar','loja','colecao','produto',
                                'static','assets','_next','suporte','planos','auth','recuperar-senha',
                                'redefinir-senha','termos','privacidade','perfil','robots','sitemap']));
