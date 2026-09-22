# Configuração: login, pagamento e liberação de acesso

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

## 4. Testar

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
