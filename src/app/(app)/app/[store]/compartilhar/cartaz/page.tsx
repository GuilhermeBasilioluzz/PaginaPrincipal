import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { getMembership } from '@/lib/session'
import { siteUrl } from '@/lib/supabase/env'
import { parseShareTarget, qrSvg, shareUrl } from '@/lib/qr'

export const metadata = { title: 'Cartaz com QR Code' }
export const dynamic = 'force-dynamic'

export default async function PosterPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ para?: string }> }) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams])
  const membership = await getMembership(slug)
  if (!membership) notFound()
  const target = parseShareTarget(sp.para)
  if (!target) notFound()
  const url = shareUrl(siteUrl(), membership.store.slug, target, 'qr')
  const svg = await qrSvg(url)

  return (
    <div className="poster">
      <div className="poster-tools"><PrintButton /></div>
      <section className="poster-sheet">
        <h1>{membership.store.name}</h1>
        <p className="poster-sub">{target.kind === 'loja' ? 'Nosso catálogo no seu celular' : target.kind === 'colecao' ? 'Veja esta coleção no celular' : 'Veja esta peça no celular'}</p>
        <div className="poster-qr" role="img" aria-label="QR Code" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="poster-step">Aponte a câmera do celular para o QR Code</p>
        <p className="poster-url">{url.replace(/^https?:\/\//, '').replace(/\?o=qr$/, '')}</p>
      </section>
    </div>
  )
}
