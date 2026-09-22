import type { PlaceInfo } from '../src/lib/leads.js'
import { requireAccess } from '../server/auth.js'
import { DETAILS_FIELD_MASK, parseDetailsInput, toPlaceInfo, type GooglePlace } from '../server/places.js'

/**
 * Dados atualizados dos comércios salvos no funil de contatos.
 * O Google não permite guardar nome, endereço e telefone, então o site guarda só o ID
 * e busca o restante aqui, sempre que a lista é aberta.
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
  const ids = parseDetailsInput(body)
  if (typeof ids === 'string') return Response.json({ error: ids }, { status: 400 })

  const results = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=pt-BR`, {
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
      })
      if (!res.ok) {
        console.error('Erro no detalhe do Google', id, res.status)
        return null
      }
      return toPlaceInfo((await res.json()) as GooglePlace)
    }),
  )

  const places = results.filter((p): p is PlaceInfo => p !== null)
  return Response.json({ places, missing: ids.filter((id) => !places.some((p) => p.id === id)) })
}
