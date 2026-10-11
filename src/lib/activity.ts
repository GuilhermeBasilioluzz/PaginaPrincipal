import { formatBRL } from './money'

export type ActivityItem = {
  id: number; created_at: string; action: string; entity_type: string; entity_id: string | null; entity_name: string | null
  details: Record<string, unknown>; actor_id: string | null; actor_name: string | null; total?: number
}

export const TYPE_LABEL: Record<string, string> = {
  product: 'Produtos e estoque', collection: 'Coleções', category: 'Categorias', member: 'Equipe', invite: 'Convites', store: 'Configurações da loja',
}

const STATUS: Record<string, string> = { available: 'disponível', reserved: 'reservado', sold: 'vendido/esgotado', unavailable: 'indisponível', archived: 'arquivado' }
const ROLE: Record<string, string> = { owner: 'dono(a)', manager: 'gerente', attendant: 'atendente' }
const FIELD: Record<string, string> = {
  name: 'o nome', price: 'o preço', promo_price: 'o preço promocional', featured: 'o destaque', color: 'a cor', sizes: 'os tamanhos',
  category: 'a categoria', sku: 'o código', description: 'a descrição', video: 'o vídeo',
}

const money = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) ? formatBRL(Number(v)) : 'sem valor')
const q = (name: string | null) => (name ? `"${name}"` : 'sem nome')

/** Descreve as mudanças de um produto: "o preço (R$ 100,00 → R$ 120,00), o nome e os tamanhos". */
function describeChanges(changes: Record<string, unknown>): string {
  const parts = Object.entries(changes).map(([k, v]) => {
    const label = FIELD[k] ?? k
    if ((k === 'price' || k === 'promo_price') && Array.isArray(v)) return `${label} (${money(v[0])} → ${money(v[1])})`
    if (k === 'featured' && Array.isArray(v)) return v[1] ? 'marcou como destaque' : 'tirou o destaque'
    return label
  })
  if (parts.length === 0) return 'dados'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

/** Frase do histórico, em português: "Bruno alterou o preço (R$ 100,00 → R$ 120,00) de "Vestido"". */
export function describeActivity(a: Pick<ActivityItem, 'action' | 'entity_name' | 'details' | 'actor_name'>): string {
  const who = a.actor_name?.trim() || 'Alguém da equipe'
  const n = q(a.entity_name)
  const d = a.details ?? {}
  switch (a.action) {
    case 'product.created': return `${who} cadastrou ${n}${d.price !== undefined ? ` por ${money(d.price)}` : ''}`
    case 'product.deleted': return `${who} excluiu ${n}`
    case 'product.status': return `${who} mudou ${n} de ${STATUS[String(d.from)] ?? d.from} para ${STATUS[String(d.to)] ?? d.to}`
    case 'product.updated': {
      const ch = (d.changes ?? {}) as Record<string, unknown>
      return `${who} alterou ${describeChanges(ch)} de ${n}`
    }
    case 'stock.restock': return `${who} deu entrada de ${Math.abs(Number(d.delta))} un. de ${n} (agora ${d.after})`
    case 'stock.sale': return `${who} vendeu ${Math.abs(Number(d.delta))} un. de ${n} (sobraram ${d.after})`
    case 'stock.return': return `${who} registrou devolução de ${Math.abs(Number(d.delta))} un. de ${n} (agora ${d.after})`
    case 'stock.adjustment': return `${who} corrigiu o estoque de ${n}: ${Number(d.delta) > 0 ? '+' : '−'}${Math.abs(Number(d.delta))} (agora ${d.after})`
    case 'stock.reserved': return `${who} fez ou confirmou uma reserva de ${n}`
    case 'stock.reservation_released': return `${who} liberou uma reserva de ${n}`
    case 'image.added': return `${who} adicionou uma foto em ${n}`
    case 'image.removed': return `${who} removeu uma foto de ${n}`
    case 'interest.added': return `${who} anotou uma interessada em ${n}`
    case 'interest.status': return `${who} atualizou uma interessada em ${n}`
    case 'collection.created': return `${who} criou a coleção ${n}`
    case 'collection.updated': return `${who} alterou a coleção ${n}`
    case 'collection.deleted': return `${who} excluiu a coleção ${n}`
    case 'category.created': return `${who} criou a categoria ${n}`
    case 'category.updated': return `${who} alterou a categoria ${n}`
    case 'category.deleted': return `${who} excluiu a categoria ${n}`
    case 'member.added': return `${who} adicionou ${a.entity_name || 'alguém'} à equipe como ${ROLE[String(d.role)] ?? d.role}`
    case 'member.role': return `${who} mudou ${a.entity_name || 'um membro'} de ${ROLE[String(d.from)] ?? d.from} para ${ROLE[String(d.to)] ?? d.to}`
    case 'member.removed': return `${who} removeu ${a.entity_name || 'um membro'} da equipe`
    case 'member.left': return `${who} saiu da equipe`
    case 'invite.created': return `${who} criou um convite para ${ROLE[String(d.role)] ?? d.role}${a.entity_name ? ` (${a.entity_name})` : ''}`
    case 'invite.revoked': return `${who} cancelou um convite${a.entity_name ? ` (${a.entity_name})` : ''}`
    case 'invite.accepted': return `${who} aceitou o convite e entrou como ${ROLE[String(d.role)] ?? d.role}`
    case 'store.catalog': return `${who} ${d.enabled ? 'ligou' : 'desligou'} o catálogo público`
    case 'store.active': return `${who} ${d.active ? 'reativou' : 'desativou'} a loja`
    case 'store.updated': {
      const f = Array.isArray(d.fields) ? (d.fields as string[]) : []
      return `${who} alterou ${f.length ? f.join(', ') : 'as configurações'} da loja`
    }
    default: return `${who} fez uma alteração (${a.action})`
  }
}
