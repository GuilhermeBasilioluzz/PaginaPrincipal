# Integração com o Instagram — o que sabemos e o que falta validar

Regras do projeto: **só APIs oficiais da Meta, sem scraping**, e nada é afirmado como possível sem checar a
documentação atual. Esta página separa o que foi confirmado do que ainda precisa de validação.

## Confirmado (resultados da busca em developers.facebook.com, 04/10/2026)
- Existe a conexão `stories` em um usuário do Instagram: `GET /{ig-user-id}/stories` devolve os Stories **ainda no ar**.
  Referência: <https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/>
- **Stories expiram em 24 horas.** Só aparecem na API enquanto estão no ar.
- A API só devolve mídia de **contas profissionais** (Comercial ou Criador). Conta pessoal não funciona.
  Referência: <https://developers.facebook.com/docs/instagram-platform/overview/>

## NÃO confirmado — precisa ser lido na documentação oficial antes da ETAPA 11
(O acesso direto a developers.facebook.com estava bloqueado na rede desta sessão; abrir a documentação por um
ambiente com acesso ou me enviar os trechos.)
- Quais permissões (scopes) exatas o login do Instagram pede para ler mídia e Stories.
- Se vender o sistema a lojas de terceiros exige **App Review**, **acesso avançado**, **verificação da empresa**
  na Meta e modo "Live" no app (em modo de desenvolvimento só contas adicionadas como testadoras funcionam).
- Duração e renovação do token de acesso (conhecimento prévio: token longo de ~60 dias, renovável — **validar**).
- Quais campos o Story traz (legenda, tipo, link permanente) e por quanto tempo a URL da mídia vale.
- Se existe notificação (webhook) para Story novo. Se não houver, a alternativa é consultar de tempos em tempos.

## Consequências para o produto (valem mesmo sem validar os detalhes)
1. **Stories antigos não podem ser importados**: a API só mostra o que está no ar. A loja só começa a "lembrar"
   dos Stories depois de conectar.
2. Como a janela é de 24 h, a coleta precisa rodar com frequência e **baixar a imagem na hora** para o nosso
   Storage (a URL da Meta não é permanente).
3. **Conectar exige que a loja tenha conta profissional** e autorize o Hyperion. Isso precisa de um app Meta
   aprovado para funcionar com lojas de clientes.
4. Texto escrito dentro do Story (adesivos, "R$189,90") provavelmente não vem como dado. Preço e tamanho
   serão sugeridos pela IA lendo a imagem (ETAPA 13) e **sempre confirmados por uma pessoa**.

## Plano em duas pistas (a mesma "caixa de entrada" serve às duas)
- **Pista A — Stories recebidos, entrada manual (não depende da Meta):** a atendente envia a imagem/print do
  Story (ou várias) para a caixa "Stories recebidos", revisa e converte em produto. Funciona hoje, para qualquer loja.
- **Pista B — Conexão oficial com o Instagram:** OAuth, token, consulta dos Stories no ar e entrada automática na
  mesma caixa. Depende do app Meta aprovado e da validação acima.
- Em ambas, **nada vai ao catálogo sem confirmação humana**.

## Ligação Instagram ↔ coleções e catálogo
- A loja informa o @ do Instagram (campo `stores.instagram_handle`, já existe no banco): aparece no catálogo público
  com link para o perfil.
- Cada coleção/produto terá um link próprio para colocar na bio e nos Stories (link adesivo).
- Na ETAPA 13, hashtags e palavras do Story/legenda poderão **sugerir** a coleção ("#primavera → Coleção
  Primavera"); a atendente confirma.
