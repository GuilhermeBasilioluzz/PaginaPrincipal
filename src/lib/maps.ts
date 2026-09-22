import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { isGoogleKey } from './config'

// Só uma chave com o formato real do Google liga o modo Google; qualquer outro valor usa o mapa gratuito.
const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
const apiKey = isGoogleKey(rawKey) ? rawKey!.trim() : undefined

/** ID de estilo do mapa (Google Cloud → Map Management). O de demonstração serve para testes. */
export const mapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

export const mapsConfigured = Boolean(apiKey)

/** Centro e zoom que mostram o Brasil inteiro. */
export const BRAZIL = { center: { lat: -14.235, lng: -51.9253 }, zoom: 4 }

let loading: Promise<void> | null = null

/** Carrega o Google Maps uma única vez. */
export function loadMaps(): Promise<void> {
  if (!apiKey) return Promise.reject(new Error('Google Maps não configurado'))
  if (!loading) {
    setOptions({ key: apiKey, v: 'weekly', language: 'pt-BR', region: 'BR' })
    loading = Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('geocoding')]).then(() => undefined)
  }
  return loading
}

export interface GeocodeResult {
  lat: number
  lng: number
  label: string
}

/**
 * Encontra uma cidade, bairro ou endereço no Brasil.
 * Usa o Google quando configurado; senão, o Nominatim (gratuito, do OpenStreetMap).
 */
export async function geocode(address: string): Promise<GeocodeResult | null> {
  return apiKey ? geocodeGoogle(address) : geocodeNominatim(address)
}

async function geocodeNominatim(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ q: address, format: 'jsonv2', countrycodes: 'br', limit: '1', 'accept-language': 'pt-BR' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (!res.ok) throw new Error('Nominatim indisponível')
  const [first] = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  return first ? { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name } : null
}

async function geocodeGoogle(address: string): Promise<GeocodeResult | null> {
  await loadMaps()
  const { results } = await new google.maps.Geocoder().geocode({ address, componentRestrictions: { country: 'BR' } })
  const first = results[0]
  if (!first) return null
  return { lat: first.geometry.location.lat(), lng: first.geometry.location.lng(), label: first.formatted_address }
}
