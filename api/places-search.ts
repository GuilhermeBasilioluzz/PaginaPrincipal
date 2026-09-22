import { requireAccess } from '../server/auth.js'
import { buildGoogleRequest, FIELD_MASK, parseSearchInput, toLeads } from '../server/places.js'

/**
 * Busca comércios no Google Maps (Places API) para a tela de prospecção.
 * Só responde para quem está logado e com acesso pago, para ninguém gastar a sua cota do Google.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return Response.json({ error: 'busca não configurada' }, { status: 500 })

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

  const google = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(buildGoogleRequest(input)),
  })

  if (!google.ok) {
    console.error('Erro do Google Places', google.status, await google.text())
    return Response.json({ error: 'a busca no Google falhou, tente de novo' }, { status: 502 })
  }

  const data = (await google.json()) as { places?: Parameters<typeof toLeads>[0]; nextPageToken?: string }
  return Response.json({
    leads: toLeads(data.places, { lat: input.lat, lng: input.lng }, input.radiusMeters),
    nextPageToken: data.nextPageToken ?? null,
  })
}
