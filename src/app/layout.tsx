import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Hyperion System', template: '%s · Hyperion' },
  description: 'Seus Stories duram 24 horas. Seu catálogo, não.',
}

export const viewport: Viewport = { themeColor: '#0a0a0b', colorScheme: 'dark' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
