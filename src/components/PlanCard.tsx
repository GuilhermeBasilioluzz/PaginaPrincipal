import { formatBRL, type Plan } from '../config/plans'

export default function PlanCard({ plan, featured }: { plan: Plan; featured?: boolean }) {
  const discount = plan.originalPrice ? Math.round((1 - plan.price / plan.originalPrice) * 100) : 0
  return (
    <article className={`plan${featured ? ' plan-featured' : ''}`} aria-labelledby={`plan-${plan.id}`}>
      <header className="plan-head">
        <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
        {discount > 0 && <span className="plan-tag">−{discount}%</span>}
      </header>
      <div className="plan-price">
        {plan.originalPrice && (
          <span className="plan-old">
            de <s>{formatBRL(plan.originalPrice)}</s> por
          </span>
        )}
        <strong>{formatBRL(plan.price)}</strong>
        <span className="plan-period">{plan.period}</span>
      </div>
      <ul className="plan-features">
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {plan.checkoutUrl ? (
        <a className={`btn ${featured ? 'btn-mark' : 'btn-outline'} btn-block`} href={plan.checkoutUrl}>
          {plan.cta}
        </a>
      ) : (
        <button className={`btn ${featured ? 'btn-mark' : 'btn-outline'} btn-block`} disabled>
          Pagamento em breve
        </button>
      )}
    </article>
  )
}
