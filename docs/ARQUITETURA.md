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

## Próximo
ETAPA 2: base Next.js (App Router), autenticação, perfil, loja e membros.
