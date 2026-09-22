import { categories, getCategory, getSections } from '../data/categories'
import PlanCard from '../components/PlanCard'
import { formatBRL, lifetimePlan, monthlyPlan } from '../config/plans'
import { generatePrompt } from '../lib/generatePrompt'

const sampleCategory = getCategory('scheduling')!
const sampleIdea = 'Quero um app para minha barbearia onde os clientes marcam horário pelo celular.'

// O exemplo do topo é gerado pelo próprio gerador, então sempre mostra a saída real.
const samplePrompt = generatePrompt(sampleCategory, {
  projectName: 'AgendaFácil',
  description: sampleIdea,
  mainGoal: 'Captar clientes',
  serviceType: 'Barbearia',
  professionals: '2 a 5',
  schedulingFeatures: ['Lembrete por WhatsApp/e-mail', 'Lista de espera'],
  experience: 'Iniciante',
})
  .split('\n')
  .slice(0, 22)

const promptParts = [
  { title: 'Papel', text: 'A IA assume o papel de especialista no seu tipo de sistema.' },
  { title: 'Contexto', text: 'Público, objetivo e a sua descrição, organizados.' },
  { title: 'Requisitos do segmento', text: 'Pagamentos, agenda, catálogo, telas: o que importa no seu nicho.' },
  { title: 'Requisitos técnicos', text: 'Tecnologias e prioridades, ou o pedido para a IA recomendar.' },
  { title: 'Entregáveis', text: 'Exatamente o que a IA deve entregar, em etapas.' },
  { title: 'Regras e formato', text: 'Como a IA deve responder, no seu nível de experiência.' },
]

const faq = [
  {
    q: 'Funciona com qual IA?',
    a: 'Com qualquer uma: Claude, ChatGPT, Gemini, Claude Code, Lovable e outras. O prompt é texto: basta copiar e colar.',
  },
  {
    q: 'O que significa acesso vitalício?',
    a: 'Você paga uma única vez e usa o gerador sem mensalidade, incluindo as novas categorias e melhorias.',
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
    a: 'Não. As perguntas são em linguagem simples, e o prompt pede para a IA explicar tudo no seu nível.',
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
            <p className="eyebrow">Gerador de prompts para criar sistemas com IA</p>
            <h1>
              Uma frase entra. Um <mark>prompt completo</mark> sai.
            </h1>
            <p className="hero-lead">
              Descreva o sistema com as suas palavras. O PromptForge faz as perguntas que um desenvolvedor faria e
              monta o prompt detalhado que a IA precisa para construir o que você imaginou.
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

          <div className="transform" aria-label="Exemplo: uma frase vira um prompt completo">
            <div className="idea">
              <span className="sheet-label">Você escreve</span>
              <p>“{sampleIdea}”</p>
            </div>
            <div className="transform-arrow" aria-hidden>
              <span>{getSections(sampleCategory).length} etapas de perguntas depois</span>
            </div>
            <div className="sheet">
              <div className="sheet-bar">
                <span className="sheet-label">prompt.md</span>
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
          <h2 className="section-title">Um prompt vago gera um sistema genérico.</h2>
          <p className="section-lead">
            “Faz um app de agendamento” deixa a IA adivinhar quase tudo. O PromptForge preenche as lacunas antes, e
            cada prompt sai com as mesmas seis partes:
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
