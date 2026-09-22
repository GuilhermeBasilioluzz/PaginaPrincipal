import { categories } from '../data/categories'

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
  onBack: () => void
}

export default function CategorySelect({ selectedId, onSelect, onBack }: Props) {
  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Voltar
      </button>
      <p className="eyebrow">Passo 1 de 3</p>
      <h2 className="screen-title">Que tipo de sistema você quer criar?</h2>
      <p className="muted">Cada categoria tem um questionário próprio.</p>
      <div className="category-grid">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`card category${c.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <strong>{c.name}</strong>
            <span className="muted">{c.description}</span>
            <span className="category-go" aria-hidden>
              Começar →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
