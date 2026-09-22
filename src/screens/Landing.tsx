import { categories, getCategory, getSections } from '../data/categories'
import PlanCard from '../components/PlanCard'
import { formatBRL, lifetimePlan, monthlyPlan } from '../config/plans'
import { generatePrompt } from '../lib/generatePrompt'
import { mapsConfigured } from '../lib/maps'

const sampleCategory = getCategory('scheduling')!
const sampleIdea = 'Quero um app para minha barbearia onde os clientes marcam horário pelo celular.'

// O exemplo do topo é gerado pelo próprio sistema, então sempre mostra a saída real
// (a partir da descrição, sem as instruções iniciais).
const sampleLines = generatePrompt(sampleCategory, {
  projectName: 'AgendaFácil',
  description: sampleIdea,
  mainGoal: 'Captar clientes',
  serviceType: 'Barbearia',
  professionals: '2 a 5',
  schedulingFeatures: ['Lembrete por WhatsApp/e-mail', 'Lista de espera'],
  experience: 'Iniciante',
})
  .split('\n')
const samplePrompt = sampleLines.slice(sampleLines.indexOf('# Descrição do sistema'), sampleLines.indexOf('# Descrição do sistema') + 20)

const promptParts = [
  { title: 'Visão do sistema', text: 'A sua ideia descrita com clareza, do jeito que um especialista descreveria.' },
  { title: 'Público e objetivo', text: 'Para quem é, o que precisa resolver e como medir se deu certo.' },
  { title: 'Regras do seu nicho', text: 'Pagamentos, agenda, catálogo, telas: o que não pode faltar no seu segmento.' },
  { title: 'Base técnica', text: 'Tecnologias e prioridades, ou a recomendação certa quando você não sabe.' },
  { title: 'Entregas por etapa', text: 'O que precisa ser construído, em ordem, começando por uma primeira versão.' },
  { title: 'Padrão de qualidade', text: 'Segurança, organização e explicações no seu nível de experiência.' },
]

/**
 * Com a chave do Google configurada, a prospecção mostra notas e avaliações.
 * Na versão gratuita (OpenStreetMap), os textos não prometem isso.
 */
const withRatings = mapsConfigured

const pitchRows = [
  { name: 'Barbearia Exemplo 1', rating: '4,9', reviews: 312, distance: '0,6 km', hot: true },
  { name: 'Barbearia Exemplo 2', rating: '4,7', reviews: 158, distance: '1,2 km', hot: false },
  { name: 'Barbearia Exemplo 3', rating: '4,2', reviews: 87, distance: '2,4 km', hot: true },
]

const faq = [
  {
    q: 'O que eu recebo no final?',
    a: 'Um projeto técnico completo do seu sistema, em texto. Com ele você constrói usando as ferramentas de criação com inteligência artificial que preferir, ou entrega a um desenvolvedor: fica claro exatamente o que precisa ser feito.',
  },
  {
    q: 'De onde vêm os dados dos comércios?',
    a: withRatings
      ? 'Do Google Maps, em tempo real: nome, endereço, nota, número de avaliações, telefone e site que o próprio comércio publicou.'
      : 'Do OpenStreetMap, o mapa colaborativo e aberto: nome, endereço, telefone e site quando cadastrados. Cada comércio tem um atalho para ver as avaliações no Google Maps.',
  },
  {
    q: 'O que significa acesso vitalício?',
    a: 'Você paga uma única vez e usa o sistema sem mensalidade, incluindo as novas categorias e melhorias.',
  },
  {
    q: 'Posso cancelar o plano mensal?',
    a: 'Sim. A assinatura mensal pode ser cancelada quando você quiser, sem multa.',
  },
  {
    q: 'E se eu não gostar?',
    a: 'Você tem 7 dias para pedir o reembolso, conforme o direito de arrependimento do Código de Defesa do Consumidor.',
  },
  {
    q: 'Preciso saber programar?',
    a: 'Não. As perguntas são em linguagem simples, e o projeto já considera o seu nível de experiência.',
  },
]

