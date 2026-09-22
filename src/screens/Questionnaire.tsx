import { useEffect, useState } from 'react'
import QuestionField from '../components/QuestionField'
import { getSections } from '../data/categories'
import type { Answers, Category } from '../data/types'
import { missingRequired } from '../lib/generatePrompt'

interface Props {
  category: Category
  answers: Answers
  onChange: (answers: Answers) => void
  onBack: () => void
  onFinish: () => void
}

export default function Questionnaire({ category, answers, onChange, onBack, onFinish }: Props) {
  const sections = getSections(category)
  const [step, setStep] = useState(0)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => window.scrollTo(0, 0), [step])

  const section = sections[step]
  const missing = missingRequired(section, answers)
  const isLast = step === sections.length - 1

  function next() {
    if (missing.length) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    if (isLast) onFinish()
    else setStep(step + 1)
  }

  function back() {
    setShowErrors(false)
    if (step === 0) onBack()
    else setStep(step - 1)
  }

  return (
    <section className="questionnaire">
      <div className="q-header">
        <span className="badge">
          {category.icon} {category.name}
        </span>
        <span className="muted small">
          Etapa {step + 1} de {sections.length}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={sections.length}>
        <div style={{ width: `${((step + 1) / sections.length) * 100}%` }} />
      </div>

      <div className="card form">
        <h2>{section.title}</h2>
        {section.description && <p className="muted">{section.description}</p>}
        {section.questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            invalid={showErrors && missing.includes(q)}
            onChange={(value) => onChange({ ...answers, [q.id]: value })}
          />
        ))}
        {showErrors && missing.length > 0 && <p className="error">Preencha os campos marcados com *.</p>}
      </div>

      <div className="actions">
        <button className="btn" onClick={back}>
          Voltar
        </button>
        <button className="btn primary" onClick={next}>
          {isLast ? 'Gerar prompt' : 'Próximo'}
        </button>
      </div>
    </section>
  )
}
