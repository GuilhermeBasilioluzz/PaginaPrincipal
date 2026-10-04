import { MAX_ORIGINAL_BYTES, MAX_SIDE, THUMB_SIDE, fitWithin } from './images'

export type PreparedImage = { main: Blob; thumb: Blob; ext: 'webp' | 'jpg'; width: number; height: number }

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** Erro com mensagem pronta para a atendente. */
export class ImageError extends Error {}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  const webp = await toBlob('image/webp', quality)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }
  // Safari antigo não gera WebP: cai para JPEG
  const jpeg = await toBlob('image/jpeg', Math.min(0.9, quality + 0.05))
  if (!jpeg) throw new ImageError('Não foi possível preparar esta imagem.')
  return { blob: jpeg, ext: 'jpg' }
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Seu navegador não conseguiu preparar a imagem.')
  ctx.fillStyle = '#ffffff' // fundo branco para PNG com transparência
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

/**
 * Lê a foto (respeitando a rotação do celular), reduz para no máximo 1600 px no maior lado e gera
 * uma miniatura de 480 px. Economiza a internet da atendente e deixa o catálogo mais rápido.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) throw new ImageError(`"${file.name}" não é uma imagem aceita. Use JPG, PNG ou WebP.`)
  if (file.size > MAX_ORIGINAL_BYTES) throw new ImageError(`"${file.name}" é grande demais (máximo 25 MB).`)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError(`Não foi possível abrir "${file.name}". O arquivo pode estar corrompido.`)
  }

  try {
    const size = fitWithin(bitmap.width, bitmap.height, MAX_SIDE)
    const thumbSize = fitWithin(bitmap.width, bitmap.height, THUMB_SIDE)
    const main = await encode(draw(bitmap, size.width, size.height), 0.82)
    const thumb = await encode(draw(bitmap, thumbSize.width, thumbSize.height), 0.75)
    // as duas precisam ter a mesma extensão (a miniatura é derivada do caminho da foto)
    if (thumb.ext !== main.ext) throw new ImageError('Não foi possível preparar esta imagem.')
    return { main: main.blob, thumb: thumb.blob, ext: main.ext, width: size.width, height: size.height }
  } finally {
    bitmap.close()
  }
}
