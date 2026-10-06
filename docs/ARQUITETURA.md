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

## Decisões (ETAPA 3)
- **Painel com dados reais:** uma única função `store_dashboard()` (SECURITY INVOKER, então o RLS vale) devolve
  contagens por situação, destaque, coleções, estoque baixo/esgotado e as 8 últimas atividades com o autor.
  Quem não é da loja recebe zeros.
- **Sem números inventados:** Visualizações, cliques no WhatsApp e Stories importados aparecem como "Em breve" até
  as etapas de análises (15) e Instagram (11-12). "Últimas atividades" usa, por enquanto, as alterações em produtos;
  o histórico completo (`activity_logs`) vem na ETAPA 10.
- **Total de produtos não conta arquivados**; "Poucas unidades"/"Esgotados" só consideram produtos disponíveis ou reservados.
- **Atenção p/ ETAPA 4/7:** produto novo nasce com estoque 0 (conta como esgotado). O cadastro precisa pedir a quantidade.

## Decisões (ETAPA 4)
- **Gravação atômica:** `save_product()` cria/atualiza o produto E o estoque numa transação (SECURITY INVOKER: RLS
  e GRANTs por coluna continuam valendo). Se o estoque falha, nada fica pela metade.
- **Endereço do produto (slug)** é gerado do nome, único por loja (`-2`, `-3`) e **não muda ao renomear**
  (links já compartilhados continuam valendo).
- **Duplicar** (`duplicate_product()`): copia o modelo e as coleções; a cópia nasce **indisponível** (fora do catálogo),
  sem estoque e sem SKU, para ninguém publicar por engano. Fotos não são copiadas (ETAPA 5).
- **Arquivar** guarda o histórico (some do catálogo); **excluir** só dono/gerente, com confirmação. Restaurar volta
  como indisponível.
- **Formulário em dois níveis:** essencial (nome, preço, estoque, tamanhos, cor, situação) + "Mais opções".
  Preço aceita vírgula ("189,90", "R$ 1.234,56"). Tamanhos: PP–XG, Único, 34–46 e campo livre.
- **Lista:** busca por nome/SKU (texto sanitizado), filtro por situação, 20 por página.
- **Ainda não faz:** fotos (ETAPA 5), categorias/coleções CRUD (6), regras automáticas de esgotado (7).

## Decisões (ETAPA 5)
- **Redimensiona no navegador** antes de enviar: foto de no máximo 1600 px + miniatura de 480 px, em WebP (JPEG se o
  navegador não gerar WebP), respeitando a rotação do celular. Economiza internet e deixa o catálogo rápido.
  Testado em Chromium real (4000×3000 → 1600×1200).
- **Caminho:** `stores/{loja}/products/{produto}/{id}.webp` e `{id}_thumb.webp`. O servidor só registra caminhos que
  pertencem à loja e ao produto; o Storage libera a escrita pela pasta da loja; o banco também valida o prefixo.
- **Até 8 fotos por produto** (gatilho). A posição é do banco; **posição 0 = foto principal**; reordenar é atômico
  (`reorder_product_images`). Tipos: frente, costas, lateral, detalhe, outra (sugestão automática ao enviar).
- **Sem arquivos órfãos:** se o registro falha, o navegador apaga o que enviou; remover foto ou excluir produto também
  remove os arquivos. (Apagar a loja inteira não limpa o Storage: tratar na ETAPA 18 / rotina de manutenção.)
- Criar produto agora abre a tela de edição, já com o envio de fotos. Lista mostra a miniatura da foto principal.
- Duplicar produto ainda não copia fotos (decisão: evitar duas linhas apontando para o mesmo arquivo).

## Decisões (ETAPA 6)
- **Categorias:** 2 níveis (categoria > subcategoria), garantido por gatilho. Excluir não apaga produtos (ficam sem
  categoria); subcategorias viram principais. Endereço (slug) único por loja e fixo.
