import { describe, expect, it } from 'vitest'
import { isOverdue, sortSaved, type SavedLead } from './crm'
import { whatsappUrl } from './leads'

function row(partial: Partial<SavedLead>): SavedLead {
  return {
    id: 'x', place_id: 'p', niche_id: 'barbearia', niche_label: 'Barbearia', status: 'to_contact', notes: '',
    contact_name: '', next_action_at: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', ...partial,
  }
}

describe('sortSaved', () => {
  it('coloca primeiro quem tem próximo contato marcado, do mais próximo ao mais distante', () => {
    const list = [
      row({ id: 'recente', updated_at: '2026-09-20T00:00:00Z' }),
      row({ id: 'dia25', next_action_at: '2026-09-25' }),
      row({ id: 'antigo', updated_at: '2026-09-02T00:00:00Z' }),
      row({ id: 'dia23', next_action_at: '2026-09-23' }),
    ]
    expect(sortSaved(list).map((r) => r.id)).toEqual(['dia23', 'dia25', 'recente', 'antigo'])
  })
})

describe('isOverdue', () => {
  it('marca retorno atrasado só para negociações em aberto', () => {
    expect(isOverdue(row({ next_action_at: '2026-09-20' }), '2026-09-22')).toBe(true)
    expect(isOverdue(row({ next_action_at: '2026-09-22' }), '2026-09-22')).toBe(false)
    expect(isOverdue(row({ next_action_at: '2026-09-20', status: 'won' }), '2026-09-22')).toBe(false)
    expect(isOverdue(row({}), '2026-09-22')).toBe(false)
  })
})

describe('whatsappUrl', () => {
  it('gera link para celulares e ignora telefones fixos', () => {
    expect(whatsappUrl('(11) 98765-4321')).toBe('https://wa.me/5511987654321')
    expect(whatsappUrl('+55 21 99876-5432')).toBe('https://wa.me/5521998765432')
    expect(whatsappUrl('(11) 3456-7890')).toBeNull()
    expect(whatsappUrl(null)).toBeNull()
  })
})
