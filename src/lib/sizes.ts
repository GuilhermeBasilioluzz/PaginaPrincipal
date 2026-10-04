export const LETTER_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único']
export const NUMBER_SIZES = ['34', '36', '38', '40', '42', '44', '46']
export const MAX_SIZES = 20

/** Junta os tamanhos marcados com os digitados à mão ("48, 50 ; Plus"), sem repetir e sem vazios. */
export function parseSizes(checked: string[], extra: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...checked, ...extra.split(/[,;\n]/)]) {
    const size = raw.trim().replace(/\s+/g, ' ')
    if (!size) continue
    const key = size.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(size.length <= 3 && /^[a-z]+$/i.test(size) ? size.toUpperCase() : size)
  }
  return out
}

export function splitSizes(sizes: string[]): { checked: string[]; extra: string } {
  const preset = new Set([...LETTER_SIZES, ...NUMBER_SIZES].map((s) => s.toLowerCase()))
  return {
    checked: sizes.filter((s) => preset.has(s.toLowerCase())).map((s) => [...LETTER_SIZES, ...NUMBER_SIZES].find((p) => p.toLowerCase() === s.toLowerCase())!),
    extra: sizes.filter((s) => !preset.has(s.toLowerCase())).join(', '),
  }
}
