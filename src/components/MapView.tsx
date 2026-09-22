import { useEffect, useRef, useState } from 'react'
import type { LatLng, Lead } from '../lib/leads'
import { BRAZIL, loadMaps, mapId, mapsConfigured } from '../lib/maps'

interface Props {
  center: LatLng | null
  radiusKm: number
  leads: Lead[]
  selectedId: string | null
  onPick: (point: LatLng) => void
  onSelect: (id: string) => void
}

/** Zoom que enquadra o círculo de busca. */
function zoomForRadius(km: number): number {
  return km <= 1 ? 15 : km <= 3 ? 13 : km <= 5 ? 12 : km <= 10 ? 11 : 10
}

export default function MapView({ center, radiusKm, leads, selectedId, onPick, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<google.maps.Map | null>(null)
  const circle = useRef<google.maps.Circle | null>(null)
  const markers = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(mapsConfigured ? 'loading' : 'error')

  // Os callbacks mudam a cada render; o mapa usa sempre a versão mais recente.
  const handlers = useRef({ onPick, onSelect })
  handlers.current = { onPick, onSelect }

  useEffect(() => {
    if (!mapsConfigured || !el.current) return
    let cancelled = false
    loadMaps()
      .then(() => {
        if (cancelled || !el.current) return
        map.current = new google.maps.Map(el.current, {
          ...BRAZIL,
          mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) handlers.current.onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        })
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  // Círculo da área de busca.
  useEffect(() => {
    if (status !== 'ready' || !map.current) return
    if (!center) {
      circle.current?.setMap(null)
      return
    }
    if (!circle.current) {
      circle.current = new google.maps.Circle({
        map: map.current,
        clickable: false,
        strokeColor: '#2340e8',
        strokeWeight: 2,
        fillColor: '#2340e8',
        fillOpacity: 0.08,
      })
    }
    circle.current.setMap(map.current)
    circle.current.setCenter(center)
    circle.current.setRadius(radiusKm * 1000)
    map.current.panTo(center)
    map.current.setZoom(zoomForRadius(radiusKm))
  }, [status, center, radiusKm])

  // Marcadores dos comércios, com a nota no alfinete.
  useEffect(() => {
    if (status !== 'ready' || !map.current) return
    const current = markers.current
    const ids = new Set(leads.map((l) => l.id))
    for (const [id, marker] of current) {
      if (!ids.has(id)) {
        marker.map = null
        current.delete(id)
      }
    }
    for (const lead of leads) {
      if (current.has(lead.id)) continue
      const pin = document.createElement('div')
      pin.className = 'map-pin'
      pin.textContent = lead.rating !== null ? lead.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '–'
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: map.current,
        position: { lat: lead.lat, lng: lead.lng },
        title: lead.name,
        content: pin,
      })
      marker.addListener('click', () => handlers.current.onSelect(lead.id))
      current.set(lead.id, marker)
    }
  }, [status, leads])

  // Destaca o comércio selecionado.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const pin = marker.content as HTMLElement
      pin.classList.toggle('active', id === selectedId)
      marker.zIndex = id === selectedId ? 10 : null
      if (id === selectedId && marker.position) map.current?.panTo(marker.position)
    }
  }, [selectedId, leads])

  return (
    <div className="map-frame">
      <div ref={el} className="map-canvas" hidden={status === 'error'} />
      {status === 'loading' && <p className="map-message">Carregando o mapa…</p>}
      {status === 'error' && (
        <div className="map-message map-fallback">
          <strong>Mapa indisponível nesta versão</strong>
          <span>
            {mapsConfigured
              ? 'Não foi possível carregar o Google Maps. Confira a chave e as APIs ativadas.'
              : 'O mapa interativo aparece no site publicado. Aqui, escolha uma capital ou busque uma cidade acima.'}
          </span>
        </div>
      )}
    </div>
  )
}
