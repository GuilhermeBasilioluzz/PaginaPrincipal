import { describe, expect, it } from 'vitest'
import { INVITE_DAYS, inviteErrorCode, inviteMessage, inviteUrl, isInviteToken, readInviteForm } from './invites'
import { describeActivity } from './activity'
import { PERMISSION_TABLE, can } from './permissions'

function form(o: Record<string, string>) { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }

describe('convites', () => {
  it('só aceita código de 64 hexadecimais', () => {
    const ok = 'a'.repeat(64)
    expect(isInviteToken(ok)).toBe(true)
    for (const bad of ['', 'abc', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), '../../etc', null, undefined, 5]) expect(isInviteToken(bad)).toBe(false)
  })
  it('monta o link', () => {
    expect(inviteUrl('https://x.com/', 'abc')).toBe('https://x.com/convite/abc')
  })
  it('lê o formulário e usa os padrões (7 dias, 1 pessoa)', () => {
    const r = readInviteForm(form({ role: 'attendant', label: ' Para a Ana ' }))
    expect(r.ok && r.payload).toEqual({ role: 'attendant', label: 'Para a Ana', days: 7, uses: 1 })
  })
  it('recusa dono, prazo ou número inventado', () => {
    expect(readInviteForm(form({ role: 'owner' })).ok).toBe(false)
    expect(readInviteForm(form({ role: 'manager', days: '999' })).ok).toBe(false)
    expect(readInviteForm(form({ role: 'manager', uses: '500' })).ok).toBe(false)
    expect(readInviteForm(form({ role: 'manager', label: 'x'.repeat(81) })).ok).toBe(false)
    expect(Object.keys(INVITE_DAYS)).toContain('7')
  })
  it('mensagem do WhatsApp', () => {
    const m = inviteMessage('Boutique Aurora', 'attendant', 'https://x/convite/t', 7)
    expect(m).toContain('Boutique Aurora')
    expect(m).toContain('atendente')
    expect(m).toContain('vale por 7 dias')
    expect(inviteMessage('A', 'manager', 'u', 1)).toContain('vale por 1 dia)')
  })
  it('traduz os erros do banco em códigos curtos', () => {
    expect(inviteErrorCode({ message: 'invite_expired' })).toBe('expired')
    expect(inviteErrorCode({ message: 'invite_used' })).toBe('used')
    expect(inviteErrorCode({ message: 'invite_revoked' })).toBe('revoked')
    expect(inviteErrorCode({ message: 'invite_not_found', code: 'P0002' })).toBe('not_found')
    expect(inviteErrorCode({ code: '28000' })).toBe('login')
    expect(inviteErrorCode({ code: '42501' })).toBe('forbidden')
    expect(inviteErrorCode({ message: 'x' })).toBe('generic')
  })
})

describe('frases do histórico', () => {
  const a = (action: string, details = {}, o = {}) => describeActivity({ action, details, entity_name: 'Vestido', actor_name: 'Bruno', ...o })
  it('produto', () => {
    expect(a('product.created', { price: 189.9 }).replace(/\s/g, ' ')).toBe('Bruno cadastrou "Vestido" por R$ 189,90')
    expect(a('product.status', { from: 'available', to: 'sold' })).toBe('Bruno mudou "Vestido" de disponível para vendido/esgotado')
    expect(a('product.deleted')).toBe('Bruno excluiu "Vestido"')
  })
  it('edição lista o que mudou, com antes e depois do preço', () => {
    const t = a('product.updated', { changes: { price: [100, 120], name: ['a', 'b'], sizes: [[], ['P']] } }).replace(/\s/g, ' ')
    expect(t).toBe('Bruno alterou o preço (R$ 100,00 → R$ 120,00), o nome e os tamanhos de "Vestido"')
    expect(a('product.updated', { changes: { featured: [false, true] } })).toContain('marcou como destaque')
  })
  it('estoque e reservas (sem nome de cliente)', () => {
    expect(a('stock.sale', { delta: -2, after: 8 })).toBe('Bruno vendeu 2 un. de "Vestido" (sobraram 8)')
    expect(a('stock.restock', { delta: 6, after: 10 })).toContain('deu entrada de 6 un.')
    expect(a('stock.adjustment', { delta: -1, after: 3 })).toContain('−1')
    expect(a('stock.reserved')).toBe('Bruno fez ou confirmou uma reserva de "Vestido"')
  })
  it('equipe, convites e loja', () => {
    expect(a('member.added', { role: 'attendant' }, { entity_name: 'Eva' })).toBe('Bruno adicionou Eva à equipe como atendente')
    expect(a('member.role', { from: 'attendant', to: 'manager' }, { entity_name: 'Eva' })).toBe('Bruno mudou Eva de atendente para gerente')
    expect(a('invite.accepted', { role: 'manager' }, { actor_name: 'Eva' })).toBe('Eva aceitou o convite e entrou como gerente')
    expect(a('store.updated', { fields: ['WhatsApp', 'logo'] })).toBe('Bruno alterou WhatsApp, logo da loja')
    expect(a('store.catalog', { enabled: false })).toBe('Bruno desligou o catálogo público')
  })
  it('sem autor e ação desconhecida não quebram', () => {
    expect(a('product.deleted', {}, { actor_name: null })).toBe('Alguém da equipe excluiu "Vestido"')
    expect(a('coisa.nova')).toContain('coisa.nova')
  })
})

describe('permissões por papel (tabela da tela = regras de verdade)', () => {
  it('a tabela mostrada ao dono bate com can()', () => {
    for (const row of PERMISSION_TABLE) {
      expect(can('owner', row.capability)).toBe(row.owner)
      expect(can('manager', row.capability)).toBe(row.manager)
      expect(can('attendant', row.capability)).toBe(row.attendant)
    }
  })
  it('só o dono convida; dono e gerente veem todo o histórico', () => {
    expect(can('owner', 'invite')).toBe(true)
    expect(can('manager', 'invite')).toBe(false)
    expect(can('attendant', 'view_all_activity')).toBe(false)
    expect(can('manager', 'view_all_activity')).toBe(true)
  })
})
