import type { Niche } from '../data/niches'
import type { PlaceInfo } from './leads'
import { demoMode, supabase } from './supabase'

export type LeadStatus = 'to_contact' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost'

/** Etapas do funil, na ordem. */
export const statuses: { id: LeadStatus; label: string }[] = [
  { id: 'to_contact', label: 'A contatar' },
  { id: 'contacted', label: 'Contatado' },
  { id: 'interested', label: 'Interessado' },
  { id: 'proposal', label: 'Proposta enviada' },
  { id: 'won', label: 'Fechado' },
  { id: 'lost', label: 'Sem interesse' },
]

export function statusLabel(id: LeadStatus): string {
  return statuses.find((s) => s.id === id)?.label ?? id
}

/** Uma linha da tabela `saved_leads`. */
export interface SavedLead {
  id: string
  place_id: string
  niche_id: string
  niche_label: string
  status: LeadStatus
  notes: string
  contact_name: string
  next_action_at: string | null
  /** Dados guardados do comércio (só OpenStreetMap; o Google não permite guardar). */
  place_snapshot: PlaceInfo | null
  created_at: string
  updated_at: string
}

export type SavedLeadPatch = Partial<Pick<SavedLead, 'status' | 'notes' | 'contact_name' | 'next_action_at'>>

// ---------- Modo demonstração: guarda no próprio navegador ----------
const DEMO_KEY = 'demo-saved-leads'
const DEMO_PLACES_KEY = 'demo-saved-places'
let demoRows: SavedLead[] | null = null

// Na demonstração os comércios são fictícios, então podem ficar guardados junto.
function demoPlaces(): Record<string, PlaceInfo> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_PLACES_KEY) ?? '{}') as Record<string, PlaceInfo>
  } catch {
    return {}
  }
}

function demoKeepPlace(place: PlaceInfo) {
  try {
    localStorage.setItem(DEMO_PLACES_KEY, JSON.stringify({ ...demoPlaces(), [place.id]: place }))
  } catch {
    // Sem armazenamento disponível.
  }
}

function demoLoad(): SavedLead[] {
  if (!demoRows) {
    try {
      demoRows = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as SavedLead[]
    } catch {
      demoRows = []
    }
  }
  return demoRows
}

function demoSave(rows: SavedLead[]) {
  demoRows = rows
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows))
  } catch {
    // Sem armazenamento disponível: os dados ficam só na memória.
  }
}

function db() {
  if (!supabase) throw new Error('Login não configurado.')
  return supabase.from('saved_leads')
}

function fail(message: string): never {
  throw new Error(message)
}

/** Só dados do OpenStreetMap podem ser guardados; os do Google são buscados de novo. */
export function canStore(place: PlaceInfo): boolean {
  return place.source === 'osm'
}

// ---------- Operações ----------
export async function listSaved(): Promise<SavedLead[]> {
  if (demoMode) return [...demoLoad()]
  const { data, error } = await db().select('*').order('updated_at', { ascending: false })
  if (error) fail('Não foi possível carregar os seus contatos.')
  return data as SavedLead[]
}

export async function createSaved(place: PlaceInfo, niche: Niche): Promise<SavedLead> {
  if (demoMode) {
    const now = new Date().toISOString()
    const row: SavedLead = {
      id: crypto.randomUUID(), place_id: place.id, niche_id: niche.id, niche_label: niche.label, status: 'to_contact',
      notes: '', contact_name: '', next_action_at: null, place_snapshot: null, created_at: now, updated_at: now,
    }
    demoSave([row, ...demoLoad().filter((r) => r.place_id !== place.id)])
    demoKeepPlace(place)
    return row
  }
  const { data, error } = await db()
    .upsert(
      { place_id: place.id, niche_id: niche.id, niche_label: niche.label, place_snapshot: canStore(place) ? place : null },
      { onConflict: 'user_id,place_id' },
    )
    .select()
    .single()
  if (error) fail('Não foi possível salvar este comércio.')
  return data as SavedLead
}

export async function updateSaved(id: string, patch: SavedLeadPatch): Promise<SavedLead> {
  const updated_at = new Date().toISOString()
  if (demoMode) {
    const rows = demoLoad().map((r) => (r.id === id ? { ...r, ...patch, updated_at } : r))
    demoSave(rows)
    return rows.find((r) => r.id === id) ?? fail('Contato não encontrado.')
  }
  const { data, error } = await db().update({ ...patch, updated_at }).eq('id', id).select().single()
  if (error) fail('Não foi possível salvar a alteração.')
  return data as SavedLead
}

export async function removeSaved(id: string): Promise<void> {
  if (demoMode) {
    demoSave(demoLoad().filter((r) => r.id !== id))
    return
  }
  const { error } = await db().delete().eq('id', id)
  if (error) fail('Não foi possível remover.')
}

/** Busca no Google os dados atuais (nome, endereço, telefone...) dos comércios salvos. */
export async function fetchPlaces(ids: string[]): Promise<PlaceInfo[]> {
  if (ids.length === 0) return []
  if (demoMode) {
    const stored = demoPlaces()
    return ids.map((id) => stored[id]).filter(Boolean)
  }
  // Só IDs do Google passam pelo servidor.
  ids = ids.filter((id) => !id.startsWith('osm:'))
  if (ids.length === 0) return []
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const places: PlaceInfo[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const res = await fetch('/api/places-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ ids: ids.slice(i, i + 50) }),
    })
    if (!res.ok) fail('Não foi possível atualizar os dados dos comércios.')
    places.push(...((await res.json()) as { places: PlaceInfo[] }).places)
  }
  return places
}

/** Ordem do funil: próximos contatos com data primeiro, depois os mais recentes. */
export function sortSaved(rows: SavedLead[]): SavedLead[] {
  return [...rows].sort((a, b) => {
    if (a.next_action_at && b.next_action_at) return a.next_action_at.localeCompare(b.next_action_at)
    if (a.next_action_at || b.next_action_at) return a.next_action_at ? -1 : 1
    return b.updated_at.localeCompare(a.updated_at)
  })
}

export function isOverdue(row: SavedLead, today = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(row.next_action_at && row.next_action_at < today && row.status !== 'won' && row.status !== 'lost')
}
