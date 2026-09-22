import { describe, expect, it } from 'vitest'
import { getNiche } from '../data/niches'
import type { PlaceInfo } from './leads'
import { buildMessage, whatsappWithText } from './outreach'

const niche = getNiche('barbearia')!
function place(partial: Partial<PlaceInfo>): PlaceInfo {
  return {
    id: 'p', name: 'Barbearia do Zé', address: 'Rua A', lat: 0, lng: 0, rating: 4.9, reviews: 312,
    phone: '(11) 98765-4321', website: null, mapsUrl: null, operational: true, ...partial,
  }
}

describe('buildMessage', () => {
  it('elogia a reputação e aponta a falta de site no primeiro contato', () => {
    const msg = buildMessage('first', { place: place({}), niche, senderName: 'Ana' })
    expect(msg).toContain('Olá, tudo bem? Aqui é Ana.')
    expect(msg).toContain('nota 4,9 no Google, com 312 avaliações')
    expect(msg).toContain('ainda não têm um site')
    expect(msg).toContain('agendamento online de horários')
    expect(msg).toContain('como ficaria para Barbearia do Zé?')
  })

  it('adapta o texto a comércios com site e com poucas avaliações', () => {
    const msg = buildMessage('first', { place: place({ rating: 3.8, reviews: 5, website: 'https://x.com' }), niche })
    expect(msg).toContain('Encontrei Barbearia do Zé no Google Maps')
    expect(msg).toContain('Dei uma olhada no site de vocês')
    expect(msg).not.toContain('Aqui é')
  })

  it('chama o responsável pelo nome no retorno e na proposta', () => {
    expect(buildMessage('followup', { place: place({}), niche, contactName: 'Carlos' })).toMatch(/^Olá, Carlos, tudo bem\?/)
    expect(buildMessage('proposal', { place: place({}), niche })).toContain('Preparei uma proposta para Barbearia do Zé')
  })
})

describe('whatsappWithText', () => {
  it('coloca a mensagem no link do WhatsApp', () => {
    expect(whatsappWithText('https://wa.me/5511987654321', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    )
  })
})
