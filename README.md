# PromptForge

Plataforma web que transforma uma descrição simples de um sistema em um prompt completo e específico para IA.

Veja o escopo em [docs/MVP.md](docs/MVP.md).

## Como rodar

Requisitos: [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install      # instala as dependências (só na primeira vez)
npm run dev      # abre o servidor de desenvolvimento em http://localhost:5173
npm test         # roda os testes
npm run build    # gera a versão de produção em dist/
```

## Planos, login e pagamento

- Preços e links de checkout da Cakto: `src/config/plans.ts`.
- Login sem senha (Supabase) e liberação automática após o pagamento (webhook da Cakto).
- **Passo a passo para configurar e publicar: [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md).**

## Estrutura

```
src/
  data/categories.ts      # categorias e questionários (edite aqui para adicionar perguntas)
  data/types.ts           # tipos de pergunta, seção e categoria
  lib/generatePrompt.ts   # monta o prompt a partir das respostas
  config/plans.ts         # preços dos planos e links de checkout da Cakto
  screens/                # Landing (página de vendas), CategorySelect, Questionnaire, Result
  components/             # QuestionField (texto, texto longo, escolha única, múltipla)
  auth/useAccess.ts       # sessão do usuário e verificação do acesso pago
  lib/access.ts           # regra de quando o acesso está válido
  App.tsx                 # controla a navegação entre as telas
api/cakto-webhook.ts      # recebe os avisos de pagamento da Cakto (roda na Vercel)
server/cakto.ts           # decide liberar, manter ou remover o acesso
supabase/schema.sql       # tabelas e regras de segurança do banco
```

### Adicionando uma pergunta
Em `src/data/categories.ts`, inclua um item em `questions` da seção desejada:

```ts
{ id: 'meuCampo', label: 'Minha pergunta?', type: 'single', options: ['A', 'B'], required: true }
```

Tipos disponíveis: `text`, `textarea`, `single` (escolha única) e `multi` (múltipla escolha).
O `id` deve ser único dentro do questionário da categoria.
