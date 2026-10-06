import { z } from 'zod'
import { formatBRL } from './money'
import { normalizeWhatsapp, whatsappUrl } from './storeSettings'

export type InterestStatus = 'waiting' | 'contacted' | 'converted' | 'dismissed'
export const INTEREST_LABEL: Record<InterestStatus, string> = {
  waiting: 'Aguardando', contacted: 'Avisada', converted: 'Virou venda', dismissed: 'Dispensada',
}

export const productUrl = (siteUrl: string, storeSlug: string, productSlug: string) =>
  `${siteUrl.replace(/\/+$/, '')}/${storeSlug}/produto/${productSlug}`

type Interest = 'sold_out' | 'reserved' | 'available' | 'low'

/** Mensagem que a CLIENTE manda para a loja. O texto muda conforme a situação da peça. */
export function customerMessage(label: Interest, productName: string, link: string, price?: number): string {
  if (label === 'sold_out') {
    return `Oi! A peça "${productName}" está esgotada, mas tenho interesse em receber um aviso quando ela estiver disponível novamente. ${link}`
  }
  if (label === 'reserved') {
    return `Oi! A peça "${productName}" está reservada, mas tenho interesse caso ela fique disponível. Pode me avisar? ${link}`
  }
  return `Oi! Tenho interesse na peça "${productName}"${price !== undefined ? ` (${formatBRL(price)})` : ''}. ${link}`
}

/** Mensagem que a LOJA manda para quem estava esperando. */
export function restockMessage(customerName: string, productName: string, storeName: string, link: string, size?: string | null): string {
  const first = customerName.trim().split(/\s+/)[0] || ''
  return `Oi${first ? `, ${first}` : ''}! Boa notícia: a peça "${productName}"${size ? ` (tamanho ${size})` : ''} chegou de novo na ${storeName}. Quer que eu separe para você? ${link}`
}

export const restockWhatsappUrl = (contact: string, ...args: Parameters<typeof restockMessage>) =>
  whatsappUrl(contact, restockMessage(...args))

// ---- lista de espera (formulário da vendedora)
export const interestSchema = z.object({
  product: z.string().regex(/^[0-9a-f-]{36}$/i, 'Escolha a peça.'),
  name: z.string().trim().min(1, 'Informe o nome da cliente.').max(80, 'O nome é longo demais.'),
  contact: z.string().transform((v, ctx) => {
    const n = normalizeWhatsapp(v)
    if (!n) ctx.addIssue({ code: 'custom', message: 'Informe o WhatsApp da cliente com DDD, como (84) 99999-0000.' })
    return n ?? ''
  }),
  size: z.string().trim().max(12, 'O tamanho é longo demais.').optional(),
  note: z.string().trim().max(300, 'A observação é longa demais (máximo 300).').optional(),
})

export function readInterestForm(fd: FormData) {
  const t = (k: string) => String(fd.get(k) ?? '')
  const r = interestSchema.safeParse({ product: t('product'), name: t('name'), contact: t('contact'), size: t('size'), note: t('note') })
  if (!r.success) return { ok: false as const, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  return { ok: true as const, payload: { ...r.data, size: r.data.size ?? '', note: r.data.note ?? '' } }
}

export const INTEREST_STATUSES = ['waiting', 'contacted', 'converted', 'dismissed'] as const
export const isInterestStatus = (v: unknown): v is InterestStatus => (INTEREST_STATUSES as readonly string[]).includes(v as string)

export type InterestOverviewRow = {
  product_id: string; name: string; status: string; quantity: number | null; stock_state: 'ok' | 'low' | 'reserved' | 'out' | null
  clicks_30d: number; waiting: number; contacted: number; converted: number; last_at: string | null; sizes: Record<string, number>
}
export type InterestRow = {
  id: string; product_id: string; product_name: string; product_slug: string; customer_name: string; contact: string; size: string | null
  note: string | null; status: InterestStatus; created_at: string; handled_at: string | null; handled_by_name: string | null; total: number
}

/** Peças que VOLTARAM ao estoque e ainda têm gente esperando: é hora de avisar. */
export function restockedWithDemand(rows: InterestOverviewRow[]): InterestOverviewRow[] {
  return rows.filter((r) => r.waiting > 0 && (r.stock_state === 'ok' || r.stock_state === 'low'))
}
