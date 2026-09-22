import type { AnswerValue, Question } from '../data/types'

interface Props {
  question: Question
  value: AnswerValue | undefined
  invalid: boolean
  onChange: (value: AnswerValue) => void
}

export default function QuestionField({ question: q, value, invalid, onChange }: Props) {
  const inputId = `q-${q.id}`
  const label = (
    <>
      {q.label}
      {q.required && <span className="required"> *</span>}
    </>
  )

  if (q.type === 'single' || q.type === 'multi') {
    const selected = Array.isArray(value) ? value : value ? [value] : []
    const toggle = (option: string) => {
      if (q.type === 'single') onChange(selected.includes(option) ? '' : option)
      else onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option])
    }
    return (
      <fieldset className={`field${invalid ? ' invalid' : ''}`}>
        <legend>
          {label}
          {q.type === 'multi' && <span className="muted small"> (escolha quantas quiser)</span>}
        </legend>
        <div className="chips">
          {q.options?.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${selected.includes(option) ? ' active' : ''}`}
              aria-pressed={selected.includes(option)}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  const text = typeof value === 'string' ? value : ''
  return (
    <div className={`field${invalid ? ' invalid' : ''}`}>
      <label htmlFor={inputId}>{label}</label>
      {q.type === 'textarea' ? (
        <textarea id={inputId} rows={4} value={text} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={inputId} type="text" value={text} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
