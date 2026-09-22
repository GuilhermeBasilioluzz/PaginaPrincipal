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

## Planos e pagamento (Cakto)

Preços e links de checkout ficam em `src/config/plans.ts`.
Cole o link de checkout de cada produto da Cakto em `checkoutUrl`. Enquanto o link estiver vazio,
o botão aparece como "Pagamento em breve".

## Estrutura

```
src/
  data/categories.ts      # categorias e questionários (edite aqui para adicionar perguntas)
  data/types.ts           # tipos de pergunta, seção e categoria
  lib/generatePrompt.ts   # monta o prompt a partir das respostas
  config/plans.ts         # preços dos planos e links de checkout da Cakto
  screens/                # Landing (página de vendas), CategorySelect, Questionnaire, Result
  components/             # QuestionField (texto, texto longo, escolha única, múltipla)
  App.tsx                 # controla a navegação entre as telas
```

### Adicionando uma pergunta
Em `src/data/categories.ts`, inclua um item em `questions` da seção desejada:

```ts
{ id: 'meuCampo', label: 'Minha pergunta?', type: 'single', options: ['A', 'B'], required: true }
```

Tipos disponíveis: `text`, `textarea`, `single` (escolha única) e `multi` (múltipla escolha).
O `id` deve ser único dentro do questionário da categoria.