function PromptLine({ line }: { line: string }) {
  if (!line) return <span> </span>
  if (line.startsWith('# ')) return <span className="pl-h1">{line}</span>
  if (line.startsWith('## ')) return <span className="pl-h2">{line}</span>
  // Mostra o **negrito** do Markdown como negrito de verdade.
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return <span>{parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</span>
}

export default function Landing({ onOpenGenerator }: { onOpenGenerator: () => void }) {
  const monthsToPayOff = (lifetimePlan.price / monthlyPlan.price).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const breakEvenMonth = Math.ceil(lifetimePlan.price / monthlyPlan.price)

  return (
    <div className="landing">
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Para quem cria sistemas para comércios locais</p>
            <h1>
              Sua ideia de sistema, <mark>pronta para ser construída</mark>.
            </h1>
            <p className="hero-lead">
              Encontre no mapa os comércios de qualquer cidade do Brasil, escolha para quem vender e transforme a ideia
              em um projeto completo, com funcionalidades, regras e etapas de construção. Da prospecção ao projeto, no
              mesmo lugar.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#precos">
                Quero acesso por {formatBRL(lifetimePlan.price)}
              </a>
              <button className="btn btn-ghost" onClick={onOpenGenerator}>
                Já comprei, entrar
              </button>
            </div>
          </div>

          <div className="transform" aria-label="Exemplo: uma frase vira um projeto completo">
            <div className="idea">
              <span className="sheet-label">Você escreve</span>
              <p>“{sampleIdea}”</p>
            </div>
            <div className="transform-arrow" aria-hidden>
              <span>{getSections(sampleCategory).length} etapas de perguntas depois</span>
            </div>
            <div className="sheet">
              <div className="sheet-bar">
                <span className="sheet-label">projeto.md</span>
                <span className="sheet-meta">gerado pelo PromptForge</span>
              </div>
              <pre className="sheet-body">
                {samplePrompt.map((line, i) => (
                  <PromptLine key={i} line={line} />
                ))}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="como-funciona">
        <div className="wrap">
          <h2 className="section-title">Uma ideia vaga vira um sistema genérico.</h2>
          <p className="section-lead">
            “Quero um app de agendamento” deixa quase tudo em aberto. O PromptForge preenche essas lacunas antes de
            você começar, e cada projeto sai com as mesmas seis partes:
          </p>
          <ol className="parts">
            {promptParts.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap section prospect-pitch" id="prospeccao">
        <div className="pitch-copy">
          <p className="eyebrow">Prospecção no mapa</p>
          <h2 className="section-title">Escolha a cidade. Veja quem está esperando por um sistema.</h2>
          <p className="section-lead">
            {withRatings
              ? 'Selecione o tipo de comércio, clique em qualquer ponto do Brasil e veja os negócios da região com nota, número de avaliações, telefone e site. Ordene pelas maiores ou menores notas e filtre quem ainda não tem site.'
              : 'Selecione o tipo de comércio, clique em qualquer ponto do Brasil e veja os negócios da região no mapa, com endereço, telefone, site e distância. Filtre quem não tem site informado e comece pelos mais próximos.'}
          </p>
          <ul className="pitch-points">
            <li>
              <b>Qualquer lugar do Brasil</b>
              <span>Capitais, cidades do interior ou um bairro específico, com raio de 1 a 20 km.</span>
            </li>
            <li>
              <b>Os melhores alvos primeiro</b>
              <span>
                {withRatings
                  ? 'Nota alta e nenhum site: clientes satisfeitos e nenhuma presença digital própria.'
                  : 'Filtre quem não tem site informado: negócios que ainda não têm presença digital própria.'}
              </span>
            </li>
            <li>
              <b>Funil de contatos</b>
              <span>
                Salve os comércios, envie a mensagem de abordagem pronta pelo WhatsApp e acompanhe cada um até o
                fechamento.
              </span>
            </li>
            <li>
              <b>Um clique para o projeto</b>
              <span>O projeto do sistema já começa preenchido com os dados daquele comércio.</span>
            </li>
          </ul>
        </div>
        <div className="pitch-visual" aria-label="Ilustração da tela de prospecção com resultados de exemplo">
          <div className="pitch-map" aria-hidden>
            <span className="pitch-ring" />
            {[
              ['38%', '34%', '4,9'],
              ['56%', '48%', '4,7'],
              ['44%', '62%', '4,2'],
              ['63%', '30%', '3,8'],
            ].map(([left, top, rating], i) => (
              <span
                key={i}
                className={`map-pin${i === 1 ? ' active' : ''}${withRatings ? '' : ' map-pin-dot'}`}
                style={{ left, top }}
              >
                {withRatings ? rating : ''}
              </span>
            ))}
          </div>
          <ol className="pitch-list">
            {pitchRows.map((l) => (
              <li key={l.name}>
                <span>
                  <b>{l.name}</b>
                  {l.hot && <span className="tag tag-hot">Sem site</span>}
                </span>
                {withRatings ? (
                  <span className="lead-rating">
                    <b>{l.rating}</b> ★ <span>({l.reviews})</span>
                  </span>
                ) : (
                  <span className="muted small">{l.distance}</span>
                )}
              </li>
            ))}
          </ol>
          <p className="pitch-caption">Ilustração com dados de exemplo</p>
        </div>
      </section>

      <section className="wrap section" id="categorias">
        <h2 className="section-title">Um questionário para cada tipo de sistema</h2>
        <p className="section-lead">
          Uma loja virtual e uma clínica não precisam das mesmas perguntas. Escolha o segmento e responda só o que
          importa para ele.
        </p>
        <ul className="segments">
          {categories.map((c) => {
            const count = getSections(c).reduce((n, s) => n + s.questions.length, 0)
            return (
              <li key={c.id}>
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                </div>
                <span className="segment-count">{count} perguntas</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="pricing" id="precos">
        <div className="wrap">
          <h2 className="section-title">Escolha como quer pagar</h2>
          <p className="section-lead">
            O vitalício custa o mesmo que {monthsToPayOff} meses do plano mensal. A partir do {breakEvenMonth}º mês, ele já saiu mais barato.
          </p>
          <div className="plans">
            <PlanCard plan={lifetimePlan} featured />
            <PlanCard plan={monthlyPlan} />
          </div>
          <p className="pay-note">Pagamento processado com segurança pela Cakto. 7 dias de garantia.</p>
        </div>
      </section>

      <section className="wrap section" id="duvidas">
        <h2 className="section-title">Dúvidas frequentes</h2>
        <div className="faq">
          {faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-row">
          <span className="logo">
            Prompt<span>Forge</span>
          </span>
          <span className="muted">© {new Date().getFullYear()} PromptForge</span>
        </div>
      </footer>
    </div>
  )
}
