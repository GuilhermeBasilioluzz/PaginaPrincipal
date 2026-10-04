# Arquitetura — Hyperion System

## Decisões (ETAPA 1)
- **Tenant = loja.** Toda tabela de negócio tem `store_id`; chaves estrangeiras compostas `(store_id, id)`
  impedem que um registro de uma loja aponte para outro de outra loja; `store_id` é imutável (gatilho).
- **Papéis por loja** (`store_members.role`): `owner` (tudo), `manager` (produtos, estoque, categorias,
  coleções), `attendant` (cria/edita produtos, fotos, estoque e organiza peças em coleções; não apaga, arquiva).
  **Super Admin** (`profiles.is_super_admin`) só lê tudo e ativa/desativa lojas por `admin_set_store_active()`.
- **Duas camadas de segurança:** GRANT por coluna + RLS por linha. O catálogo público (`anon`) só lê colunas
  seguras (sem SKU, autor, estoque) de lojas ativas com catálogo ligado. **O catálogo público deve usar um
  cliente sem sessão (chave anon).**
- **Loja desativada** pelo Super Admin: some do público e a equipe só consegue ler.
- **Criação de loja** só pela RPC `create_store()` (loja + dono atômicos).
- **Storage:** `stores/{store_id}/{products|branding|stories}/...`; bucket `catalog` (público) e `stories`
  (privado). Branding só o dono; produtos, toda a equipe. Os caminhos gravados no banco são validados contra o `store_id`.
- **Estoque** por produto (por tamanho fica para depois, se necessário). Regras de esgotado/ocultar: ETAPA 7.
- **Fora desta etapa:** tags, favoritos, reservas, logs de atividade, Stories, Instagram, analytics, planos.

## Migrations (`supabase/migrations/`)
1. `..._core_schema.sql` — tabelas, índices, gatilhos
2. `..._rls.sql` — funções de apoio, GRANTs, políticas, RPCs
3. `..._storage.sql` — buckets e políticas de arquivos

## Decisões (ETAPA 2)
- **Next.js 16 (App Router) + Supabase Auth** com cookies (`@supabase/ssr`). Telas em português, tema preto/dourado.
- **Login:** e-mail e senha, **ou** link por e-mail; cadastro; recuperação de senha. "Link por e-mail" e
  "recuperar senha" respondem sempre igual, para não revelar quais e-mails têm conta.
- **Segurança:** `src/proxy.ts` renova a sessão e leva visitantes para `/entrar`, mas é só conveniência: cada
  página exige a sessão (`requireUser`) e o RLS decide o acesso aos dados. Destino pós-login só aceita caminhos
  internos (`safeNext`). Links de e-mail usam `NEXT_PUBLIC_SITE_URL`, nunca cabeçalhos da requisição.
- **Loja de outra pessoa = 404** (não revela que existe).
- **Equipe:** o dono adiciona por e-mail quem JÁ tem conta (`add_member_by_email`); convite por e-mail para quem
  não tem conta fica na ETAPA 10. Só o dono vê e-mails da equipe (`store_team`).
- **Permissões no front** (`src/lib/permissions.ts`) só mostram/escondem botões; o banco decide.
- **Identidade visual (referência: arte enviada pelo cliente):** paleta preto `#070809`, bronze/cobre
  (`#ddb480`, `#ddae83`, `#866851`), grafite quente (`#333438`) e off-white. Fontes autohospedadas
  (`@fontsource`): Poppins (títulos e texto), Michroma (marca em caixa-alta larga) e Caveat (anotações
  manuscritas). Tokens em `src/app/globals.css`.
- **Marca:** o símbolo H (`src/components/Brand.tsx`) é um redesenho SVG provisório a partir da arte; trocar pelo
  arquivo vetorial oficial da logo quando for enviado.
- Endereços reservados (`/entrar`, `/app`, ...) ficam iguais no app e no banco (teste garante).

## Próximo
ETAPA 3: dashboard da loja.
