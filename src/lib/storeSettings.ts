import { z } from 'zod'

/** "(84) 99999-0000" → "5584999990000". Aceita com ou sem 55; recusa o que não parece telefone. */
export function normalizeWhatsapp(input: string): string | null {
  if (input.trim() === '') return ''
  const digits = input.replace(/\D/g, '')
  if (digits === '') return null
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  return /^\d{10,15}$/.test(full) && (!full.startsWith('55') || full.length === 12 || full.length === 13) ? full : null
}

/** "@loja", "instagram.com/loja/", "https://www.instagram.com/loja?igsh=x" → "loja". */
export function normalizeInstagram(input: string): string | null {
  let s = input.trim()
  if (s === '') return ''
  // links só valem se forem do próprio Instagram (nunca aceitar outro domínio como se fosse um @)
  const looksLikeLink = /^https?:\/\//i.test(s) || s.includes('/')
  if (looksLikeLink && !/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(s)) return null
  s = s.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '').replace(/^@/, '')
  s = s.split(/[/?#]/)[0]
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null
}

export const whatsappUrl = (digits: string, text?: string) =>
  `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`

/** (84) 99999-0000 para exibir. Outros formatos voltam como vieram. */
export function formatWhatsapp(digits: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`
}

const opt = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional()

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da loja.').max(80, 'O nome é longo demais (máximo 80).'),
  tagline: opt(120),
  description: opt(600),
  whatsapp: z.string().transform((v, ctx) => {
    const n = normalizeWhatsapp(v)
    if (n === null) ctx.addIssue({ code: 'custom', message: 'WhatsApp inválido. Use o DDD e o número, como (84) 99999-0000.' })
    return n ?? ''
  }),
  instagram: z.string().transform((v, ctx) => {
    const n = normalizeInstagram(v)
    if (n === null) ctx.addIssue({ code: 'custom', message: 'Instagram inválido. Use só o @ da loja, como @minhaloja.' })
    return n ?? ''
  }),
  address: opt(200),
  hours: opt(200),
  accent: z.string().trim().refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Cor inválida. Use o formato #RRGGBB.'),
  catalogEnabled: z.boolean(),
  hideSoldOut: z.boolean(),
})

export type StoreSettingsPayload = {
  name: string; tagline: string | null; description: string | null; whatsapp: string | null; instagram_handle: string | null
  address: string | null; opening_hours: string | null; accent_color: string | null; catalog_enabled: boolean; hide_sold_out: boolean
}

const orNull = (v: string | undefined) => (v && v.length ? v : null)

export function readStoreSettings(fd: FormData): { ok: true; payload: StoreSettingsPayload } | { ok: false; error: string } {
  const t = (k: string) => String(fd.get(k) ?? '')
  const r = storeSettingsSchema.safeParse({
    name: t('name'), tagline: t('tagline'), description: t('description'), whatsapp: t('whatsapp'), instagram: t('instagram'),
    address: t('address'), hours: t('hours'), accent: t('accent'),
    catalogEnabled: fd.get('catalogEnabled') === 'on', hideSoldOut: fd.get('hideSoldOut') === 'on',
  })
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  const d = r.data
  return {
    ok: true,
    payload: {
      name: d.name, tagline: orNull(d.tagline), description: orNull(d.description), whatsapp: orNull(d.whatsapp),
      instagram_handle: orNull(d.instagram), address: orNull(d.address), opening_hours: orNull(d.hours),
      accent_color: orNull(d.accent), catalog_enabled: d.catalogEnabled, hide_sold_out: d.hideSoldOut,
    },
  }
}
