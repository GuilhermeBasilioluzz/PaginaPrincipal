import { isGoogleKey } from '../src/lib/config.js'
import { requireAccess } from '../server/auth.js'
import { searchOsm } from '../server/osm.js'
import { buildGoogleRequest, FIELD_MASK, parseSearchInput, toLeads } from '../server/places.js'

/**
 * Busca comércios para a tela de prospecção.
 * - Google (Places API): quando GOOGLE_PLACES_API_KEY existe e a tela usa o mapa do Google. Traz notas e avaliações.
 * - OpenStreetMap (Overpass): gratuito, usado nos demais casos. Sem notas.
 * As regras do Google proíbem mostrar dados dele em outro mapa; por isso a fonte segue o mapa da tela.
 * Só responde para quem está logado e com acesso pago.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAccess(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'pedido inválido' }, { status: 400 })
  }
  const input = parseSearchInput(body)
  if (typeof input === 'string') return Response.json({ error: input }, { status: 400 })
  const center = { lat: input.lat, lng: input.lng }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (input.provider === 'google' && isGoogleKey(apiKey)) {
    const google = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey!.trim(), 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(buildGoogleRequest(input)),
    })
    if (!google.ok) {
      console.error('Erro do Google Places', google.status, await google.text())
      return Response.json({ error: 'a busca no Google falhou, tente de novo' }, { status: 502 })
    }
    const data = (await google.json()) as { places?: Parameters<typeof toLeads>[0]; nextPageToken?: string }
    return Response.json({
      provider: 'google',
      leads: toLeads(data.places, center, input.radiusMeters),
      nextPageToken: data.nextPageToken ?? null,
    })
  }

  try {
    const leads = await searchOsm(input.osmSelectors, center, input.radiusMeters)
    return Response.json({ provider: 'osm', leads, nextPageToken: null })
  } catch (e) {
    console.error('Erro no OpenStreetMap', e)
    return Response.json({ error: 'o serviço gratuito de mapas está ocupado, tente de novo em instantes' }, { status: 502 })
  }
}
