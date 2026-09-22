# Configuração: login, pagamento, liberação de acesso e Google Maps

Como funciona:

```
Cliente paga na Cakto ──► Cakto avisa o site (webhook) ──► /api/cakto-webhook grava o acesso no Supabase
                                                                          │
Cliente entra no site com o MESMO e-mail da compra ──► o site confere o acesso ──► gerador liberado
```

| Evento da Cakto | O que acontece |
|---|---|
| `purchase_approved` (vitalício) | Libera para sempre |
| `purchase_approved` / `subscription_renewed` (mensal) | Libera por 33 dias (30 + 3 de tolerância) a partir do pagamento |
| `subscription_canceled` | Mantém até o fim do período já pago |
| `refund` / `chargeback` | Remove o acesso na hora |
| Qualquer outro | Só fica registrado |

Quem tem o vitalício nunca perde o acesso por causa de um evento do plano mensal.

---

## 1. Supabase (login + banco de dados) — grátis

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. **SQL Editor → New query**: cole todo o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.
3. **Authentication → URL Configuration**:
   - *Site URL*: o endereço do seu site (ex.: `https://promptforge.vercel.app`).
4. **Authentication → Emails → Magic Link**: para o cliente também receber um código de 6 dígitos,
   inclua no texto do e-mail: `Seu código: {{ .Token }}`.
5. **Project Settings → API**: anote a *Project URL*, a chave *anon/public* e a chave *service_role* (secreta).

> O envio de e-mails padrão do Supabase tem limite baixo por hora. Antes de começar a vender,
> configure um SMTP próprio em **Authentication → Emails → SMTP Settings** (ex.: Resend, Brevo).

## 2. Vercel (publicar o site) — grátis

1. Entre em [vercel.com](https://vercel.com) com o GitHub → **Add New → Project** → escolha `PaginaPrincipal`.
2. Em **Environment Variables**, cadastre (os valores estão explicados em [`.env.example`](../.env.example)):

   | Variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL do Supabase |
   | `VITE_SUPABASE_ANON_KEY` | chave anon/public |
   | `SUPABASE_URL` | Project URL do Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (**secreta**) |
   | `CAKTO_WEBHOOK_SECRET` | chave secreta do webhook da Cakto (passo 3) |
   | `CAKTO_LIFETIME_IDS` | `ubgv3n5` |
   | `CAKTO_MONTHLY_IDS` | `pehqx45` |
   | `VITE_GOOGLE_MAPS_API_KEY` | chave do navegador (passo 4) |
   | `VITE_GOOGLE_MAPS_MAP_ID` | opcional (passo 4) |
   | `GOOGLE_PLACES_API_KEY` | chave do servidor (**secreta**, passo 4) |

3. Clique em **Deploy**. Anote o endereço do site.

## 3. Cakto (avisos de pagamento)

1. No painel da Cakto, vá em **Integrações → Webhooks** e crie um webhook:
   - **URL**: `https://SEU-SITE/api/cakto-webhook`
   - **Produtos**: o vitalício e o mensal
   - **Eventos**: Compra aprovada, Assinatura renovada, Assinatura cancelada, Reembolso e Chargeback
2. Copie a **chave secreta** do webhook e cole em `CAKTO_WEBHOOK_SECRET` na Vercel
   (depois de mudar variáveis, faça um novo deploy em **Deployments → Redeploy**).
3. Nos dois produtos, configure a **página de obrigado / redirecionamento** para `https://SEU-SITE/#entrar`,
   assim o cliente cai direto na tela de login depois de pagar.

## 4. Google Maps (prospecção de comércios)

A prospecção usa três serviços do Google Maps Platform. Eles são **pagos por uso**, com uma cota
gratuita mensal. Confira os preços atuais em
[mapsplatform.google.com/pricing](https://mapsplatform.google.com/pricing/) e **configure limites**
para não ter surpresas.

1. Entre em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto e ative o faturamento.
2. Em **APIs e serviços → Biblioteca**, ative:
   - **Maps JavaScript API** (o mapa)
   - **Geocoding API** (buscar cidade ou bairro)
   - **Places API (New)** (a lista de comércios)
3. Em **APIs e serviços → Credenciais**, crie **duas** chaves de API:

   | Chave | Restrição de aplicativo | Restrição de API | Variável na Vercel |
   |---|---|---|---|
   | Navegador | Sites: `https://SEU-SITE/*` | Maps JavaScript API, Geocoding API | `VITE_GOOGLE_MAPS_API_KEY` |
   | Servidor | Nenhuma | Places API (New) | `GOOGLE_PLACES_API_KEY` (**secreta**) |

4. (Opcional) Em **Google Maps Platform → Map Management**, crie um *Map ID* do tipo JavaScript e
   cadastre em `VITE_GOOGLE_MAPS_MAP_ID`. Sem ele, o site usa o mapa de demonstração do Google.
5. **Controle de gastos**: em **Faturamento → Orçamentos e alertas**, crie um alerta de valor mensal.
   Em **APIs e serviços → Places API (New) → Cotas**, limite as buscas por dia.
6. Faça um novo deploy na Vercel depois de cadastrar as chaves.

Como funciona por dentro: o mapa roda no navegador, mas a busca de comércios passa pelo servidor
(`/api/places-search`), que só responde para quem está logado **e com acesso pago**. Assim ninguém
gasta a sua cota do Google sem ter comprado.

Cada busca traz até 20 comércios; "Carregar mais" busca a próxima página (até 60 no total, limite do Google).

> Regras do Google: os dados dos comércios podem ser exibidos, mas não copiados para uma base própria
> (a exceção é o ID do lugar). Por isso a lista não tem exportação para planilha.

## 5. Testar

1. Na Cakto, use o botão de **enviar evento de teste** do webhook (ou faça uma compra real e reembolse).
2. No Supabase, abra **Table Editor → webhook_events**: cada aviso recebido aparece ali com o resultado
   (ex.: `lifetime: vitalício liberado`).
3. Em **Table Editor → access** aparece o e-mail com acesso liberado.
4. Entre no site com esse e-mail e confira se o gerador abre.

Se o resultado mostrar o plano errado, confira os códigos em `CAKTO_LIFETIME_IDS` / `CAKTO_MONTHLY_IDS`:
compare com os campos `offer.id` e `product.short_id` do `payload` registrado em `webhook_events`.

## Rodar no computador

```bash
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # site em http://localhost:5173 (o webhook só roda na Vercel)
```

Para testar o gerador sem login, use `VITE_DEMO_MODE=true` no `.env.local`.
