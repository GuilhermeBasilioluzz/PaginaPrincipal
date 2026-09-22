import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

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

/** Encontra uma cidade, bairro ou endereço no Brasil. */
export async function geocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  await loadMaps()
  const { results } = await new google.maps.Geocoder().geocode({ address, componentRestrictions: { country: 'BR' } })
  const first = results[0]
  if (!first) return null
  return { lat: first.geometry.location.lat(), lng: first.geometry.location.lng(), label: first.formatted_address }
}
