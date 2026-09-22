import { useState, type FormEvent } from 'react'
import { explainSendError } from '../lib/authErrors'
import { supabase } from '../lib/supabase'

export default function Login({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Detalhe técnico do Supabase (sem dados sensíveis), para facilitar o suporte.
  const [errorDetail, setErrorDetail] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setErrorDetail('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      console.error('Falha ao enviar o e-mail de login', error)
      setError(explainSendError(error))
      setErrorDetail([error.status, error.code, error.message].filter(Boolean).join(' · '))
    } else setSent(true)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('Código inválido ou expirado. Peça um novo código.')
  }

  return (
    <section className="auth">
      <button className="link" onClick={onBack}>
        ← Voltar
      </button>
      <div className="card auth-card">
        <p className="eyebrow">Área do cliente</p>
        <h2 className="screen-title">Entrar no PromptForge</h2>

        {!sent ? (
          <form className="form" onSubmit={sendCode}>
            <p className="muted">
              Use o <strong>mesmo e-mail da sua compra</strong>. Vamos enviar um link de acesso e um código, sem senha.
            </p>
            <div className="field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                placeholder="voce@exemplo.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            {errorDetail && <p className="muted small">Detalhe técnico: {errorDetail}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Enviando…' : 'Receber acesso por e-mail'}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={verifyCode}>
            <p className="muted">
              Enviamos um e-mail para <strong>{email}</strong>. Clique no link recebido ou digite o código abaixo.
            </p>
            <div className="field">
              <label htmlFor="login-code">Código do e-mail</label>
              <input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                placeholder="123456"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
            <button type="button" className="link" onClick={() => setSent(false)}>
              Usar outro e-mail
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
