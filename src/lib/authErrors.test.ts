import { describe, expect, it } from 'vitest'
import { explainSendError } from './authErrors'

describe('explainSendError', () => {
  it('explica os motivos mais comuns de falha no envio', () => {
    expect(explainSendError({ status: 429, message: 'email rate limit exceeded' })).toContain('limite por hora')
    expect(explainSendError({ status: 401, message: 'Invalid API key' })).toContain('VITE_SUPABASE_ANON_KEY')
    expect(explainSendError({ status: 422, message: 'Signups not allowed for otp' })).toContain('Allow new users to sign up')
    expect(explainSendError({ status: 400, message: 'Email logins are disabled' })).toContain('Email')
    expect(explainSendError({ status: 500, message: 'Error sending magic link email' })).toContain('não conseguiu enviar')
    expect(explainSendError({ status: 0, message: 'Failed to fetch' })).toContain('VITE_SUPABASE_URL')
    expect(explainSendError({ status: 418, message: '???' })).toContain('Tente de novo')
  })
})
