import { formatBRL } from './money'

/** Texto para mandar a peça a alguém: "Olha essa peça da Aurora: Vestido Midi — R$ 149,90". */
export function shareText(storeName: string, productName: string, price: number): string {
  return `Olha essa peça da ${storeName}: ${productName} — ${formatBRL(price)}`
}

/** Abre o WhatsApp para ESCOLHER o contato (sem número fixo), com o texto e o link. */
export function shareWhatsappUrl(text: string, link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`
}

/** Copia o texto. Usa a área de transferência moderna e, se o navegador bloquear, o método antigo. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* cai para o método antigo */ }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
