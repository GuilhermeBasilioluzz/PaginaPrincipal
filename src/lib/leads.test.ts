import { describe, expect, it } from 'vitest'
import { getNiche } from '../data/niches'
import { answersFromLead, distanceKm, sortLeads, type Lead } from './leads'

function lead(partial: Partial<Lead>): Lead {
  return {
    id: partial.name ?? 'x', name: 'x', address: 'Rua A, 1 - São Paulo', lat: 0, lng: 0, rating: 4, reviews: 10,
    phone: '(11) 1234-5678', website: null, mapsUrl: null, operational: true, distanceKm: 1, ...partial,
  }
}

const list = [
  lead({ name: 'A', rating: 4.8, reviews: 50, distanceKm: 3, website: 'https://a.com' }),
  lead({ name: 'B', rating: 3.9, reviews: 200, distanceKm: 1 }),
  lead({ name: 'C', rating: null, reviews: 0, distanceKm: 0.5, phone: null }),
  lead({ name: 'D', rating: 4.8, reviews: 90, distanceKm: 2 }),
]
const none = { withoutWebsite: false, withPhone: false }
const names = (l: Lead[]) => l.map((x) => x.name).join('')

describe('sortLeads', () => {
  it('ordena por nota (empate: mais avaliações primeiro) com os sem nota no fim', () => {
    expect(names(sortLeads(list, 'rating-desc', none))).toBe('DABC')
    expect(names(sortLeads(list, 'rating-asc', none))).toBe('BDAC')
  })

  it('ordena por avaliações e por distância', () => {
    expect(names(sortLeads(list, 'reviews-desc', none))).toBe('BDAC')
    expect(names(sortLeads(list, 'distance', none))).toBe('CBDA')
  })

  it('filtra quem não tem site e quem tem telefone', () => {
    expect(names(sortLeads(list, 'distance', { withoutWebsite: true, withPhone: false }))).toBe('CBD')
    expect(names(sortLeads(list, 'distance', { withoutWebsite: true, withPhone: true }))).toBe('BD')
  })
})

describe('distanceKm', () => {
  it('calcula a distância entre São Paulo e Rio (~360 km)', () => {
    const d = distanceKm({ lat: -23.5505, lng: -46.6333 }, { lat: -22.9068, lng: -43.1729 })
    expect(d).toBeGreaterThan(350)
    expect(d).toBeLessThan(365)
  })
})

describe('answersFromLead', () => {
  it('preenche o projeto com os dados do comércio', () => {
    const a = answersFromLead(lead({ name: 'Barbearia do Zé', rating: 4.7, reviews: 120 }), getNiche('barbearia')!)
    expect(a.projectName).toBe('Barbearia do Zé')
    expect(a.description).toContain('agendamento online')
    expect(a.serviceType).toBe('Barbearia')
    expect(a.extra).toContain('nota 4,7 no Google (120 avaliações)')
    expect(a.extra).toContain('ainda não possui site')
  })
})
