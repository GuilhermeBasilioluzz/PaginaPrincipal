import { useMemo, useState } from 'react'
import type { SavedLeadsApi } from '../crm/useSavedLeads'
import { customNiche, getNiche, type Niche } from '../data/niches'
import { isOverdue, sortSaved, statuses, type LeadStatus, type SavedLead } from '../lib/crm'
import { whatsappUrl, type PlaceInfo } from '../lib/leads'

interface Props {
  crm: SavedLeadsApi
  onProspect: () => void
  onCreateProject: (place: PlaceInfo, niche: Niche) => void
}

type Filter = LeadStatus | 'all' | 'overdue'

function ContactCard({ row, place, crm, onCreateProject }: { row: SavedLead; place?: PlaceInfo } & Pick<Props, 'crm' | 'onCreateProject'>) {
  const title = place?.name ?? (crm.unavailable.has(row.place_id) ? 'Dados indisponíveis no Google' : 'Carregando dados do Google…')
  const [notes, setNotes] = useState(row.notes)
  const [contactName, setContactName] = useState(row.contact_name)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const niche = getNiche(row.niche_id) ?? customNiche(row.niche_label)
  const whatsapp = whatsappUrl(place?.phone ?? null)
  const overdue = isOverdue(row)

  return (
    <li className={`contact status-${row.status}`}>
      <div className="contact-head">
        <div>
          <h3>{title}</h3>
          <p className="muted small">
            {row.niche_label}
            {place?.address ? ` · ${place.address}` : ''}
          </p>
        </div>
        <select
          aria-label="Etapa do funil"
          className="contact-status"
          value={row.status}
          onChange={(e) => crm.update(row.id, { status: e.target.value as LeadStatus })}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lead-tags">
        {place && place.rating !== null && (
          <span className="tag">
            {place.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ★ ({place.reviews})
          </span>
        )}
        {place && !place.website && <span className="tag tag-hot">Sem site</span>}
        {overdue && <span className="tag tag-late">Retorno atrasado</span>}
      </div>

      <div className="contact-actions">
        {place?.phone && (
          <a className="btn btn-small btn-ghost" href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>
            Ligar {place.phone}
          </a>
        )}
        {whatsapp && (
          <a className="btn btn-small btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">
            WhatsApp ↗
          </a>
        )}
        {place?.mapsUrl && (
          <a className="btn btn-small btn-ghost" href={place.mapsUrl} target="_blank" rel="noreferrer">
            Google Maps ↗
          </a>
        )}
        {place && (
          <button className="btn btn-small btn-outline" onClick={() => onCreateProject(place, niche)}>
            Criar projeto
          </button>
        )}
      </div>

      <div className="contact-fields">
        <label className="field" htmlFor={`contact-name-${row.id}`}>
          <span className="field-title small">Responsável</span>
          <input
            id={`contact-name-${row.id}`}
            value={contactName}
            placeholder="Com quem falou"
            onChange={(e) => setContactName(e.target.value)}
            onBlur={() => contactName !== row.contact_name && crm.update(row.id, { contact_name: contactName })}
          />
        </label>
        <label className="field" htmlFor={`contact-next-${row.id}`}>
          <span className="field-title small">Próximo contato</span>
          <input
            id={`contact-next-${row.id}`}
            type="date"
            value={row.next_action_at ?? ''}
            onChange={(e) => crm.update(row.id, { next_action_at: e.target.value || null })}
          />
        </label>
      </div>
      <label className="field" htmlFor={`contact-notes-${row.id}`}>
        <span className="field-title small">Anotações</span>
        <textarea
          id={`contact-notes-${row.id}`}
          rows={2}
          value={notes}
          placeholder="Ex.: liguei, o dono volta na segunda; quer agendamento pelo WhatsApp"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== row.notes && crm.update(row.id, { notes })}
        />
      </label>

      <div className="contact-foot">
        {confirmRemove ? (
          <span className="confirm">
            Remover do funil?{' '}
            <button className="link danger" onClick={() => crm.remove(row.id)}>
              Sim, remover
            </button>{' '}
            <button className="link" onClick={() => setConfirmRemove(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button className="link muted-link" onClick={() => setConfirmRemove(true)}>
            Remover
          </button>
        )}
      </div>
    </li>
  )
}

export default function Contacts({ crm, onProspect, onCreateProject }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: crm.rows.length, overdue: crm.rows.filter((r) => isOverdue(r)).length }
    for (const s of statuses) c[s.id] = crm.rows.filter((r) => r.status === s.id).length
    return c
  }, [crm.rows])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sortSaved(crm.rows).filter((r) => {
      if (filter === 'overdue' ? !isOverdue(r) : filter !== 'all' && r.status !== filter) return false
      if (!term) return true
      const place = crm.places[r.place_id]
      return [place?.name, place?.address, r.niche_label, r.contact_name, r.notes].some((v) => v?.toLowerCase().includes(term))
    })
  }, [crm.rows, crm.places, filter, search])

  const won = counts.won ?? 0
  const decided = won + (counts.lost ?? 0)

  return (
    <section className="contacts">
      <p className="eyebrow">Funil de contatos</p>
      <h2 className="screen-title">Meus contatos</h2>
      <p className="muted">Acompanhe cada comércio, do primeiro contato ao fechamento.</p>

      {crm.rows.length > 0 && (
        <>
          <ol className="pipeline" aria-label="Contatos por etapa">
            {statuses.map((s) => (
              <li key={s.id}>
                <button
                  className={`pipeline-step status-${s.id}${filter === s.id ? ' active' : ''}`}
                  aria-pressed={filter === s.id}
                  onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
                >
                  <b>{counts[s.id]}</b>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="muted small">
            {decided > 0 && (
              <>
                Taxa de fechamento: <strong>{Math.round((won / decided) * 100)}%</strong> ({won} de {decided}{' '}
                {decided === 1 ? 'negociação concluída' : 'negociações concluídas'}).{' '}
              </>
            )}
            {counts.overdue > 0 && (
              <button className="link" onClick={() => setFilter('overdue')}>
                {counts.overdue} {counts.overdue === 1 ? 'retorno atrasado' : 'retornos atrasados'}
              </button>
            )}
          </p>

          <div className="contacts-toolbar">
            <input
              id="contacts-search"
              aria-label="Buscar nos contatos"
              value={search}
              placeholder="Buscar por nome, bairro, anotação…"
              onChange={(e) => setSearch(e.target.value)}
            />
            {filter !== 'all' && (
              <button className="link" onClick={() => setFilter('all')}>
                Mostrar todos ({counts.all})
              </button>
            )}
          </div>
        </>
      )}

      {crm.error && <p className="error">{crm.error}</p>}

      {crm.loading && crm.rows.length === 0 ? (
        <p className="muted center-text">Carregando…</p>
      ) : crm.rows.length === 0 ? (
        <div className="lead-empty">
          <strong>Nenhum contato salvo ainda.</strong>
          <p className="muted">Na prospecção, use “Salvar no funil” nos comércios que você quer abordar.</p>
          <button className="btn btn-primary" onClick={onProspect}>
            Prospectar clientes
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted lead-empty">Nenhum contato com esse filtro.</p>
      ) : (
        <ol className="contact-list">
          {visible.map((row) => (
            <ContactCard key={row.id} row={row} place={crm.places[row.place_id]} crm={crm} onCreateProject={onCreateProject} />
          ))}
        </ol>
      )}
    </section>
  )
}
