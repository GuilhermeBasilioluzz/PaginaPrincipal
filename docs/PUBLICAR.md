# Publicar um link de teste (cerca de 15 minutos, grátis)

Você precisa de duas contas gratuitas: **Supabase** (banco e login) e **Vercel** (o site). O código já está no GitHub,
no branch `claude/inspiring-planck-k0u0jz`.

## 1. Supabase (banco de dados)
1. Em <https://supabase.com> crie um **projeto novo** (anote a senha do banco; não vamos usá-la).
2. Abra **SQL Editor → New query**, cole **todo o conteúdo de `supabase/all_migrations.sql`** e clique em **Run**.
   Deve terminar sem erro. (Rode **uma vez**. Se algo falhar no meio, apague o projeto e crie outro: é mais rápido que consertar.)
3. **Authentication → Providers → Email**: para o teste, **desligue "Confirm email"** (assim o cadastro entra direto, sem e-mail).
4. **Authentication → URL Configuration**:
   - *Site URL*: deixe para o passo 3 (o endereço da Vercel).
   - *Redirect URLs*: adicione `https://*.vercel.app/**` e `http://localhost:3000/**`.
5. **Project Settings → API**: copie a **Project URL** e a chave **anon / public**. (Nunca use a `service_role` no site.)

## 2. Vercel (o site)
1. Em <https://vercel.com> → **Add New → Project** → escolha o repositório `PaginaPrincipal`.
2. Em **Branch**, escolha `claude/inspiring-planck-k0u0jz` (se ele não aparecer como produção, use o link de **Preview** do deploy).
3. Em **Environment Variables** cadastre:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave anon / public |

   (`NEXT_PUBLIC_SITE_URL` é opcional: sem ela o site usa o endereço que a Vercel informa sozinha.)
4. **Deploy**. Ao terminar, a Vercel mostra o endereço, algo como `https://paginaprincipal-xxxx.vercel.app`. **Esse é o link de teste.**
5. Volte ao Supabase → *Authentication → URL Configuration* e coloque esse endereço em **Site URL**.

## 3. Ver funcionando (5 minutos)
1. Abra o link → **Criar conta** (use um e-mail seu) → você entra no sistema.
2. **Loja de demonstração pronta:** no Supabase → SQL Editor, abra `supabase/seed_demo.sql`, troque
   `COLOQUE-SEU-EMAIL@AQUI.COM` pelo e-mail da sua conta e rode. Ela cria a "Boutique Demo" com 6 peças em situações diferentes.
   (Ou, em vez disso, clique em **Criar loja** no site e cadastre as suas peças.)
3. Abra no **celular**: `https://SEU-LINK/demo` (a vitrine que a cliente vê) e `https://SEU-LINK/app/demo` (o painel).

## O que testar
- **Vitrine** `/demo`: busque "calca" (sem acento), filtre por cor e tamanho, abra uma peça, deslize as fotos, use **Compartilhar**.
- **Peça esgotada** (Saia Plissada): toque em **Avise-me quando chegar** → abre o WhatsApp com a mensagem pronta.
- **Painel** `/app/demo`: dashboard, **Estoque ao vivo** (abra em duas abas e dê uma entrada numa delas), **Reservas**, **Interessadas**,
  **Atividades** (quem fez o quê).
- **Equipe → Convidar por link:** crie um convite de atendente, abra o link numa janela anônima, crie outra conta e entre.
  Confira que o atendente não vê configurações nem convites, e que as ações dele aparecem em **Atividades**.
- **Configurações:** coloque seu WhatsApp, o @ do Instagram, logo e banner e veja o catálogo mudar.

## Se algo der errado
- *"Falta configurar o Supabase"*: as duas variáveis do passo 2.3 estão vazias ou erradas; corrija e faça **Redeploy**.
- *Cadastro pede confirmação de e-mail*: desligue "Confirm email" (passo 1.3).
- *Estoque ao vivo não atualiza sozinho*: a tela se atualiza a cada 20 s mesmo assim. Confirme em Supabase →
  *Database → Replication* que `inventory`, `reservations`, `inventory_movements` e `activity_logs` estão na publicação `supabase_realtime`.
- *Erro no SQL do passo 1.2*: copie a mensagem e me envie.

> O e-mail padrão do Supabase tem limite de poucos envios por hora. Para uso real, configure um SMTP próprio
> (Authentication → Emails → SMTP Settings).
