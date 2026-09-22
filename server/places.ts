import { distanceKm, type LatLng, type Lead } from '../src/lib/leads.js'

export interface SearchInput {
  query: string
  lat: number
  lng: number
  radiusMeters: number
  pageToken?: string
}

/** Valida o pedido vindo do navegador. Devolve a mensagem de erro, ou os dados limpos. */
export function parseSearchInput(body: unknown): SearchInput | string {
  if (!body || typeof body !== 'object') return 'pedido inválido'
  const b = body as Record<string, unknown>
  const query = typeof b.query === 'string' ? b.query.trim() : ''
  const lat = Number(b.lat)
  const lng = Number(b.lng)
  const radiusMeters = Number(b.radiusMeters)
  if (query.length < 2 || query.length > 80) return 'informe o tipo de comércio'
  // Limites aproximados do território brasileiro.
  if (!(lat >= -34 && lat <= 6 && lng >= -75 && lng <= -28)) return 'escolha um ponto dentro do Brasil'
  if (!(radiusMeters >= 500 && radiusMeters <= 50_000)) return 'raio inválido'
  const pageToken = typeof b.pageToken === 'string' && b.pageToken.length < 2000 ? b.pageToken : undefined
  return { query, lat, lng, radiusMeters, pageToken }
}

/** Campos pedidos ao Google. Cada campo extra pode mudar o preço da busca. */
export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.businessStatus',
  'nextPageToken',
].join(',')

export function buildGoogleRequest(input: SearchInput) {
  return {
    textQuery: input.query,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    pageSize: 20,
    locationBias: {
      circle: { center: { latitude: input.lat, longitude: input.lng }, radius: input.radiusMeters },
    },
    ...(input.pageToken ? { pageToken: input.pageToken } : {}),
  }
}

interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  nationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  businessStatus?: string
}

/**
 * Converte a resposta do Google em comércios da lista.
 * A busca "prefere" a região escolhida mas pode trazer lugares de fora; esses são descartados.
 */
export function toLeads(places: GooglePlace[] | undefined, center: LatLng, radiusMeters: number): Lead[] {
  const leads: Lead[] = []
  for (const p of places ?? []) {
    const lat = p.location?.latitude
    const lng = p.location?.longitude
    if (!p.id || lat === undefined || lng === undefined) continue
    const distance = distanceKm(center, { lat, lng })
    if (distance * 1000 > radiusMeters) continue
    leads.push({
      id: p.id,
      name: p.displayName?.text ?? 'Sem nome',
      address: p.formattedAddress ?? '',
      lat,
      lng,
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? 0,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      mapsUrl: p.googleMapsUri ?? null,
      operational: !p.businessStatus || p.businessStatus === 'OPERATIONAL',
      distanceKm: Math.round(distance * 10) / 10,
    })
  }
  return leads
}
