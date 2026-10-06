export const MAX_IMAGES = 8
export const MAX_SIDE = 1600
export const THUMB_SIDE = 480
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024

export const IMAGE_KINDS = ['front', 'back', 'side', 'detail', 'other'] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]

export const KIND_LABEL: Record<ImageKind, string> = {
  front: 'Frente', back: 'Costas', side: 'Lateral', detail: 'Detalhe', other: 'Outra',
}

export function isImageKind(v: unknown): v is ImageKind {
  return typeof v === 'string' && (IMAGE_KINDS as readonly string[]).includes(v)
}

/** Sugestão para a próxima foto: a primeira entre frente/costas/lateral/detalhe que ainda não foi usada. */
export function nextKind(used: string[]): ImageKind {
  return (['front', 'back', 'side', 'detail'] as const).find((k) => !used.includes(k)) ?? 'other'
}

/** Reduz para caber em max x max mantendo a proporção. Nunca amplia. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** stores/{loja}/products/{produto}/{id}.webp — a pasta da loja é o que o Storage usa para liberar o acesso. */
export function imagePath(storeId: string, productId: string, imageId: string, ext: 'webp' | 'jpg'): string {
  return `stores/${storeId}/products/${productId}/${imageId}.${ext}`
}

/** A miniatura fica ao lado da foto: .../abc.webp → .../abc_thumb.webp */
export function thumbPath(path: string): string {
  return path.replace(/\.(webp|jpg)$/, '_thumb.$1')
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** O servidor só registra caminhos que pertencem a ESTA loja e a ESTE produto. */
export function isValidImagePath(path: string, storeId: string, productId: string): boolean {
  const re = new RegExp(`^stores/${storeId}/products/${productId}/${UUID}\\.(webp|jpg)$`, 'i')
  return re.test(path)
}

export function publicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/catalog/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export type BrandingKind = 'logo' | 'banner'

/** stores/{loja}/branding/logo-{id}.webp — só o dono envia para esta pasta (regra do Storage). */
export function brandingPath(storeId: string, kind: BrandingKind, imageId: string, ext: 'webp' | 'jpg'): string {
  return `stores/${storeId}/branding/${kind}-${imageId}.${ext}`
}

export function isValidBrandingPath(path: string, storeId: string, kind: BrandingKind): boolean {
  return new RegExp(`^stores/${storeId}/branding/${kind}-${UUID}\\.(webp|jpg)$`, 'i').test(path)
}
