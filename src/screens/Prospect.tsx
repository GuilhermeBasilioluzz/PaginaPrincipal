import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import MapView from '../components/MapView'
import type { SavedLeadsApi } from '../crm/useSavedLeads'
import { statuses, type LeadStatus } from '../lib/crm'
import { capitals, customNiche, niches, type Niche } from '../data/niches'
import { sortLeads, type LatLng, type Lead, type LeadFilters, type LeadSort } from '../lib/leads'
import { geocode, mapsConfigured } from '../lib/maps'
import { searchLeads, type SearchParams } from '../lib/prospect'

const radiusOptions = [1, 3, 5, 10, 20]

const sortLabels: Record<LeadSort, string> = {
  'rating-desc': 'Maiores notas',
  'rating-asc': 'Menores notas',
  'reviews-desc': 'Mais avaliações',
  distance: 'Mais perto',
}

interface Props {
  crm: SavedLeadsApi
  onCreateProject: (lead: Lead, niche: Niche) => void
}

function formatRating(rating: number) {
  return rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
}

export default function Prospect({ crm, onCreateProject }: Props) {
  const [nicheId, setNicheId] = useState('barbearia')
  const [otherNiche, setOtherNiche] = useState('')
  const [place, setPlace] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')
  const [center, setCenter] = useState<LatLng | null>(null)
  const [radiusKm, setRadiusKm] = useState(3)

  const [leads, setLeads] = useState<Lead[]>([])
  // Parâmetros da última busca: o "carregar mais" do Google exige repetir exatamente os mesmos.
  const [lastSearch, setLastSearch] = useState<SearchParams | null>(null)
  const searchedNiche = lastSearch?.niche ?? null
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<LeadSort>('rating-desc')
  const [filters, setFilters] = useState<LeadFilters>({ withoutWebsite: false, withPhone: false })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  const niche: Niche | null =
    nicheId === 'custom' ? (otherNiche.trim().length >= 2 ? customNiche(otherNiche) : null) : (niches.find((n) => n.id === nicheId) ?? null)
  const visible = useMemo(() => sortLeads(leads, sort, filters), [leads, sort, filters])
  const withoutSite = leads.filter((l) => !l.website).length

  useEffect(() => {
    if (!selectedId) return
    listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  function pick(point: LatLng, label: string) {
    setCenter(point)
    setPlaceLabel(label)
  }

  async function findPlace(e: FormEvent) {
    e.preventDefault()
    if (!place.trim()) return
    setError('')
    try {
      const found = await geocode(place)
      if (found) pick(found, found.label)
      else setError('Não encontramos esse lugar. Tente "bairro, cidade" ou só o nome da cidade.')
    } catch {
      setError('A busca de cidades não está disponível agora. Clique no mapa ou escolha uma capital.')
    }
  }

  async function search(more = false) {
    const params: SearchParams | null = more
      ? lastSearch && { ...lastSearch, pageToken: nextPageToken }
      : niche && center && { niche, center, radiusKm }
    if (!params) return
    setLoading(true)
    setError('')
    try {
      const result = await searchLeads(params)
      crm.seedPlaces(result.leads)
      setNextPageToken(result.nextPageToken)
      if (more) {
        setLeads((prev) => [...prev, ...result.leads.filter((l) => !prev.some((p) => p.id === l.id))])
      } else {
        setLastSearch(params)
        setLeads(result.leads)
        setSelectedId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível buscar agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="prospect">
      <p className="eyebrow">Prospecção</p>
      <h2 className="screen-title">Encontre comércios para atender</h2>
      <p className="muted">
        Escolha o tipo de negócio e o lugar. Você vê quem existe na região, com nota, avaliações, telefone e site, e cria
        o projeto do sistema para cada um.
      </p>

      <div className="card prospect-controls">
        <fieldset className="field">
          <legend>1. Tipo de comércio</legend>
          <div className="chips">
            {niches.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`chip${nicheId === n.id ? ' active' : ''}`}
                aria-pressed={nicheId === n.id}
                onClick={() => setNicheId(n.id)}
              >
                {n.label}
              </button>
            ))}
            <button
              type="button"
              className={`chip${nicheId === 'custom' ? ' active' : ''}`}
              aria-pressed={nicheId === 'custom'}
              onClick={() => setNicheId('custom')}
            >
              Outro…
            </button>
          </div>
          {nicheId === 'custom' && (
            <input
              id="prospect-other"
              aria-label="Outro tipo de comércio"
              value={otherNiche}
              placeholder="Ex.: floricultura, lava-rápido, ótica"
              onChange={(e) => setOtherNiche(e.target.value)}
            />
          )}
        </fieldset>

        <div className="field">
          <span className="field-title">2. Onde</span>
          <form className="place-search" onSubmit={findPlace}>
            <input
              id="prospect-place"
              aria-label="Cidade, bairro ou endereço"
              value={place}
              disabled={!mapsConfigured}
              placeholder={mapsConfigured ? 'Cidade, bairro ou endereço' : 'Busca de cidades disponível no site publicado'}
              onChange={(e) => setPlace(e.target.value)}
            />
            <button className="btn btn-outline" disabled={!mapsConfigured || !place.trim()}>
              Localizar
            </button>
          </form>
          <div className="chips chips-small">
            {capitals.map((c) => (
              <button key={c.name} type="button" className="chip" onClick={() => pick(c, c.name)}>
                {c.name}
              </button>
            ))}
          </div>
          <p className="muted small">
            {placeLabel ? (
              <>
                Centro da busca: <strong>{placeLabel}</strong>
              </>
            ) : mapsConfigured ? (
              'Ou clique em qualquer ponto do mapa.'
            ) : (
              'Escolha uma capital para testar.'
            )}
          </p>
        </div>

        <div className="prospect-go">
          <label className="field" htmlFor="prospect-radius">
            <span className="field-title">3. Raio</span>
            <select id="prospect-radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              {radiusOptions.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" disabled={!niche || !center || loading} onClick={() => search()}>
            {loading && !leads.length ? 'Buscando…' : 'Buscar comércios'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="prospect-results">
        <MapView
          center={center}
          radiusKm={radiusKm}
          leads={visible}
          selectedId={selectedId}
          onPick={(p) => pick(p, `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} (ponto no mapa)`)}
          onSelect={setSelectedId}
        />

        <div className="lead-panel">
          {searchedNiche ? (
            <>
              <div className="lead-toolbar">
                <p>
                  {searchedNiche.label}: <strong>{leads.length}</strong> {leads.length === 1 ? 'comércio' : 'comércios'} ·{' '}
                  <strong>{withoutSite}</strong> sem site
                </p>
                <div className="lead-toolbar-row">
                  <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as LeadSort)}>
                    {Object.entries(sortLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={filters.withoutWebsite}
                      onChange={(e) => setFilters({ ...filters, withoutWebsite: e.target.checked })}
                    />
                    Sem site
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={filters.withPhone}
                      onChange={(e) => setFilters({ ...filters, withPhone: e.target.checked })}
                    />
                    Com telefone
                  </label>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="muted lead-empty">Nenhum comércio com esses filtros. Aumente o raio ou mude os filtros.</p>
              ) : (
                <ol className="lead-list" ref={listRef}>
                  {visible.map((lead) => (
                    <li
                      key={lead.id}
                      data-id={lead.id}
                      className={`lead${lead.id === selectedId ? ' selected' : ''}`}
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <div className="lead-head">
                        <h3>{lead.name}</h3>
                        {lead.rating === null ? (
                          <span className="lead-rating muted">Sem avaliações</span>
                        ) : (
                          <span className="lead-rating" title={`${lead.reviews} avaliações no Google`}>
                            <b>{formatRating(lead.rating)}</b> ★ <span>({lead.reviews})</span>
                          </span>
                        )}
                      </div>
                      <p className="muted small">
                        {lead.address} · {lead.distanceKm.toLocaleString('pt-BR')} km
                      </p>
                      <div className="lead-tags">
                        {!lead.website && <span className="tag tag-hot">Sem site</span>}
                        {!lead.operational && <span className="tag">Fechado</span>}
                        {lead.phone && <span className="tag">{lead.phone}</span>}
                        {lead.website && (
                          <a className="tag" href={lead.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            Site atual ↗
                          </a>
                        )}
                        {lead.mapsUrl && (
                          <a className="tag" href={lead.mapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            Ver no Google Maps ↗
                          </a>
                        )}
                      </div>
                      <div className="lead-actions" onClick={(e) => e.stopPropagation()}>
                        {crm.byPlaceId.get(lead.id) ? (
                          <label className="saved-status">
                            <span>No funil:</span>
                            <select
                              aria-label={`Etapa do funil de ${lead.name}`}
                              value={crm.byPlaceId.get(lead.id)!.status}
                              onChange={(e) =>
                                crm.update(crm.byPlaceId.get(lead.id)!.id, { status: e.target.value as LeadStatus })
                              }
                            >
                              {statuses.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <button className="btn btn-small btn-primary" onClick={() => crm.save(lead, searchedNiche)}>
                            Salvar no funil
                          </button>
                        )}
                        <button className="btn btn-small btn-outline" onClick={() => onCreateProject(lead, searchedNiche)}>
                          Criar projeto
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {nextPageToken && (
                <button className="btn btn-ghost btn-block" disabled={loading} onClick={() => search(true)}>
                  {loading ? 'Carregando…' : 'Carregar mais comércios'}
                </button>
              )}
              <p className="attribution">Dados do Google Maps</p>
            </>
          ) : (
            <div className="lead-empty">
              <strong>Os comércios aparecem aqui.</strong>
              <p className="muted">
                Dica: comece pelos que têm <b>nota alta e nenhum site</b>. São negócios com clientes satisfeitos que ainda
                não têm presença digital própria.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
