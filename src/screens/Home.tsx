const steps = [
  { title: 'Escolha a categoria', text: 'E-commerce, SaaS, app, site, cursos ou agendamentos.' },
  { title: 'Responda o questionário', text: 'Perguntas simples, específicas para o seu tipo de projeto.' },
  { title: 'Receba o prompt', text: 'Um prompt completo e detalhado, pronto para colar na IA.' },
]

export default function Home({ onStart }: { onStart: () => void }) {
  return (
    <section className="home">
      <div className="hero">
        <h1>Transforme uma ideia simples em um prompt completo</h1>
        <p className="lead">
          Descreva o sistema que você quer criar com suas palavras. A gente faz as perguntas certas e monta um prompt
          específico para você usar no Claude, ChatGPT ou qualquer assistente de IA.
        </p>
        <button className="btn primary lg" onClick={onStart}>
          Começar agora
        </button>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className="card">
            <span className="step-number">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
