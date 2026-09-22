import { distanceKm, type LatLng, type Lead } from '../src/lib/leads.js'

/** Servidor público do Overpass (busca de lugares do OpenStreetMap). Pode ser trocado por OVERPASS_URL. */
export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/** Máximo de comércios por busca, para respeitar o uso justo do servidor gratuito. */
export const OSM_LIMIT = 150

/** Chaves do OpenStreetMap que indicam um estabelecimento (usado na busca por texto livre). */
const BUSINESS_KEYS = ['shop', 'amenity', 'office', 'craft', 'leisure', 'healthcare']

/** Deixa só letras, números e espaços: o texto livre vira um filtro seguro por nome. */
export function sanitizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/** Filtros para um texto livre: estabelecimentos cujo nome contém o texto. */
export function customSelectors(text: string): string[] {
  const clean = sanitizeText(text)
  if (clean.length < 2) return []
  return BUSINESS_KEYS.map((key) => `["${key}"]["name"~"${clean}",i]`)
}

export function buildOverpassQuery(selectors: string[], center: LatLng, radiusMeters: number): string {
  const around = `(around:${Math.round(radiusMeters)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`
  const parts = selectors.map((s) => `  nwr${s}${around};`).join('\n')
  return `[out:json][timeout:25];\n(\n${parts}\n);\nout center tags ${OSM_LIMIT};`
}

interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function address(tags: Record<string, string>): string {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ')
  const area = tags['addr:suburb'] ?? tags['addr:neighbourhood']
  const city = tags['addr:city']
  return [street, area, city].filter(Boolean).join(' - ')
}

/** Link gratuito que abre a busca do comércio no Google Maps (onde a pessoa vê as avaliações). */
export function googleMapsSearchUrl(name: string, addr: string, point: LatLng): string {
  const query = addr ? `${name}, ${addr}` : `${name} ${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Converte a resposta do Overpass em comércios da lista (sem nome ou fora do raio ficam de fora). */
export function osmToLeads(elements: OsmElement[] | undefined, center: LatLng, radiusMeters: number): Lead[] {
  const seen = new Set<string>()
  const leads: Lead[] = []
  for (const el of elements ?? []) {
    const tags = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    const name = tags.name?.trim()
    if (!name || lat === undefined || lng === undefined) continue
    const id = `osm:${el.type}/${el.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const distance = distanceKm(center, { lat, lng })
    if (distance * 1000 > radiusMeters) continue
    const addr = address(tags)
    leads.push({
      id,
      source: 'osm',
      name,
      address: addr || 'Endereço não informado',
      lat,
      lng,
      rating: null,
      reviews: 0,
      phone: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null,
      website: tags.website ?? tags['contact:website'] ?? null,
      mapsUrl: googleMapsSearchUrl(name, addr, { lat, lng }),
      operational: !tags['disused:shop'] && !tags['disused:amenity'],
      distanceKm: Math.round(distance * 10) / 10,
    })
  }
  return leads
}

/** Busca no Overpass. Lança erro se o servidor gratuito estiver ocupado ou fora do ar. */
export async function searchOsm(selectors: string[], center: LatLng, radiusMeters: number): Promise<Lead[]> {
  const res = await fetch(process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PromptForge/1.0 (prospeccao de comercios)',
    },
    body: new URLSearchParams({ data: buildOverpassQuery(selectors, center, radiusMeters) }),
  })
  if (!res.ok) throw new Error(`Overpass respondeu ${res.status}`)
  const data = (await res.json()) as { elements?: OsmElement[] }
  return osmToLeads(data.elements, center, radiusMeters)
}
