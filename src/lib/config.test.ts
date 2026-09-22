import { describe, expect, it } from 'vitest'
import { isGoogleKey, supabaseConfigProblems } from './config'

describe('supabaseConfigProblems', () => {
  it('aceita uma configuração válida', () => {
    expect(supabaseConfigProblems('https://abcd.supabase.co', 'sb_publishable_abc123')).toEqual([])
  })

  it('aponta variáveis vazias, valores de exemplo, aspas e espaços', () => {
    expect(supabaseConfigProblems(undefined, '')).toEqual([
      'VITE_SUPABASE_URL está vazia ou não existe.',
      'VITE_SUPABASE_ANON_KEY está vazia ou não existe.',
    ])
    expect(supabaseConfigProblems('https://SEU-PROJETO.supabase.co', 'sua-chave-anon-publica')).toHaveLength(2)
    expect(supabaseConfigProblems('"https://abcd.supabase.co"', 'abc def')).toEqual([
      'VITE_SUPABASE_URL precisa começar com https:// (sem aspas nem espaços).',
      'VITE_SUPABASE_ANON_KEY tem aspas ou espaços.',
    ])
  })
})

describe('isGoogleKey', () => {
  it('reconhece só chaves no formato do Google', () => {
    expect(isGoogleKey('AIza' + 'a'.repeat(35))).toBe(true)
    expect(isGoogleKey('')).toBe(false)
    expect(isGoogleKey('minha-chave')).toBe(false)
    expect(isGoogleKey(undefined)).toBe(false)
  })
})
