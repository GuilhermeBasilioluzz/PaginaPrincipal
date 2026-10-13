export const MAX_STORY_CAPTION = 500
export const MAX_STORY_BATCH = 10

export type StoryTab = 'pending' | 'converted' | 'discarded'
export const STORY_TABS: { key: StoryTab; label: string }[] = [
  { key: 'pending', label: 'Para revisar' },
  { key: 'converted', label: 'Viraram produto' },
  { key: 'discarded', label: 'Descartados' },
]
export const storyTab = (raw: unknown): StoryTab => (raw === 'converted' || raw === 'discarded' ? raw : 'pending')

export type StoryItem = {
  id: string; path: string; caption: string | null; status: StoryTab; product_id: string | null; product_name: string | null
  posted_at: string; created_at: string; author: string | null; total: number
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** stores/{loja}/stories/{id}.webp — a pasta da loja é o que o Storage usa para liberar o acesso (bucket privado). */
export function storyPath(storeId: string, id: string, ext: 'webp' | 'jpg'): string {
  return `stores/${storeId}/stories/${id}.${ext}`
}
export const storyThumbPath = (path: string) => path.replace(/\.(webp|jpg)$/, '_thumb.$1')

export function isValidStoryPath(path: string, storeId: string): boolean {
  return new RegExp(`^stores/${storeId}/stories/${UUID}\\.(webp|jpg)$`, 'i').test(path)
}

/** "agora há pouco", "há 3 h", "há 2 dias" — o Story no Instagram já saiu do ar, mas aqui ele fica guardado. */
export function storyAge(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 60) return 'agora há pouco'
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`
  const d = Math.round(min / 1440)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}
