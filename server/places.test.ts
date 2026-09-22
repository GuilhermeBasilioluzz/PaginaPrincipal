import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildGoogleRequest, parseSearchInput, toLeads } from './places'

const sp = { lat: -23.5505, lng: -46.6333 }

describe('parseSearchInput', () => {
  it('resolve o nicho no servidor, com a busca do Google e os filtros do OpenStreetMap', () => {
    const input = parseSearchInput({ provider: 'google', nicheId: 'dentista', ...sp, radiusMeters: 5000 })
    expect(input).toMatchObject({ provider: 'google', query: 'clínica odontológica', ...sp, radiusMeters: 5000 })
    expect((input as { osmSelectors: string[] }).osmSelectors).toContain('["amenity"="dentist"]')
  })

  it('usa o OpenStreetMap quando o Google não é pedido', () => {
    expect(parseSearchInput({ nicheId: 'barbearia', ...sp, radiusMeters: 5000 })).toMatchObject({ provider: 'osm' })
  })

  it('limpa o texto livre para não virar código na consulta', () => {
    const input = parseSearchInput({ nicheId: 'custom', text: 'flori"];out;cultura', ...sp, radiusMeters: 5000 })
    expect(input).toMatchObject({ query: 'flori out cultura' })
    expect(JSON.stringify(input)).not.toContain('"];')
  })

  it('recusa ponto fora do Brasil, raio inválido e nicho desconhecido', () => {
    expect(parseSearchInput({ nicheId: 'barbearia', lat: 40.7, lng: -74, radiusMeters: 5000 })).toBe('escolha um ponto dentro do Brasil')
    expect(parseSearchInput({ nicheId: 'barbearia', ...sp, radiusMeters: 999_999 })).toBe('raio inválido')
    expect(parseSearchInput({ nicheId: 'nao-existe', ...sp, radiusMeters: 5000 })).toBe('informe o tipo de comércio')
    expect(parseSearchInput({ nicheId: 'custom', text: '!', ...sp, radiusMeters: 5000 })).toBe('informe o tipo de comércio')
    expect(parseSearchInput(null)).toBe('pedido inválido')
  })
})

describe('buildGoogleRequest', () => {
  it('monta a busca em português, no Brasil, centrada no ponto escolhido', () => {
    const req = buildGoogleRequest({ provider: 'google', query: 'barbearia', osmSelectors: [], ...sp, radiusMeters: 3000, pageToken: 'abc' })
    expect(req).toMatchObject({
      textQuery: 'barbearia', languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, pageToken: 'abc',
      locationBias: { circle: { center: { latitude: sp.lat, longitude: sp.lng }, radius: 3000 } },
    })
  })
})

describe('toLeads', () => {
  it('converte a resposta do Google e descarta lugares fora do raio', () => {
    const leads = toLeads(
      [
        {
          id: 'p1', displayName: { text: 'Barbearia Centro' }, formattedAddress: 'Rua X, 10',
          location: { latitude: -23.551, longitude: -46.634 }, rating: 4.6, userRatingCount: 88,
          nationalPhoneNumber: '(11) 99999-0000', googleMapsUri: 'https://maps.google.com/?cid=1', businessStatus: 'OPERATIONAL',
        },
        { id: 'longe', displayName: { text: 'Rio' }, location: { latitude: -22.9, longitude: -43.17 } },
        { displayName: { text: 'sem id' }, location: { latitude: -23.55, longitude: -46.63 } },
      ],
      sp,
      5000,
    )
    expect(leads).toHaveLength(1)
    expect(leads[0]).toMatchObject({ id: 'p1', name: 'Barbearia Centro', rating: 4.6, reviews: 88, website: null, operational: true })
  })
})

describe('POST /api/places-search', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.GOOGLE_PLACES_API_KEY = 'google-key'
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })

  async function load(access: object | null) {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: async (t: string) => ({ data: { user: t === 'ok' ? { email: 'a@b.com' } : null }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: access }) }) }) }),
      }),
    }))
    return (await import('../api/places-search')).POST
  }

  const req = (token: string | null) =>
    new Request('http://localhost/api/places-search', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ provider: 'google', nicheId: 'barbearia', ...sp, radiusMeters: 5000 }),
    })

  it('bloqueia quem não está logado ou não pagou, sem chamar o Google', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const POST = await load(null)
    expect((await POST(req(null))).status).toBe(401)
    expect((await POST(req('ok'))).status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('busca no Google para quem tem acesso', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ places: [{ id: 'p1', displayName: { text: 'B' }, location: { latitude: sp.lat, longitude: sp.lng } }], nextPageToken: 'n2' }),
    )
    const POST = await load({ email: 'a@b.com', plan: 'lifetime', status: 'active', expires_at: null, cakto_order_id: null })
    const res = await POST(req('ok'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.leads[0].name).toBe('B')
    expect(body.nextPageToken).toBe('n2')
    const [, init] = fetchSpy.mock.calls[0]
    expect((init!.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('google-key')
    fetchSpy.mockRestore()
  })
})