- **Coleções** são contextos, não categorias: uma peça pode estar em várias. Dois tipos:
  `manual` (a equipe escolhe) e `new_arrivals` (**automática**, por dias desde a publicação). Rascunho/publicada.
- **`collection_items()` é a fonte única do conteúdo de uma coleção**: o painel e o futuro catálogo público usam a mesma
  função; para o público o RLS esconde coleção em rascunho e peça fora do catálogo.
- **Loja nova nasce só com "Novidades" (automática, 7 dias).** As demais coleções virão da equipe e, a partir da ETAPA 12,
  das **pré-seleções de Stories** (ver `docs/INSTAGRAM.md`).
- **Permissões:** categorias e coleções (criar/editar/excluir): dono e gerente. Atendente organiza peças dentro das coleções.
- Produto ↔ coleções: marcação na tela do produto (atômica) e escolha de várias peças na tela da coleção.

## Direção do produto: Story → pré-seleção → coleção permanente
Stories somem em 24 h; o catálogo não. A loja posta no Instagram, o Hyperion recolhe o Story numa caixa de pré-seleção
("Stories recebidos"), a equipe confirma (semiautomático) e o conteúdo vira produtos/coleção que permanecem.
Entrada manual (print/foto do Story) e conexão oficial com a Meta alimentam a mesma caixa. Detalhes: `docs/INSTAGRAM.md`.

## Decisões (ETAPA 7)
- **Três números por peça:** em estoque (físico), reservadas (reservas ativas e não vencidas) e livres (estoque − reservadas).
- **A quantidade só muda por funções** (`adjust_stock`, `set_stock`, reservas, retirada), nunca por UPDATE direto. Cada mudança grava
  quem, quando, quanto e por quê em `inventory_movements` (somente leitura para a equipe). Reservas também entram nessa linha do tempo.
  A linha da peça é travada (`FOR UPDATE`): duas atendentes mexendo ao mesmo tempo não se atropelam. Nunca fica negativo nem abaixo do reservado.
- **Reservas:** cliente, contato, tamanho, observação, quem reservou, prazo opcional. Situações: solicitada → confirmada → retirada
  (vira venda e baixa o estoque) ou cancelada (libera). Reserva vencida deixa de segurar a peça. Solicitações feitas pela cliente no
  catálogo (status `requested`) entram na ETAPA 9 e já são tratadas aqui.
- **Situação automática:** estoque 0 → "vendido" (esgotado); tudo reservado → "reservado"; senão "disponível". "Indisponível" e
  "arquivado" são decisões humanas e nunca são alteradas. Escolher a situação à mão no cadastro vale até o próximo evento de estoque.
  Limite: o vencimento de uma reserva só reflete na situação no próximo evento (falta uma rotina periódica — ETAPA 20).
- **Ao vivo:** `inventory`, `reservations` e `inventory_movements` estão na publicação `supabase_realtime`. A tela escuta mudanças
  da loja (o Realtime respeita o RLS) e pede os dados novos ao servidor; sem conexão, atualiza a cada 20 s e ao voltar à aba.
- Painel principal ganhou "Reservas ativas". Telas: Estoque (totais, filtros, ajuste rápido, "o que está acontecendo"), Reservas
  (ativas/retiradas/canceladas, com quem reservou e para quem) e bloco de estoque + histórico em cada produto.

## Decisões (ETAPA 8 — catálogo público)
- **Rotas:** `/{loja}` (vitrine), `/{loja}/colecao/{coleção}`, `/{loja}/produto/{peça}` (versão enxuta; a completa é a ETAPA 9).
  Endereços do sistema (`/entrar`, `/app`…) são reservados e nunca viram nome de loja.
- **Uma consulta por página** (`catalog_store` + `catalog_products`, sem N+1). São funções SECURITY DEFINER que só devolvem colunas
  seguras e **rótulos** de estoque (disponível, poucas unidades, reservado, esgotado), nunca quantidades, SKU ou autores.
  Loja desligada ou desativada devolve vazio. O catálogo usa um cliente SEM sessão (visitante), mesmo para quem está logado.
