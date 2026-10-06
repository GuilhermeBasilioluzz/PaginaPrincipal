import type { Metadata, Viewport } from 'next'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/michroma/latin-400.css'
import '@fontsource/caveat/latin-500.css'
import './globals.css'
import { siteUrl } from '@/lib/supabase/env'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Hyperion Systems', template: '%s · Hyperion' },
  description: 'Seus Stories duram 24 horas. Seu catálogo, não.',
}

export const viewport: Viewport = { themeColor: '#070809', colorScheme: 'dark' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
