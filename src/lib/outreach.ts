import type { Niche } from '../data/niches'
import type { PlaceInfo } from './leads'

export type MessageKind = 'first' | 'followup' | 'proposal'

export const messageKinds: { id: MessageKind; label: string }[] = [
  { id: 'first', label: 'Primeiro contato' },
  { id: 'followup', label: 'Retomar conversa' },
  { id: 'proposal', label: 'Enviar proposta' },
]

export interface MessageContext {
  place: PlaceInfo
  niche: Niche
  /** Nome de quem envia (quem comprou o sistema). */
  senderName?: string
  /** Nome do responsável pelo comércio, se já souber. */
  contactName?: string
}

function rating(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1 })
}

/** Elogio baseado na reputação pública do comércio. */
function compliment({ place }: MessageContext): string {
  if (place.rating !== null && place.rating >= 4.5 && place.reviews >= 20) {
    return `Vi que ${place.name} tem nota ${rating(place.rating)} no Google, com ${place.reviews} avaliações. Parabéns, dá para ver que os clientes gostam muito do trabalho de vocês.`
  }
  if (place.rating !== null && place.rating >= 4) {
    return `Encontrei ${place.name} no Google e as avaliações dos clientes são muito boas.`
  }
  return `Encontrei ${place.name} no Google Maps aqui na região.`
}

/** A oportunidade: sem site, ou com site que pode trazer mais clientes. */
function opportunity({ place }: MessageContext): string {
  return place.website
    ? 'Dei uma olhada no site de vocês e tive algumas ideias para ele trazer mais clientes.'
    : 'Percebi que vocês ainda não têm um site ou sistema próprio para atender os clientes pela internet.'
}

function hello(ctx: MessageContext): string {
  const name = ctx.contactName?.trim()
  return name ? `Olá, ${name}, tudo bem?` : 'Olá, tudo bem?'
}

function signature(ctx: MessageContext): string {
  const sender = ctx.senderName?.trim()
  return sender ? ` Aqui é ${sender}.` : ''
}

/** Monta a mensagem de abordagem para o WhatsApp. */
export function buildMessage(kind: MessageKind, ctx: MessageContext): string {
  const { place, niche } = ctx
  switch (kind) {
    case 'first':
      return [
        `${hello(ctx)}${signature(ctx)}`,
        `${compliment(ctx)} ${opportunity(ctx)}`,
        `Eu desenvolvo sistemas para ${niche.label.toLowerCase()} com ${niche.idea}.`,
        `Posso te mostrar em 10 minutos como ficaria para ${place.name}? Sem compromisso.`,
      ].join('\n\n')
    case 'followup':
      return [
        `${hello(ctx)}${signature(ctx)}`,
        `Passando para retomar nossa conversa sobre o sistema para ${place.name}, com ${niche.idea}.`,
        'Você consegue ver isso esta semana? Se preferir, a gente marca uma ligação rápida.',
      ].join('\n\n')
    case 'proposal':
      return [
        `${hello(ctx)}${signature(ctx)}`,
        `Preparei uma proposta para ${place.name} com ${niche.idea}.`,
        'Posso te enviar por aqui ou prefere que eu explique numa ligação rápida?',
      ].join('\n\n')
  }
}

/** Link que abre o WhatsApp com a mensagem já escrita. */
export function whatsappWithText(whatsappUrl: string, text: string): string {
  return `${whatsappUrl}?text=${encodeURIComponent(text)}`
}
