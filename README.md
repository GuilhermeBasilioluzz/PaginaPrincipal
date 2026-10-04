# Hyperion System

SaaS multi-loja que transforma os Stories do Instagram de lojas de roupas num catálogo digital
permanente, organizado, pesquisável e ligado ao estoque.

> "Seus Stories duram 24 horas. Seu catálogo, não."

Status: **ETAPAS 1 (banco multi-loja) e 2 (autenticação, loja e equipe) concluídas**. Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
O projeto anterior (PromptForge) foi removido deste repositório; continua no histórico do git.

## Rodar o app

```bash
cp .env.example .env.local   # preencha com o projeto Supabase do Hyperion
npm install
npm run dev                  # http://localhost:3000
npm test                     # lógica (permissões, validação, slug, redirecionamento seguro)
npm run test:db              # banco: isolamento entre lojas, papéis, storage (precisa de PostgreSQL)
```

Antes do primeiro uso, aplique as migrations de `supabase/migrations/` em ordem no projeto Supabase
(SQL Editor ou Supabase CLI). Em Authentication → URL Configuration, inclua
`{NEXT_PUBLIC_SITE_URL}/auth/callback` nas Redirect URLs.

## Testar o banco

Requer PostgreSQL 15+ instalado (sem Docker nem Supabase):

```bash
scripts/test-db.sh
```

Sobe um Postgres temporário, simula `auth`/`storage`/papéis do Supabase, aplica as migrations de
`supabase/migrations/` e roda os testes de `supabase/tests/`.
