import { describe, expect, it } from 'vitest'
import { customerMessage, productUrl, readInterestForm, restockMessage, restockWhatsappUrl, restockedWithDemand, type InterestOverviewRow } from './interest'

describe('mensagens', () => {
  const link = 'https://hyperion.example/aurora/produto/saia'
  it('esgotada: pede aviso quando voltar', () => {
    expect(customerMessage('sold_out', 'Saia Plissada', link)).toBe(`Oi! A peça "Saia Plissada" está esgotada, mas tenho interesse em receber um aviso quando ela estiver disponível novamente. ${link}`)
  })
  it('reservada e disponível têm textos próprios', () => {
    expect(customerMessage('reserved', 'Blusa', link)).toContain('está reservada')
    expect(customerMessage('available', 'Blusa', link, 129.9).replace(/\s/g, ' ')).toContain('(R$ 129,90)')
  })
  it('aviso da loja usa o primeiro nome e o tamanho', () => {
    expect(restockMessage('Maria Souza Lima', 'Saia', 'Boutique Aurora', link, 'M')).toBe(`Oi, Maria! Boa notícia: a peça "Saia" (tamanho M) chegou de novo na Boutique Aurora. Quer que eu separe para você? ${link}`)
    expect(restockMessage('  ', 'Saia', 'Aurora', link)).toContain('Oi! Boa')
  })
  it('link do WhatsApp codifica a mensagem', () => {
    const u = restockWhatsappUrl('5584999991111', 'Ana', 'Saia', 'Aurora', link)
    expect(u.startsWith('https://wa.me/5584999991111?text=')).toBe(true)
    expect(u).not.toContain(' ')
    expect(decodeURIComponent(u.split('text=')[1])).toContain('Oi, Ana!')
  })
  it('endereço do produto', () => {
    expect(productUrl('https://x.com/', 'aurora', 'saia')).toBe('https://x.com/aurora/produto/saia')
  })
})

function form(o: Record<string, string>) { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }

describe('readInterestForm', () => {
  const base = { product: 'eeeeeeee-0000-0000-0000-000000000a01', name: ' Maria ', contact: '(84) 99999-1111' }
  it('normaliza o WhatsApp e limpa os campos', () => {
    const r = readInterestForm(form({ ...base, size: 'M' }))
    expect(r.ok && r.payload).toMatchObject({ name: 'Maria', contact: '5584999991111', size: 'M', note: '' })
  })
  it('mensagens claras', () => {
    const err = (o: object) => { const r = readInterestForm(form({ ...base, ...o })); return r.ok ? null : r.error }
    expect(err({ name: '  ' })).toContain('nome')
    expect(err({ contact: '123' })).toContain('WhatsApp')
    expect(err({ contact: '' })).toContain('WhatsApp')
    expect(err({ product: 'x' })).toContain('peça')
    expect(err({ note: 'x'.repeat(301) })).toContain('300')
  })
})

describe('restockedWithDemand', () => {
  const row = (o: Partial<InterestOverviewRow>): InterestOverviewRow => ({ product_id: 'p', name: 'x', status: 'available', quantity: 0, stock_state: 'out', clicks_30d: 0, waiting: 0, contacted: 0, converted: 0, last_at: null, sizes: {}, ...o })
  it('só destaca peça que voltou ao estoque E tem gente esperando', () => {
    const rows = [row({ name: 'a', waiting: 2, stock_state: 'ok' }), row({ name: 'b', waiting: 2, stock_state: 'out' }), row({ name: 'c', waiting: 0, stock_state: 'ok' }), row({ name: 'd', waiting: 1, stock_state: 'low' }), row({ name: 'e', waiting: 3, stock_state: 'reserved' })]
    expect(restockedWithDemand(rows).map((r) => r.name)).toEqual(['a', 'd'])
  })
})
