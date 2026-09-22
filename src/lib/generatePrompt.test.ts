import { describe, expect, it } from 'vitest'
import { categories, getCategory, getSections } from '../data/categories'
import { generatePrompt, missingRequired } from './generatePrompt'

const ecommerce = getCategory('ecommerce')!

describe('generatePrompt', () => {
  it('inclui descrição, respostas específicas e entregáveis da categoria', () => {
    const prompt = generatePrompt(ecommerce, {
      projectName: 'Loja da Ana',
      description: 'Loja de roupas femininas',
      payments: ['Pix', 'Cartão de crédito'],
    })
    expect(prompt).toContain('construir Loja da Ana')
    expect(prompt).toContain('Loja de roupas femininas')
    expect(prompt).toContain('**Formas de pagamento:** Pix, Cartão de crédito')
    expect(prompt).toContain(ecommerce.deliverables[0])
  })

  it('omite perguntas sem resposta e pede sugestão de stack quando não informada', () => {
    const prompt = generatePrompt(ecommerce, { description: 'x', variations: [] })
    expect(prompt).not.toContain('variações')
    expect(prompt).toContain('recomende uma stack')
  })

  it('adapta as regras para iniciantes', () => {
    const prompt = generatePrompt(ecommerce, { description: 'x', experience: 'Iniciante' })
    expect(prompt).toContain('Sou iniciante')
  })
})

describe('missingRequired', () => {
  it('aponta campos obrigatórios vazios', () => {
    const overview = getSections(ecommerce)[0]
    expect(missingRequired(overview, {}).map((q) => q.id)).toEqual(['description'])
    expect(missingRequired(overview, { description: '  ' })).toHaveLength(1)
    expect(missingRequired(overview, { description: 'ok' })).toHaveLength(0)
  })
})

describe('categories', () => {
  it('têm ids de perguntas únicos dentro de cada questionário', () => {
    for (const c of categories) {
      const ids = getSections(c).flatMap((s) => s.questions.map((q) => q.id))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
