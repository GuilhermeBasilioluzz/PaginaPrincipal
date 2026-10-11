import { z } from 'zod'
import { ROLE_LABEL, type Role } from './permissions'

export const INVITE_ROLES = ['attendant', 'manager'] as const
export const INVITE_DAYS = { '1': 'Vale por 1 dia', '3': 'Vale por 3 dias', '7': 'Vale por 7 dias', '14': 'Vale por 14 dias', '30': 'Vale por 30 dias' } as const
export const INVITE_USES = { '1': 'Uma pessoa só', '2': 'Até 2 pessoas', '5': 'Até 5 pessoas', '10': 'Até 10 pessoas' } as const

/** O código do convite: 64 caracteres hexadecimais. Qualquer outra coisa nem vai ao banco. */
export const isInviteToken = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

export const inviteUrl = (siteUrl: string, token: string) => `${siteUrl.replace(/\/+$/, '')}/convite/${token}`

export const createInviteSchema = z.object({
  role: z.enum(INVITE_ROLES, { message: 'Escolha o papel.' }),
  label: z.string().trim().max(80, 'O nome é longo demais (máximo 80).').optional(),
  days: z.string().refine((v) => v in INVITE_DAYS, 'Prazo inválido.'),
  uses: z.string().refine((v) => v in INVITE_USES, 'Número de pessoas inválido.'),
})

export function readInviteForm(fd: FormData) {
  const t = (k: string) => String(fd.get(k) ?? '')
  const r = createInviteSchema.safeParse({ role: t('role'), label: t('label'), days: t('days') || '7', uses: t('uses') || '1' })
  if (!r.success) return { ok: false as const, error: r.error.issues[0]?.message ?? 'Dados inválidos.' }
  return { ok: true as const, payload: { role: r.data.role, label: r.data.label ?? '', days: Number(r.data.days), uses: Number(r.data.uses) } }
}

/** Mensagem pronta para o dono mandar o convite no WhatsApp. */
export function inviteMessage(storeName: string, role: Role, url: string, days: number): string {
  return `Oi! Você foi convidada para ajudar a cuidar do catálogo da ${storeName} no Hyperion, como ${ROLE_LABEL[role].toLowerCase()}. Entre por este link (vale por ${days} ${days === 1 ? 'dia' : 'dias'}): ${url}`
}

export const INVITE_STATUS_LABEL = { active: 'Ativo', used: 'Já usado', expired: 'Vencido', revoked: 'Revogado' } as const
export type InviteStatus = keyof typeof INVITE_STATUS_LABEL

export type InviteRow = {
  id: string; role: Role; label: string | null; uses: number; max_uses: number; expires_at: string; revoked_at: string | null
  created_at: string; created_by_name: string | null; status: InviteStatus
}

export const INVITE_PROBLEM: Record<string, string> = {
  not_found: 'Este convite não existe. Confira o link com quem convidou.',
  revoked: 'Este convite foi cancelado. Peça um novo a quem convidou.',
  used: 'Este convite já foi usado. Peça um novo a quem convidou.',
  expired: 'Este convite venceu. Peça um novo a quem convidou.',
  store_inactive: 'Esta loja está temporariamente desativada.',
}

export function inviteErrorCode(error: { code?: string; message?: string }): string {
  const m = error.message ?? ''
  if (m.includes('invite_not_found')) return 'not_found'
  if (m.includes('invite_revoked')) return 'revoked'
  if (m.includes('invite_used')) return 'used'
  if (m.includes('invite_expired')) return 'expired'
  if (m.includes('store_inactive')) return 'store_inactive'
  if (error.code === '28000') return 'login'
  if (error.code === '42501') return 'forbidden'
  return 'generic'
}
