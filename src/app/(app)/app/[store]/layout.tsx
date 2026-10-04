import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMembership } from '@/lib/session'
import { ROLE_LABEL } from '@/lib/permissions'

export default async function StoreLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ store: string }>
}) {
  const { store: slug } = await params
  const membership = await getMembership(slug)
  if (!membership) notFound() // mesma resposta para "não existe" e "não é sua": não revela lojas alheias
  const { store, role } = membership

  return (
    <>
      <div className="store-head">
        <div>
          <h1 className="store-name">{store.name}</h1>
          <p className="muted small">{ROLE_LABEL[role]} · /{store.slug}</p>
        </div>
        <nav className="subnav wrap" aria-label="Loja">
          <Link href={`/app/${slug}`}>Painel</Link>
          <Link href={`/app/${slug}/produtos`}>Produtos</Link>
          <Link href={`/app/${slug}/colecoes`}>Coleções</Link>
          <Link href={`/app/${slug}/categorias`}>Categorias</Link>
          <Link href={`/app/${slug}/equipe`}>Equipe</Link>
        </nav>
      </div>
      {!store.is_active && (
        <p className="notice notice-error" role="alert">
          Esta loja foi desativada pelo administrador do Hyperion. Você pode consultar os dados, mas não alterá-los.
        </p>
      )}
      {children}
    </>
  )
}
