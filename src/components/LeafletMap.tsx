import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng, Lead } from '../lib/leads'
import { BRAZIL } from '../lib/maps'

interface Props {
  center: LatLng | null
  radiusKm: number
  leads: Lead[]
  selectedId: string | null
  onPick: (point: LatLng) => void
  onSelect: (id: string) => void
}

/**
 * Imagens do mapa. O servidor padrão do OpenStreetMap é gratuito para uso moderado;
 * com muito tráfego, troque por um provedor (VITE_MAP_TILE_URL), conforme o guia.
 */
const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">colaboradores do OpenStreetMap</a>'

function zoomForRadius(km: number): number {
  return km <= 1 ? 15 : km <= 3 ? 13 : km <= 5 ? 12 : km <= 10 ? 11 : 10
}

function pinIcon(lead: Lead, active: boolean) {
  const label = lead.rating !== null ? lead.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : ''
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${active ? ' active' : ''}${label ? '' : ' map-pin-dot'}">${label}</div>`,
    iconSize: undefined,
  })
}

/** Mapa gratuito (Leaflet + OpenStreetMap), com a mesma interface do mapa do Google. */
export default function LeafletMap({ center, radiusKm, leads, selectedId, onPick, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const circle = useRef<L.Circle | null>(null)
  const markers = useRef(new Map<string, { marker: L.Marker; lead: Lead }>())
  const handlers = useRef({ onPick, onSelect })
  handlers.current = { onPick, onSelect }

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { center: [BRAZIL.center.lat, BRAZIL.center.lng], zoom: BRAZIL.zoom })
    m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>')
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => handlers.current.onPick({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.current = m
    // O mapa pode nascer escondido (aba oculta); recalcula o tamanho quando ficar visível.
    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(el.current)
    return () => {
      observer.disconnect()
      m.remove()
      map.current = null
      circle.current = null
      markers.current.clear()
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!center) {
      circle.current?.remove()
      circle.current = null
      return
    }
    if (!circle.current) {
      circle.current = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: '#2340e8',
        weight: 2,
        fillColor: '#2340e8',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(m)
    }
    circle.current.setLatLng([center.lat, center.lng])
    circle.current.setRadius(radiusKm * 1000)
    m.setView([center.lat, center.lng], zoomForRadius(radiusKm))
  }, [center, radiusKm])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const current = markers.current
    const ids = new Set(leads.map((l) => l.id))
    for (const [id, entry] of current) {
      if (!ids.has(id)) {
        entry.marker.remove()
        current.delete(id)
      }
    }
    for (const lead of leads) {
      if (current.has(lead.id)) continue
      const marker = L.marker([lead.lat, lead.lng], { icon: pinIcon(lead, false), title: lead.name, keyboard: true })
      marker.on('click', () => handlers.current.onSelect(lead.id))
      marker.addTo(m)
      current.set(lead.id, { marker, lead })
    }
  }, [leads])

  useEffect(() => {
    for (const [id, { marker, lead }] of markers.current) {
      const active = id === selectedId
      marker.setIcon(pinIcon(lead, active))
      marker.setZIndexOffset(active ? 1000 : 0)
      if (active) map.current?.panTo(marker.getLatLng())
    }
  }, [selectedId, leads])

  return (
    <div className="map-frame">
      <div ref={el} className="map-canvas" />
    </div>
  )
}
