import { company, contactText, responsible } from '../config/company'
import { lifetimePlan, monthlyPlan } from '../config/plans'

export default function Terms() {
  const b = company.brand
  return (
    <>
      <h2 className="screen-title">Termos de Uso</h2>
      <p className="muted small">Última atualização: {company.updatedAt}</p>

      <section>
        <h3>1. Aceitação</h3>
        <p>
          Estes Termos regem o uso do {b}
          {company.legalName ? `, oferecido por ${responsible()}` : ''}. Ao comprar um plano ou usar o {b}, você declara
          que leu, entendeu e concorda com estes Termos e com a Política de Privacidade. O serviço é destinado a maiores de
          18 anos.
        </p>
      </section>

      <section>
        <h3>2. O que é o {b}</h3>
        <p>O {b} é uma ferramenta on-line que ajuda quem desenvolve sistemas para comércios locais a:</p>
        <ul>
          <li>encontrar comércios em um mapa, a partir de dados públicos de serviços de mapas;</li>
          <li>organizar os contatos em um funil e gerar mensagens de abordagem;</li>
          <li>gerar um projeto técnico em texto, a partir das respostas a um questionário.</li>
        </ul>
        <p>
          O {b} <strong>não constrói nem entrega o sistema final</strong> e não garante vendas, fechamento de contratos ou
          qualquer resultado financeiro. O projeto gerado é um guia para ser usado com ferramentas de desenvolvimento ou
          por um profissional.
        </p>
      </section>

      <section>
        <h3>3. Acesso e conta</h3>
        <ul>
          <li>O acesso é feito pelo e-mail usado na compra, com um link ou código enviado a esse e-mail. Não há senha.</li>
          <li>
            A conta é pessoal e intransferível. Não é permitido compartilhar o acesso, revendê-lo ou permitir o uso por
            terceiros.
          </li>
          <li>Você é responsável por manter o seu e-mail seguro e por tudo o que for feito com o seu acesso.</li>
        </ul>
      </section>

      <section>
        <h3>4. Planos, pagamento e cancelamento</h3>
        <ul>
          <li>
            <strong>Plano {lifetimePlan.name}:</strong> pagamento único. Dá acesso ao {b} enquanto o serviço estiver em
            operação, incluindo as melhorias lançadas nesse período, sem mensalidade.
          </li>
          <li>
            <strong>Plano {monthlyPlan.name}:</strong> assinatura com cobrança recorrente mensal. Pode ser cancelado a
            qualquer momento pela plataforma de pagamento. Após o cancelamento, o acesso continua até o fim do período já
            pago e não há novas cobranças.
          </li>
          <li>
            Os pagamentos são processados pela Cakto, que tem os próprios termos. O {b} não recebe nem armazena dados de
            cartão.
          </li>
          <li>Os preços podem mudar para novas compras. Mudanças não afetam o que você já pagou.</li>
        </ul>
      </section>

      <section>
        <h3>5. Direito de arrependimento e reembolso</h3>
        <p>
          Conforme o artigo 49 do Código de Defesa do Consumidor, você pode desistir da compra em até{' '}
          <strong>7 dias corridos</strong> a partir da data do pagamento e receber o reembolso integral. O pedido pode ser
          feito pela Cakto ou {contactText()}. Após o reembolso, o acesso é encerrado.
        </p>
      </section>

      <section>
        <h3>6. Uso permitido</h3>
        <p>Ao usar o {b}, você se compromete a:</p>
        <ul>
          <li>usar a ferramenta apenas para a sua própria atividade profissional;</li>
          <li>
            não copiar, extrair em massa, revender ou redistribuir os dados de comércios exibidos, nem usar robôs ou
            automações para acessar o serviço;
          </li>
          <li>
            fazer contatos comerciais de forma responsável: identificar-se, não enviar mensagens em massa ou indesejadas
            (spam) e respeitar quem pedir para não ser mais contatado;
          </li>
          <li>
            respeitar a Lei Geral de Proteção de Dados (LGPD) ao tratar dados de pessoas que você cadastrar no funil de
            contatos, como nomes de responsáveis;
          </li>
          <li>não tentar burlar o controle de acesso, a segurança ou os limites do serviço.</li>
        </ul>
        <p>O descumprimento destas regras pode levar à suspensão ou ao encerramento do acesso, sem reembolso.</p>
      </section>

      <section>
        <h3>7. Dados de comércios</h3>
        <p>
          As informações de comércios (nome, endereço, telefone, site e, quando disponíveis, notas e avaliações) vêm de
          fontes públicas, como o OpenStreetMap e, se ativado, o Google Maps. Elas podem estar incompletas ou
          desatualizadas, e o {b} não garante a sua exatidão. O uso desses dados também está sujeito às regras dessas
          fontes.
        </p>
      </section>

      <section>
        <h3>8. Conteúdo gerado por você</h3>
        <p>
          Os projetos, mensagens e anotações criados com o {b} pertencem a você, que é o responsável pelo seu uso. A
          marca, o código, o layout e os modelos do {b} são de propriedade dos seus titulares e não podem ser copiados.
        </p>
      </section>

      <section>
        <h3>9. Disponibilidade e mudanças no serviço</h3>
        <p>
          Trabalhamos para manter o {b} no ar e funcionando, mas podem ocorrer interrupções para manutenção ou por falhas
          de serviços de terceiros (hospedagem, banco de dados, e-mail e mapas). Funcionalidades podem ser melhoradas,
          alteradas ou substituídas ao longo do tempo.
        </p>
      </section>

      <section>
        <h3>10. Responsabilidade</h3>
        <p>
          Na extensão permitida pela lei, o {b} não se responsabiliza por negócios feitos ou não feitos com base no uso da
          ferramenta, por decisões tomadas a partir dos dados de comércios, nem pelo uso que você fizer dos projetos e
          mensagens gerados. Nada nestes Termos limita os direitos garantidos a você pelo Código de Defesa do Consumidor.
        </p>
      </section>

      <section>
        <h3>11. Alterações destes Termos</h3>
        <p>
          Estes Termos podem ser atualizados. A data da última atualização fica no topo desta página. Mudanças
          importantes serão comunicadas por e-mail ou no próprio site.
        </p>
      </section>

      <section>
        <h3>12. Lei aplicável e foro</h3>
        <p>
          Estes Termos seguem a legislação brasileira. Fica eleito o foro do domicílio do consumidor para resolver
          qualquer questão relacionada a eles.
        </p>
      </section>

      <section>
        <h3>13. Contato</h3>
        <p>Dúvidas, suporte ou pedidos de reembolso: fale conosco {contactText()}.</p>
      </section>
    </>
  )
}
