import Link from 'next/link'

export default function StoreNotFound() {
  return (
    <div className="hero">
      <h1>Catálogo não encontrado</h1>
      <p className="muted">Este endereço não existe ou o catálogo está temporariamente fora do ar.</p>
      <Link href="/" className="btn btn-ghost">Ir para o início</Link>
    </div>
  )
}
