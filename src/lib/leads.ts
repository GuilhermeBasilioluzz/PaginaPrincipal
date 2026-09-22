import type { Answers } from '../data/types'
import type { Niche } from '../data/niches'

/** De onde vieram os dados: Google (com notas), OpenStreetMap (grátis, sem notas) ou exemplos. */
export type LeadSource = 'google' | 'osm' | 'demo'

/** Um comércio encontrado na prospecção. */
export interface Lead {
  id: string
  source: LeadSource
  name: string
  address: string
  lat: number
  lng: number
  /** Nota no Google; null quando não há nota ou a fonte não informa (OpenStreetMap). */
  rating: number | null
  reviews: number
  phone: string | null
  website: string | null
  mapsUrl: string | null
  /** false quando o Google marca como fechado temporária ou permanentemente. */
  operational: boolean
  distanceKm: number
}

/** Dados de um comércio vindos do Google, sem a distância (usado no funil de contatos). */
export type PlaceInfo = Omit<Lead, 'distanceKm'>

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
export function answersFromLead(lead: PlaceInfo, niche: Niche): Answers {
  const reputation =
    lead.rating !== null
      ? `nota ${lead.rating.toLocaleString('pt-BR')} no Google (${lead.reviews} avaliações)`
      : lead.source === 'google'
        ? 'sem avaliações no Google'
        : null
  // No OpenStreetMap, "sem site" pode ser só falta de cadastro.
  const site = lead.website
    ? `site atual: ${lead.website}`
    : lead.source === 'osm'
      ? 'site não informado (confirmar com o dono)'
      : 'ainda não possui site'
  const answers: Answers = {
    projectName: lead.name,
    description: `Sistema para ${lead.name} (${niche.label.toLowerCase()}), no endereço ${lead.address}, com ${niche.idea}.`,
    audience: `Clientes de ${lead.name} e moradores da região`,
    mainGoal: 'Captar clientes',
    extra: `Informações públicas do negócio: ${[reputation, site].filter(Boolean).join('; ')}.`,
  }
  if (niche.categoryId === 'scheduling') answers.serviceType = niche.label
  if (niche.categoryId === 'landing') answers.business = `${niche.label}: ${lead.name}`
  return answers
}

/** Link de WhatsApp para celulares brasileiros; null para telefones fixos. */
export function whatsappUrl(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '').replace(/^0+/, '').replace(/^55(?=\d{10,11}$)/, '') ?? ''
  // Celular: DDD (2 dígitos) + 9 + 8 dígitos.
  return /^\d{2}9\d{8}$/.test(digits) ? `https://wa.me/55${digits}` : null
}
