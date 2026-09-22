import type { Niche } from '../data/niches'
import { distanceKm, type LatLng, type Lead } from './leads'
import { demoMode, supabase } from './supabase'

export interface SearchParams {
  niche: Niche
  center: LatLng
  radiusKm: number
  pageToken?: string | null
}

export interface SearchResult {
  leads: Lead[]
  nextPageToken: string | null
}

const errors: Record<number, string> = {
  401: 'Sua sessão expirou. Entre de novo.',
  403: 'Seu acesso não está ativo.',
  502: 'O Google não respondeu. Tente de novo em instantes.',
}

export async function searchLeads({ niche, center, radiusKm, pageToken }: SearchParams): Promise<SearchResult> {
  if (demoMode) return demoLeads(niche, center, radiusKm)

  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const res = await fetch('/api/places-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ query: niche.query, lat: center.lat, lng: center.lng, radiusMeters: radiusKm * 1000, pageToken }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errors[res.status] ?? body.error ?? 'Não foi possível buscar agora.')
  }
  return res.json()
}

/**
 * Resultados fictícios para o modo demonstração (sem Google configurado).
 * Os nomes deixam claro que são exemplos.
 */
function demoLeads(niche: Niche, center: LatLng, radiusKm: number): SearchResult {
  const samples = [
    { rating: 4.9, reviews: 312, website: false, phone: true },
    { rating: 4.7, reviews: 158, website: true, phone: true },
    { rating: 4.4, reviews: 87, website: false, phone: true },
    { rating: 4.1, reviews: 41, website: false, phone: false },
    { rating: 3.6, reviews: 23, website: true, phone: true },
    { rating: null, reviews: 0, website: false, phone: true },
  ]
  const leads = samples.map((s, i) => {
    const angle = (i / samples.length) * 2 * Math.PI
    const spread = radiusKm * (0.25 + 0.12 * i) / 111
    const point = { lat: center.lat + spread * Math.sin(angle), lng: center.lng + spread * Math.cos(angle) }
    return {
      id: `exemplo-${i}`,
      name: `${niche.label} Exemplo ${i + 1}`,
      address: 'Endereço de exemplo',
      ...point,
      rating: s.rating,
      reviews: s.reviews,
      phone: s.phone ? '(00) 0000-0000' : null,
      website: s.website ? 'https://exemplo.com.br' : null,
      mapsUrl: null,
      operational: true,
      distanceKm: Math.round(distanceKm(center, point) * 10) / 10,
    }
  })
  return { leads, nextPageToken: null }
}
