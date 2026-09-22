# MVP — PromptForge

## Problema
Quem não é especialista não sabe escrever um prompt detalhado para pedir a uma IA que construa um sistema.
O resultado são respostas genéricas, incompletas ou que ignoram requisitos importantes.

## Proposta
Uma plataforma web que parte de uma descrição simples do sistema, faz perguntas específicas
para o tipo de projeto e gera um prompt completo e estruturado, pronto para colar em qualquer IA.

## Escopo do MVP (esta versão)

| # | Funcionalidade | Status |
|---|----------------|--------|
| 1 | **Tela inicial** — explica a proposta em 3 passos e leva ao início do fluxo | ✅ |
| 2 | **Seleção de categoria** — 6 segmentos: E-commerce, SaaS/Gestão, Site/Landing page, App mobile, Educação, Serviços e agendamentos | ✅ |
| 3 | **Questionário por segmento** — etapas com barra de progresso: Visão geral (comum) → perguntas do segmento → Preferências técnicas (comum). Campos obrigatórios validados | ✅ |
| 4 | **Prompt gerado** — montado a partir das respostas (papel, contexto, requisitos, entregáveis do segmento, regras e formato). Copiar e baixar como `.md` | ✅ |

### Fluxo
```
Tela inicial → Categoria → Questionário (N etapas) → Prompt pronto
                    ↑____________ editar respostas ____________|
```

## Fora do MVP (próximos passos sugeridos)
- Melhorar o prompt com IA (chamada à API do Claude para refinar/expandir a descrição)
- Salvar respostas no navegador para não perder o progresso
- Contas de usuário e histórico de prompts
- Mais categorias e perguntas condicionais (uma resposta muda as próximas perguntas)
- Modelos de prompt por ferramenta de destino (Claude Code, Lovable, v0 etc.)
- Publicação (deploy) em Vercel/Netlify

## Decisões técnicas
- **React + TypeScript + Vite**: simples de rodar, fácil de evoluir.
- **Sem back-end no MVP**: tudo roda no navegador; o prompt é gerado por template.
- **Questionários como dados** (`src/data/categories.ts`): para criar uma categoria ou pergunta
  basta editar esse arquivo, sem mexer nas telas.