- **Esgotado aparece como "Esgotado"** e vai para o fim da lista; a loja pode ocultar (`hide_sold_out`).
- **Busca:** sem acento e sem diferenciar maiúsculas, todas as palavras precisam aparecer (nome, descrição, cor, categoria), palavras de
  ligação ignoradas ("roupa para festa"), curingas tratados como texto, SKU nunca é pesquisável pelo público.
  Filtros: categoria (com subcategorias), coleção, cor, tamanho, faixa de preço (considera a promoção), só com estoque, ordenação. 24 por página.
- **Mobile-first:** 2 colunas no celular, imagens com tamanho fixo (sem pulo de layout), miniaturas, primeiras 4 imagens com prioridade,
  filtros por URL (funcionam sem JavaScript e podem ser compartilhados).
- **SEO:** título, descrição, Open Graph e canonical por loja, coleção e peça; prévia bonita no WhatsApp.
- **Configurações da loja** (`/app/{loja}/configuracoes`, só o dono): nome, frase, sobre, WhatsApp, Instagram (aceita @ ou link; recusa
  links de outros sites), endereço, horário, logo e banner (redimensionados no navegador), catálogo ligado/desligado, ocultar esgotados.

### "Avise-me quando chegar" (pedido do cliente)
- Na página da peça esgotada ou toda reservada, o botão **registra um clique anônimo** (contador por peça e por dia, sem dados
  pessoais) e **leva direto ao WhatsApp da loja com a mensagem pronta** (nome da peça + link). É um POST: robôs e pré-visualizações não
  inflam a contagem; só aceita o próprio site.
- A vendedora vê a **demanda por peça** (pedidos de aviso em 30 dias, pessoas na lista, tamanhos mais pedidos) e **anota quem chamou**
  numa lista de espera. Quando a peça volta ao estoque, o painel destaca "avise quem esperava" e cada pessoa tem um botão de WhatsApp com
  mensagem pronta. Da lista dá para "reservar para ela" (a pessoa vira "venda" ao reservar). Dono/gerente apagam os dados a pedido (LGPD).
- O aviso é **manual**: não há envio automático de WhatsApp. Cliques não identificam ninguém; a identificação vem da conversa.

## Decisões (ETAPA 9 — página da peça)
- **Uma consulta traz a peça** (fotos em ordem, categoria com a principal, coleções, situação) e **outra traz as relacionadas**; as duas
  rodam em paralelo.
- **"Você também pode gostar"** (`catalog_related`): afinidade por pontos (+3 mesma coleção publicada, +2 mesma categoria, +1 categoria
  vizinha, +1 mesma cor), esgotadas por último, e completa com as mais novas para a vitrine não ficar vazia. Respeita ocultar esgotados.
- **Galeria:** fotos deslizantes (funciona sem JavaScript), miniaturas, contador, setas do teclado e ampliação em tela cheia (`<dialog>`
  nativo: Esc fecha). Foto principal com prioridade de carregamento; as outras sob demanda.
- **Tamanho opcional:** a cliente escolhe o tamanho e ele entra na mensagem do WhatsApp e no "Avise-me" (só vale se for um tamanho da peça).
- **Compartilhar sem pedir conta:** menu nativo do celular (só aparece onde o navegador suporta), WhatsApp para escolher o contato e
  copiar link (com plano B para navegadores que bloqueiam a área de transferência). Cancelar o menu nativo não gera erro.
- **SEO:** dados estruturados `Product` (preço em BRL, disponibilidade) e `BreadcrumbList`; o JSON é escapado para que texto da loja
  nunca feche a tag `<script>`. Migalhas de pão visíveis (loja › categoria › subcategoria › peça).
- Ícone do app (`icon.svg`, o H provisório) para a aba do navegador e favoritos.

## Próximo
ETAPA 10: multiatendente (convites, permissões, registro de quem alterou cada produto).
