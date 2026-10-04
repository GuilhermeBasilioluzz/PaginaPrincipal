# Hyperion System

SaaS multi-loja que transforma os Stories do Instagram de lojas de roupas num catálogo digital
permanente, organizado, pesquisável e ligado ao estoque.

> "Seus Stories duram 24 horas. Seu catálogo, não."

Status: **ETAPA 1 (banco multi-loja) concluída**. Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
O projeto anterior (PromptForge) foi removido deste repositório; continua no histórico do git.

## Testar o banco

Requer PostgreSQL 15+ instalado (sem Docker nem Supabase):

```bash
scripts/test-db.sh
```

Sobe um Postgres temporário, simula `auth`/`storage`/papéis do Supabase, aplica as migrations de
`supabase/migrations/` e roda os testes de `supabase/tests/`.
