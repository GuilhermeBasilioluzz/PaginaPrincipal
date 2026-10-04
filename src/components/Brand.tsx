import Link from 'next/link'

/** Marca provisória em texto. Será trocada pela logo oficial do Hyperion quando o arquivo for enviado. */
export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Hyperion System">
      <span className="brand-mark">H</span>
      <span className="brand-word">HYPERION</span>
    </Link>
  )
}
