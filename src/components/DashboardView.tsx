import {
  STATUS_LABEL, activityVerb, isEmptyStore, statusSegments, timeAgo, type Dashboard,
} from '@/lib/dashboard'

const nf = new Intl.NumberFormat('pt-BR')

function Tile({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'warn' }) {
  return (
    <div className={`tile${tone === 'warn' && value > 0 ? ' tile-warn' : ''}`}>
      <span className="tile-label">{label}</span>
      <strong className="tile-value">{nf.format(value)}</strong>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  )
}

function SoonTile({ label, stage }: { label: string; stage: string }) {
  return (
    <div className="tile tile-soon">
      <span className="tile-label">{label}</span>
      <strong className="tile-value" aria-label="indisponível">—</strong>
      <span className="tile-hint">Em breve · {stage}</span>
    </div>
  )
}

export function DashboardView({ data, canEdit, now }: { data: Dashboard; canEdit: boolean; now?: Date }) {
  const { products: p } = data

  if (isEmptyStore(data)) {
    return (
      <div className="card empty">
        <h2>Você ainda não cadastrou nenhuma peça.</h2>
        <p className="muted">
          Quando você adicionar a primeira peça, este painel mostra o que está disponível, reservado e vendido.
        </p>
        {canEdit && (
          <button type="button" className="btn btn-primary" disabled title="Disponível na próxima etapa">
            Adicionar produto
          </button>
        )}
        {canEdit && <p className="small muted">O cadastro de produtos chega na próxima etapa.</p>}
      </div>
    )
  }

  const segments = statusSegments(p)
  const summary = segments.map((s) => `${s.label}: ${s.count}`).join(', ')

  return (
    <div className="stack-lg">
      <section aria-labelledby="h-prod" className="stack">
        <h2 id="h-prod" className="eyebrow">Produtos</h2>
        <div className="tiles">
          <Tile label="Total de produtos" value={p.total} hint={p.archived ? `${p.archived} arquivado(s)` : undefined} />
          <Tile label="Disponíveis" value={p.available} />
          <Tile label="Reservados" value={p.reserved} />
          <Tile label="Vendidos" value={p.sold} />
          <Tile label="Em destaque" value={p.featured} />
          <Tile label="Coleções" value={data.collections} />
          <Tile label="Poucas unidades" value={data.stock.low} tone="warn" hint="Perto de acabar" />
          <Tile label="Esgotados" value={data.stock.out} tone="warn" hint="Sem estoque" />
        </div>
        <div className="card">
          <div className="bar" role="img" aria-label={`Situação do catálogo. ${summary}`}>
            {segments.filter((s) => s.percent > 0).map((s) => (
              <span key={s.status} className={`bar-seg bar-${s.status}`} style={{ width: `${s.percent}%` }} />
            ))}
          </div>
          <ul className="legend">
            {segments.map((s) => (
              <li key={s.status}>
                <span className={`dot bar-${s.status}`} aria-hidden="true" /> {s.label} <strong>{nf.format(s.count)}</strong>
                <span className="muted small"> ({s.percent}%)</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="h-perf" className="stack">
        <h2 id="h-perf" className="eyebrow">Desempenho</h2>
        <div className="tiles tiles-3">
          <SoonTile label="Visualizações" stage="análises" />
          <SoonTile label="Cliques no WhatsApp" stage="análises" />
          <SoonTile label="Stories importados" stage="Instagram" />
        </div>
      </section>

      <section aria-labelledby="h-act" className="stack">
        <h2 id="h-act" className="eyebrow">Últimas atividades</h2>
        <div className="card">
          {data.recent.length === 0 ? (
            <p className="muted">Nenhuma atividade ainda.</p>
          ) : (
            <ul className="activity">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <span className="muted small">{timeAgo(r.updated_at, now)}</span>
                  <span>
                    <strong>{r.actor || 'Alguém da equipe'}</strong> {activityVerb(r.created_at, r.updated_at)}{' '}
                    <em>{r.name}</em> <span className="badge">{STATUS_LABEL[r.status]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
