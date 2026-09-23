import { company, contactText, responsible } from '../config/company'

export default function Privacy() {
  const b = company.brand
  return (
    <>
      <h2 className="screen-title">Política de Privacidade</h2>
      <p className="muted small">Última atualização: {company.updatedAt}</p>

      <section>
        <h3>1. Quem cuida dos seus dados</h3>
        <p>
          O controlador dos dados pessoais tratados no {b} é {responsible()}. Esta Política explica quais dados usamos,
          para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).
          Para qualquer assunto sobre os seus dados, fale conosco {contactText()}.
        </p>
      </section>

      <section>
        <h3>2. Quais dados usamos</h3>
        <ul>
          <li>
            <strong>Login:</strong> o seu e-mail, usado para enviar o link ou o código de acesso e para identificar a sua
            conta.
          </li>
          <li>
            <strong>Compra:</strong> quando você compra, a Cakto nos informa o seu e-mail, o plano comprado, o número e a
            situação do pedido (aprovado, renovado, cancelado ou reembolsado). Não guardamos nome, CPF, telefone, endereço
            nem dados de cartão.
          </li>
          <li>
            <strong>Uso da ferramenta:</strong> os comércios que você salva no funil, as anotações, os nomes de
            responsáveis e as datas de contato que você mesmo preencher.
          </li>
          <li>
            <strong>Dados técnicos:</strong> registros de acesso gerados automaticamente pelos serviços de hospedagem (como
            endereço IP, data e hora), usados para segurança e para corrigir falhas.
          </li>
        </ul>
      </section>

      <section>
        <h3>3. Para que usamos e com qual base legal</h3>
        <ul>
          <li>
            <strong>Liberar e manter o seu acesso</strong> ao plano comprado: execução do contrato (art. 7º, V, da LGPD).
          </li>
          <li>
            <strong>Guardar registros de compras</strong> pelo prazo exigido na legislação fiscal e de consumo: cumprimento
            de obrigação legal (art. 7º, II).
          </li>
          <li>
            <strong>Segurança, prevenção de fraudes e correção de falhas:</strong> legítimo interesse (art. 7º, IX).
          </li>
        </ul>
        <p>Não vendemos os seus dados e não os usamos para publicidade.</p>
      </section>

      <section>
        <h3>4. Com quem os dados são compartilhados</h3>
        <p>Usamos fornecedores que tratam dados em nosso nome, apenas para o funcionamento do {b}:</p>
        <ul>
          <li><strong>Supabase:</strong> login e banco de dados;</li>
          <li><strong>Vercel:</strong> hospedagem do site e do servidor;</li>
          <li><strong>Cakto:</strong> processamento dos pagamentos;</li>
          <li><strong>Serviço de envio de e-mails:</strong> envio do link e do código de acesso;</li>
          <li>
            <strong>OpenStreetMap (Nominatim e Overpass) e, se ativado, Google Maps:</strong> mapa e busca de comércios.
            Esses serviços recebem o termo buscado e a localização escolhida, sem o seu nome ou e-mail.
          </li>
        </ul>
        <p>
          Alguns desses fornecedores guardam dados em servidores fora do Brasil, como nos Estados Unidos. Nesses casos, a
          transferência segue o artigo 33 da LGPD, com fornecedores que adotam padrões de proteção adequados.
        </p>
      </section>

      <section>
        <h3>5. Por quanto tempo guardamos</h3>
        <ul>
          <li>Dados da conta e do funil: enquanto o seu acesso existir, ou até você pedir a exclusão.</li>
          <li>Registros de compra: pelo prazo exigido na lei (em geral, 5 anos).</li>
          <li>Registros técnicos de acesso: pelo prazo necessário para segurança e exigências legais.</li>
        </ul>
      </section>

      <section>
        <h3>6. Seus direitos</h3>
        <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos os seus dados e ter acesso a eles;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>pedir a exclusão dos dados, exceto os que a lei obriga a guardar;</li>
          <li>pedir a portabilidade dos seus dados;</li>
          <li>saber com quem os dados são compartilhados.</li>
        </ul>
        <p>
          Para exercer esses direitos, fale conosco {contactText()}. Respondemos em até 15 dias. Você também pode
          procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </section>

      <section>
        <h3>7. Dados de terceiros que você cadastrar</h3>
        <p>
          Ao salvar comércios e anotações no funil, como o nome de um responsável, você também trata dados de outras
          pessoas. Use essas informações só para o contato comercial e respeite quem pedir para não ser contatado ou para
          ter os dados apagados. Você pode remover qualquer contato do funil a qualquer momento.
        </p>
      </section>

      <section>
        <h3>8. Segurança</h3>
        <p>
          O site usa conexão criptografada (HTTPS). No banco de dados, cada pessoa só consegue acessar os próprios dados,
          e as chaves de acesso ficam protegidas no servidor. Nenhum sistema é totalmente imune a falhas; se ocorrer um
          incidente que traga risco a você, avisaremos conforme a LGPD.
        </p>
      </section>

      <section>
        <h3>9. Armazenamento no navegador</h3>
        <p>
          Guardamos no seu navegador apenas o necessário para manter você conectado e as suas preferências, como o nome
          usado nas mensagens de abordagem. Não usamos cookies de publicidade nem de rastreamento.
        </p>
      </section>

      <section>
        <h3>10. Alterações desta Política</h3>
        <p>
          Esta Política pode ser atualizada. A data da última atualização fica no topo da página. Mudanças importantes
          serão comunicadas por e-mail ou no próprio site.
        </p>
      </section>
    </>
  )
}
