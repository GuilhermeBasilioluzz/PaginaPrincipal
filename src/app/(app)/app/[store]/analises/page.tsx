import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can } from '@/lib/permissions'
import { getMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { STATUS_LABEL } from '@/lib/dashboard'
import { PERIODS, SOURCE_LABEL, changeLabel, contactRate, parsePeriod, parseReport, totalViews } from '@/lib/analytics'

export const metadata = { title: 'Análises' }
export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('pt-BR')

function Tile({ label, value, now, before }: { label: string; value: number; now: number; before: number }) {
  const ch = changeLabel(now, before)
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <strong className="tile-value">{nf.format(value)}</strong>
      <span className={`small ${ch.tone === 'up' ? 'delta-up' : ch.tone === 'down' ? 'delta-down' : 'muted'}`}>{ch.text}</span>
    </div>
  )
}

/** Barras diárias em SVG: altura proporcional ao maior dia, rótulos só no início, meio e fim. */
function DailyChart({ daily }: { daily: { day: string; views: number; contacts: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.views))
  const w = 600, h = 140, pad = 4
  const bar = (w - pad * 2) / daily.length
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label={`Visualizações por dia. Máximo ${max} em um dia.`} style={{ width: '100%', height: 'auto' }}>
        <line x1={pad} y1={h} x2={w - pad} y2={h} stroke="var(--line)" />
        {daily.map((d, i) => {
          const bh = (d.views / max) * (h - 8)
          return <rect key={d.day} x={pad + i * bar + 1} y={h - bh} width={Math.max(bar - 2, 1)} height={bh} rx={2} fill="var(--copper, #c8975a)"><title>{`${fmt(d.day)}: ${d.views} visualizações, ${d.contacts} contatos`}</title></rect>
        })}
        {[0, Math.floor((daily.length - 1) / 2), daily.length - 1].map((i, k) => daily[i] && (
          <text key={i} x={k === 0 ? pad : k === 1 ? w / 2 : w - pad} y={h + 16} fontSize="12" fill="var(--muted)" textAnchor={k === 0 ? 'start' : k === 1 ? 'middle' : 'end'}>{fmt(daily[i].day)}</text>
        ))}
        <text x={w - pad} y={10} fontSize="12" fill="var(--muted)" textAnchor="end">máx. {max}/dia</text>
      </svg>
    </figure>
  )
}

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ dias?: string }> }) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  if (!can(membership.role, 'view_reports')) {
    return <div className="card empty"><h2>Análises são para dono e gerente.</h2><p className="muted">Peça a quem administra a loja.</p></div>
  }
  const days = parsePeriod(sp.dias)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('store_analytics', { p_store: membership.store.id, p_days: days })
  if (error) return <p className="notice notice-error" role="alert">Não foi possível carregar as análises agora. Atualize a página.</p>
  const r = parseReport(data)
  const views = totalViews(r.totals), viewsBefore = totalViews(r.previous)
  const rate = contactRate(r.totals)
  const empty = views === 0 && r.totals.whatsapp_click === 0 && r.totals.avise_click === 0
  const srcMax = Math.max(1, ...r.sources.map((s) => s.views))

  return (
    <div className="stack-lg">
      <div className="card stack">
        <div className="row spread">
          <div>
            <h2>Análises do catálogo</h2>
            <p className="muted small">Contagens anônimas: não guardamos quem visitou (sem IP, cookie ou dados pessoais). Visitas de quem não aceita ser contado (“não rastrear”) não entram.</p>
          </div>
          <nav className="chips-nav" aria-label="Período">
            {PERIODS.map((p) => <Link key={p} href={`/app/${slug}/analises?dias=${p}`} aria-current={days === p ? 'page' : undefined}>{p} dias</Link>)}
          </nav>
        </div>
      </div>

      {empty ? (
        <div className="card empty">
          <h2>Ainda sem visitas neste período.</h2>
          <p className="muted">Divulgue o link ou o QR Code do catálogo e volte aqui. Em <Link className="link" href={`/app/${slug}/compartilhar`}>Compartilhar</Link> você pega links marcados para a bio e para os Stories.</p>
        </div>
      ) : (
        <>
          <div className="tiles tiles-3">
            <Tile label="Visualizações" value={views} now={views} before={viewsBefore} />
            <Tile label="Peças vistas" value={r.totals.product_view} now={r.totals.product_view} before={r.previous.product_view} />
            <Tile label="Toques no WhatsApp" value={r.totals.whatsapp_click} now={r.totals.whatsapp_click} before={r.previous.whatsapp_click} />
            <Tile label="“Avise-me” (esgotadas)" value={r.totals.avise_click} now={r.totals.avise_click} before={r.previous.avise_click} />
            <Tile label="Compartilhamentos" value={r.totals.share_click} now={r.totals.share_click} before={r.previous.share_click} />
            <div className="tile"><span className="tile-label">Toques / peças vistas</span><strong className="tile-value">{rate === null ? '—' : `${String(rate).replace('.', ',')}%`}</strong><span className="small muted">de cada 100 peças vistas</span></div>
          </div>

          <section className="card stack" aria-labelledby="dia-h">
            <h2 id="dia-h">Visualizações por dia</h2>
            <DailyChart daily={r.daily} />
          </section>

          <section className="card stack" aria-labelledby="orig-h">
            <h2 id="orig-h">De onde vêm as visitas</h2>
            {r.sources.length === 0 ? <p className="muted small">Sem dados.</p> : (
              <ul className="bars">
                {r.sources.map((s) => (
                  <li key={s.source}>
                    <span>{SOURCE_LABEL[s.source]}</span>
                    <span className="bar-track"><i style={{ width: `${Math.round((s.views / srcMax) * 100)}%` }} /></span>
                    <strong>{nf.format(s.views)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">“Link direto” inclui quem abriu sem link marcado. Use os links de <Link className="link" href={`/app/${slug}/compartilhar`}>Compartilhar</Link> para a bio e os Stories aparecerem separados.</p>
          </section>

          <section className="card stack" aria-labelledby="top-h">
            <h2 id="top-h">Peças que mais chamam atenção</h2>
            {r.products.length === 0 ? <p className="muted small">Nenhuma peça foi vista neste período.</p> : (
              <div className="table-wrap">
                <table className="perm-table">
                  <thead><tr><th>Peça</th><th>Situação</th><th>Vistas</th><th>WhatsApp</th><th>Avise-me</th></tr></thead>
                  <tbody>
                    {r.products.map((p) => (
                      <tr key={p.id}>
                        <td><Link className="link" href={`/app/${slug}/produtos/${p.id}`}>{p.name}</Link></td>
                        <td>{(STATUS_LABEL as Record<string, string>)[p.status] ?? p.status}</td>
                        <td>{nf.format(p.views)}</td><td>{nf.format(p.contacts)}</td><td>{nf.format(p.avise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted small">Muita visita e nenhum toque? Revise foto, preço e descrição. Muito “Avise-me”? Vale repor a peça (veja <Link className="link" href={`/app/${slug}/interessados`}>Interessadas</Link>).</p>
          </section>

          {r.collections.length > 0 && (
            <section className="card stack" aria-labelledby="col-h">
              <h2 id="col-h">Coleções mais vistas</h2>
              <ul className="bars">
                {r.collections.map((c) => (
                  <li key={c.id}><span>{c.name}</span><span className="bar-track"><i style={{ width: `${Math.round((c.views / Math.max(1, r.collections[0].views)) * 100)}%` }} /></span><strong>{nf.format(c.views)}</strong></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
