import Link from 'next/link'
import { Brand } from '@/components/Brand'

export default function Home() {
  return (
    <main className="hero">
      <Brand variant="lockup" />
      <p className="tagline">
        O Instagram da sua loja trabalhando por você, <span className="script">sempre.</span>
      </p>
      <h1>
        Seus Stories duram 24 horas. <span className="accent">Seu catálogo, não.</span>
      </h1>
      <div className="row">
        <Link href="/entrar" className="btn btn-primary">Entrar</Link>
        <Link href="/cadastro" className="btn btn-ghost">Criar conta</Link>
      </div>
    </main>
  )
}
