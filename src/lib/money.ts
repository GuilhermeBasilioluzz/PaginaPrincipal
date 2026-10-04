const MAX = 9_999_999.99

/**
 * Preço digitado no padrão brasileiro → número. Aceita "189,90", "R$ 1.234,56", "189.90", "1.234", "189".
 * Devolve null quando não dá para entender (vazio, texto, negativo ou grande demais).
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$/gi, '').replace(/\s/g, '')
  if (s === '') return null
  if (!/^[\d.,]+$/.test(s)) return null

  if (s.includes(',')) {
    // vírgula = decimal; pontos antes dela são milhar
    if (s.split(',').length > 2) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // "189.90": ponto como decimal
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // "1.234" = mil duzentos e trinta e quatro
  } else if (!/^\d+$/.test(s)) {
    return null
  }

  const value = Number(s)
  if (!Number.isFinite(value) || value < 0 || value > MAX) return null
  return Math.round(value * 100) / 100
}

/** 189.9 → "R$ 189,90" */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Valor para preencher o campo de edição: 189.9 → "189,90" (sem milhar, fácil de editar). */
export function formatInput(value: number | null | undefined): string {
  return value == null ? '' : value.toFixed(2).replace('.', ',')
}
