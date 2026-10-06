import { describe, expect, it } from 'vitest'
import { customerMessage, questionMessage } from './interest'
import { shareText, shareWhatsappUrl } from './share'
import { breadcrumbJsonLd, productJsonLd, safeJson } from './jsonld'

describe('mensagens com tamanho', () => {
  const link = 'https://x.com/a/produto/b'
  it('o tamanho escolhido entra em cada situação', () => {
    expect(customerMessage('available', 'Saia', link, 100, 'M').replace(/\s/g, ' ')).toBe(`Oi! Tenho interesse na peça "Saia" (R$ 100,00) no tamanho M. ${link}`)
    expect(customerMessage('sold_out', 'Saia', link, undefined, 'P')).toContain('"Saia" no tamanho P está esgotada')
    expect(customerMessage('reserved', 'Saia', link, undefined, 'G')).toContain('no tamanho G está reservada')
  })
  it('sem tamanho, o texto continua igual ao anterior', () => {
    expect(customerMessage('sold_out', 'Saia', link)).toBe(`Oi! A peça "Saia" está esgotada, mas tenho interesse em receber um aviso quando ela estiver disponível novamente. ${link}`)
  })
  it('dúvida', () => {
    expect(questionMessage('Saia', link)).toBe(`Oi! Tenho uma dúvida sobre a peça "Saia". ${link}`)
  })
})

describe('compartilhar', () => {
  it('texto e link do WhatsApp (sem número fixo, para escolher o contato)', () => {
    const t = shareText('Boutique Aurora', 'Vestido Midi', 149.9).replace(/\s/g, ' ')
    expect(t).toBe('Olha essa peça da Boutique Aurora: Vestido Midi — R$ 149,90')
    const u = shareWhatsappUrl(t, 'https://x.com/a/produto/b')
    expect(u.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(u.split('text=')[1])).toBe(`${t}\nhttps://x.com/a/produto/b`)
  })
})

describe('dados estruturados (SEO)', () => {
  const base = { storeName: 'Aurora', name: 'Vestido', description: 'Lindo', url: 'https://x.com/a/produto/v', images: ['https://x.com/i.webp'], color: 'Verde', price: 149.9, label: 'available' as const }
  it('Product com oferta em BRL e disponibilidade', () => {
    const j = productJsonLd(base) as any
    expect(j['@type']).toBe('Product')
    expect(j.offers).toMatchObject({ priceCurrency: 'BRL', price: '149.90', availability: 'https://schema.org/InStock' })
    expect(j.image).toEqual(['https://x.com/i.webp'])
  })
  it('disponibilidade por situação', () => {
    expect((productJsonLd({ ...base, label: 'low' }) as any).offers.availability).toContain('LimitedAvailability')
    for (const l of ['sold_out', 'reserved'] as const) expect((productJsonLd({ ...base, label: l }) as any).offers.availability).toContain('OutOfStock')
  })
  it('omite campos vazios', () => {
    const j = productJsonLd({ ...base, images: [], description: null, color: null }) as any
    expect('image' in j || 'description' in j || 'color' in j).toBe(false)
  })
  it('migalhas numeradas', () => {
    const j = breadcrumbJsonLd([{ name: 'Loja', url: 'u1' }, { name: 'Peça', url: 'u2' }]) as any
    expect(j.itemListElement.map((i: any) => i.position)).toEqual([1, 2])
  })
  it('texto da loja não consegue fechar a tag <script> nem injetar HTML', () => {
    const evil = '</script><script>alert(1)</script><img src=x onerror=alert(1)> & \u2028'
    const out = safeJson(productJsonLd({ ...base, name: evil, description: evil }))
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(JSON.parse(out).name).toBe(evil) // o conteúdo continua íntegro para quem lê o JSON
  })
})
