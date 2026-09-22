import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Niche } from '../data/niches'
import {
  createSaved, fetchPlaces, listSaved, removeSaved, updateSaved,
  type SavedLead, type SavedLeadPatch,
} from '../lib/crm'
import type { PlaceInfo } from '../lib/leads'

/** Funil de contatos compartilhado entre a prospecção e a tela "Meus contatos". */
export function useSavedLeads(enabled: boolean) {
  const [rows, setRows] = useState<SavedLead[]>([])
  const [places, setPlaces] = useState<Record<string, PlaceInfo>>({})
  // Comércios que o Google não devolveu (fechados ou removidos do Maps).
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const placesRef = useRef(places)
  placesRef.current = places

  /** Guarda dados de comércios já conhecidos (ex.: da busca), para não pedir de novo ao Google. */
  const seedPlaces = useCallback((list: PlaceInfo[]) => {
    if (list.length) setPlaces((prev) => ({ ...prev, ...Object.fromEntries(list.map((p) => [p.id, p])) }))
  }, [])

  const loadMissingPlaces = useCallback(
    async (list: SavedLead[]) => {
      const missing = list.map((r) => r.place_id).filter((id) => !placesRef.current[id])
      if (!missing.length) return
      try {
        const found = await fetchPlaces(missing)
        seedPlaces(found)
        setUnavailable((prev) => new Set([...prev, ...missing.filter((id) => !found.some((p) => p.id === id))]))
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [seedPlaces],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listSaved()
      setRows(list)
      seedPlaces(list.flatMap((r) => (r.place_snapshot ? [r.place_snapshot] : [])))
      await loadMissingPlaces(list.filter((r) => !r.place_snapshot))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loadMissingPlaces, seedPlaces])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  const save = useCallback(
    async (place: PlaceInfo, niche: Niche) => {
      setError('')
      try {
        seedPlaces([place])
        const row = await createSaved(place, niche)
        setRows((prev) => [row, ...prev.filter((r) => r.place_id !== row.place_id)])
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [seedPlaces],
  )

  const update = useCallback(async (id: string, patch: SavedLeadPatch) => {
    setError('')
    let before: SavedLead | undefined
    setRows((prev) => prev.map((r) => (r.id === id ? ((before = r), { ...r, ...patch }) : r)))
    try {
      const row = await updateSaved(id, patch)
      setRows((prev) => prev.map((r) => (r.id === id ? row : r)))
    } catch (e) {
      if (before) setRows((prev) => prev.map((r) => (r.id === id ? before! : r)))
      setError((e as Error).message)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setError('')
    try {
      await removeSaved(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const byPlaceId = useMemo(() => new Map(rows.map((r) => [r.place_id, r])), [rows])

  return { rows, places, unavailable, byPlaceId, loading, error, reload, seedPlaces, save, update, remove }
}

export type SavedLeadsApi = ReturnType<typeof useSavedLeads>