describe('detalhes dos comércios salvos', () => {
  it('pede ao Google os mesmos campos da busca, sem o prefixo', async () => {
    const { DETAILS_FIELD_MASK } = await import('./places')
    expect(DETAILS_FIELD_MASK).toContain('displayName')
    expect(DETAILS_FIELD_MASK).toContain('nationalPhoneNumber')
    expect(DETAILS_FIELD_MASK).not.toContain('places.')
    expect(DETAILS_FIELD_MASK).not.toContain('nextPageToken')
  })

  it('valida a lista de IDs', async () => {
    const { parseDetailsInput } = await import('./places')
    expect(parseDetailsInput({ ids: ['ChIJN1t_tDeuEmsRUsoyG83frY4', 'ChIJN1t_tDeuEmsRUsoyG83frY4'] })).toEqual([
      'ChIJN1t_tDeuEmsRUsoyG83frY4',
    ])
    expect(parseDetailsInput({ ids: [] })).toBe('nenhum comércio informado')
    expect(parseDetailsInput({ ids: ['../../admin'] })).toBe('identificador inválido')
    expect(parseDetailsInput({ ids: Array.from({ length: 51 }, (_, i) => `ChIJ${'a'.repeat(10)}${i}`) })).toContain('no máximo')
  })

  it('devolve os comércios encontrados e avisa os que sumiram', async () => {
    vi.resetModules()
    process.env.GOOGLE_PLACES_API_KEY = 'google-key'
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { email: 'a@b.com' } }, error: null }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { email: 'a@b.com', plan: 'lifetime', status: 'active', expires_at: null, cakto_order_id: null },
              }),
            }),
          }),
        }),
      }),
    }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('existe1234567')
        ? Response.json({ id: 'existe1234567', displayName: { text: 'Barbearia' }, location: { latitude: -23.5, longitude: -46.6 } })
        : new Response('not found', { status: 404 }),
    )
    const { POST } = await import('../api/places-details')
    const res = await POST(
      new Request('http://localhost/api/places-details', {
        method: 'POST',
        headers: { Authorization: 'Bearer ok' },
        body: JSON.stringify({ ids: ['existe1234567', 'sumiu12345678'] }),
      }),
    )
    const body = await res.json()
    expect(body.places.map((p: { name: string }) => p.name)).toEqual(['Barbearia'])
    expect(body.missing).toEqual(['sumiu12345678'])
    fetchSpy.mockRestore()
  })
})

describe('busca gratuita (OpenStreetMap)', () => {
  it('monta a consulta do Overpass com o raio e os filtros do nicho', async () => {
    const { buildOverpassQuery } = await import('./osm')
    const q = buildOverpassQuery(['["amenity"="dentist"]'], sp, 3000)
    expect(q).toContain('nwr["amenity"="dentist"](around:3000,-23.550500,-46.633300);')
    expect(q).toContain('out center tags')
  })

  it('converte os lugares do OpenStreetMap, sem nota e com link para as avaliações no Google', async () => {
    const { osmToLeads } = await import('./osm')
    const leads = osmToLeads(
      [
        { type: 'node', id: 1, lat: -23.551, lon: -46.634, tags: { name: 'Barbearia Central', 'addr:street': 'Rua A', 'addr:housenumber': '10', phone: '+55 11 98765-4321' } },
        { type: 'way', id: 2, center: { lat: -23.552, lon: -46.635 }, tags: { name: 'Barbearia Dois', website: 'https://b2.com' } },
        { type: 'node', id: 3, lat: -23.55, lon: -46.63, tags: { shop: 'barber' } },
        { type: 'node', id: 4, lat: -22.9, lon: -43.17, tags: { name: 'Longe' } },
      ],
      sp,
      5000,
    )
    expect(leads.map((l) => l.name)).toEqual(['Barbearia Central', 'Barbearia Dois'])
    expect(leads[0]).toMatchObject({ id: 'osm:node/1', source: 'osm', rating: null, address: 'Rua A, 10', phone: '+55 11 98765-4321' })
    expect(leads[0].mapsUrl).toContain('https://www.google.com/maps/search/?api=1&query=Barbearia%20Central')
    expect(leads[1].website).toBe('https://b2.com')
  })

  it('usa o OpenStreetMap quando não há chave do Google, mesmo que o Google seja pedido', async () => {
    vi.resetModules()
    delete process.env.GOOGLE_PLACES_API_KEY
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { email: 'a@b.com' } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: 'a@b.com', plan: 'lifetime', status: 'active', expires_at: null, cakto_order_id: null } }) }) }) }),
      }),
    }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ elements: [{ type: 'node', id: 9, lat: sp.lat, lon: sp.lng, tags: { name: 'Barbearia OSM' } }] }),
    )
    const { POST } = await import('../api/places-search')
    const res = await POST(
      new Request('http://localhost/api/places-search', {
        method: 'POST',
        headers: { Authorization: 'Bearer ok' },
        body: JSON.stringify({ provider: 'google', nicheId: 'barbearia', ...sp, radiusMeters: 5000 }),
      }),
    )
    const body = await res.json()
    expect(body.provider).toBe('osm')
    expect(body.leads[0].name).toBe('Barbearia OSM')
    expect(String(fetchSpy.mock.calls[0][0])).toContain('overpass')
    fetchSpy.mockRestore()
  })
})
