import Link from 'next/link'

/**
 * Símbolo H (barra bronze + barra grafite unidas por uma curva), redesenhado em SVG a partir da referência
 * visual. PROVISÓRIO: trocar pelo arquivo vetorial oficial da logo quando for enviado.
 */
export function HMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 112" role="img" aria-label="Hyperion" focusable="false">
      <defs>
        <linearGradient id="hm-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8cba8" />
          <stop offset="0.5" stopColor="#d9a974" />
          <stop offset="1" stopColor="#a8825f" />
        </linearGradient>
        <linearGradient id="hm-graphite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b4c52" />
          <stop offset="1" stopColor="#2a2b2f" />
        </linearGradient>
        <linearGradient id="hm-bridge" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c99a70" />
          <stop offset="0.55" stopColor="#6d5646" />
          <stop offset="1" stopColor="#3a3b40" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="112" rx="5" fill="url(#hm-bronze)" />
      <rect x="76" y="0" width="24" height="112" rx="5" fill="url(#hm-graphite)" />
      <path d="M24 108 V84 C24 62 38 50 58 50 H76 V76 H62 C52 76 46 82 46 92 V108 Z" fill="url(#hm-bridge)" />
    </svg>
  )
}

/** compact: barra do topo. lockup: marca grande (telas de entrada e início). */
export function Brand({ href = '/', variant = 'compact' }: { href?: string; variant?: 'compact' | 'lockup' }) {
  return (
    <Link href={href} className={`brand brand-${variant}`} aria-label="Hyperion Systems">
      <HMark className="brand-mark" />
      <span className="brand-word">HYPERION</span>
      {variant === 'lockup' && <span className="brand-sub">SYSTEMS</span>}
    </Link>
  )
}
