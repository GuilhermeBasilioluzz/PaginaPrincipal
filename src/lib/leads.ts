import type { Answers } from '../data/types'
import type { Niche } from '../data/niches'

/** Um comércio encontrado na busca do Google Maps. */
export interface Lead {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  rating: number | null
  reviews: number
  phone: string | null
  website: string | null
  mapsUrl: string | null
  /** false quando o Google marca como fechado temporária ou permanentemente. */
  operational: boolean
  distanceKm: number
}

export interface LatLng {
  lat: number
  lng: number
}

export type LeadSort = 'rating-desc' | 'rating-asc' | 'reviews-desc' | 'distance'

export interface LeadFilters {
  withoutWebsite: boolean
  withPhone: boolean
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Aplica filtros e ordenação. Comércios sem nota ficam sempre no fim. */
export function sortLeads(leads: Lead[], sort: LeadSort, filters: LeadFilters): Lead[] {
  const filtered = leads.filter((l) => (!filters.withoutWebsite || !l.website) && (!filters.withPhone || l.phone))
  const byRating = (dir: 1 | -1) => (a: Lead, b: Lead) => {
    if (a.rating === null || b.rating === null) return (a.rating === null ? 1 : 0) - (b.rating === null ? 1 : 0)
    return dir * (a.rating - b.rating) || b.reviews - a.reviews
  }
  const compare: Record<LeadSort, (a: Lead, b: Lead) => number> = {
    'rating-desc': byRating(-1),
    'rating-asc': byRating(1),
    'reviews-desc': (a, b) => b.reviews - a.reviews,
    distance: (a, b) => a.distanceKm - b.distanceKm,
  }
  return [...filtered].sort(compare[sort])
}

/** Respostas já preenchidas para criar o projeto de um comércio específico. */
export function answersFromLead(lead: Lead, niche: Niche): Answers {
  const reputation =
    lead.rating !== null ? `nota ${lead.rating.toLocaleString('pt-BR')} no Google (${lead.reviews} avaliações)` : 'sem avaliações no Google'
  const answers: Answers = {
    projectName: lead.name,
    description: `Sistema para ${lead.name} (${niche.label.toLowerCase()}), no endereço ${lead.address}, com ${niche.idea}.`,
    audience: `Clientes de ${lead.name} e moradores da região`,
    mainGoal: 'Captar clientes',
    extra: `Informações públicas do negócio: ${reputation}; ${lead.website ? `site atual: ${lead.website}` : 'ainda não possui site'}.`,
  }
  if (niche.categoryId === 'scheduling') answers.serviceType = niche.label
  if (niche.categoryId === 'landing') answers.business = `${niche.label}: ${lead.name}`
  return answers
}
