import { getNiche } from '../src/data/niches.js'
import { distanceKm, type LatLng, type Lead, type PlaceInfo } from '../src/lib/leads.js'
import { customSelectors, sanitizeText } from './osm.js'

export type Provider = 'google' | 'osm'

export interface SearchInput {
  /** Fonte pedida pelo navegador: 'google' só quando a tela usa o mapa do Google. */
  provider: Provider
  /** Texto de busca no Google (nome do nicho ou texto livre). */
  query: string
  /** Filtros do OpenStreetMap para o mesmo nicho. */
  osmSelectors: string[]
  lat: number
  lng: number
  radiusMeters: number
  pageToken?: string
}

/** Valida o pedido vindo do navegador. Devolve a mensagem de erro, ou os dados limpos. */
export function parseSearchInput(body: unknown): SearchInput | string {
  if (!body || typeof body !== 'object') return 'pedido inválido'
  const b = body as Record<string, unknown>
  const lat = Number(b.lat)
  const lng = Number(b.lng)
  const radiusMeters = Number(b.radiusMeters)

  // O nicho é resolvido aqui no servidor: o navegador nunca envia filtros prontos.
  let query = ''
  let osmSelectors: string[] = []
  const niche = typeof b.nicheId === 'string' ? getNiche(b.nicheId) : undefined
  if (niche) {
    query = niche.query
    osmSelectors = niche.osm
  } else if (b.nicheId === 'custom' && typeof b.text === 'string') {
    query = sanitizeText(b.text)
    osmSelectors = customSelectors(b.text)
  }
  if (query.length < 2) return 'informe o tipo de comércio'
  // Limites aproximados do território brasileiro.
  if (!(lat >= -34 && lat <= 6 && lng >= -75 && lng <= -28)) return 'escolha um ponto dentro do Brasil'
  if (!(radiusMeters >= 500 && radiusMeters <= 50_000)) return 'raio inválido'
  const pageToken = typeof b.pageToken === 'string' && b.pageToken.length < 2000 ? b.pageToken : undefined
  const provider: Provider = b.provider === 'google' ? 'google' : 'osm'
  return { provider, query, osmSelectors, lat, lng, radiusMeters, pageToken }
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

export interface GooglePlace {
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

/** Converte um lugar do Google no formato usado pelo site. */
export function toPlaceInfo(p: GooglePlace): PlaceInfo | null {
  const lat = p.location?.latitude
  const lng = p.location?.longitude
  if (!p.id || lat === undefined || lng === undefined) return null
  return {
    id: p.id,
    source: 'google',
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
  }
}

/**
 * Converte a resposta da busca em comércios da lista.
 * A busca "prefere" a região escolhida mas pode trazer lugares de fora; esses são descartados.
 */
export function toLeads(places: GooglePlace[] | undefined, center: LatLng, radiusMeters: number): Lead[] {
  const leads: Lead[] = []
  for (const p of places ?? []) {
    const place = toPlaceInfo(p)
    if (!place) continue
    const distance = distanceKm(center, place)
    if (distance * 1000 > radiusMeters) continue
    leads.push({ ...place, distanceKm: Math.round(distance * 10) / 10 })
  }
  return leads
}

/** Campos pedidos no detalhe de um lugar (mesmos da busca, sem o prefixo "places."). */
export const DETAILS_FIELD_MASK = FIELD_MASK.split(',')
  .filter((f) => f.startsWith('places.'))
  .map((f) => f.slice('places.'.length))
  .join(',')

/** Máximo de comércios atualizados por pedido. */
export const MAX_DETAILS_IDS = 50

/** Valida a lista de IDs do Google enviada pelo navegador. */
export function parseDetailsInput(body: unknown): string[] | string {
  const ids = (body as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids) || ids.length === 0) return 'nenhum comércio informado'
  if (ids.length > MAX_DETAILS_IDS) return `no máximo ${MAX_DETAILS_IDS} comércios por vez`
  if (!ids.every((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(id))) return 'identificador inválido'
  return [...new Set(ids as string[])]
}
