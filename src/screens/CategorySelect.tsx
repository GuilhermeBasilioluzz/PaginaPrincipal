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
      <h2>Que tipo de sistema você quer criar?</h2>
      <p className="muted">Cada categoria tem um questionário próprio.</p>
      <div className="category-grid">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`card category${c.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span className="category-icon" aria-hidden>
              {c.icon}
            </span>
            <strong>{c.name}</strong>
            <span className="muted">{c.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
