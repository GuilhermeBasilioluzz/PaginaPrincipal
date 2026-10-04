export function ConfigNotice() {
  return (
    <div className="card notice-config">
      <h1>Falta configurar o Supabase</h1>
      <p className="muted">
        Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (veja{' '}
        <code>.env.example</code>) e reinicie o servidor.
      </p>
    </div>
  )
}
