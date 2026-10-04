import { getMembership } from '@/lib/session'
import { notFound } from 'next/navigation'

export default async function StoreHome({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound()

  return (
    <div className="card">
      <h2>Tudo pronto para começar</h2>
      <p className="muted">
        Sua loja foi criada. O painel com produtos, coleções e estoque chega nas próximas etapas.
        Enquanto isso, convide sua equipe.
      </p>
      <p className="small muted">Endereço do catálogo (em breve): <code>/{membership.store.slug}</code></p>
    </div>
  )
}
