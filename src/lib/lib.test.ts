import { describe, expect, it } from 'vitest'
import { can, isRole } from './permissions'
import { slugify, slugProblem, RESERVED_SLUGS } from './slug'
import { safeNext } from './safeNext'
import { addMemberSchema, loginSchema, newPasswordSchema, signUpSchema, storeSchema } from './validation'
import { authErrorMessage, dbErrorMessage } from './errors'
import { readFileSync } from 'node:fs'

describe('permissões (espelho do banco)', () => {
  it('dono faz tudo', () => {
    for (const c of ['edit_store', 'manage_team', 'manage_structure', 'edit_products', 'delete_products', 'update_stock', 'view_reports'] as const) {
      expect(can('owner', c)).toBe(true)
    }
  })
  it('gerente não edita loja nem equipe', () => {
    expect(can('manager', 'edit_store')).toBe(false)
    expect(can('manager', 'manage_team')).toBe(false)
    expect(can('manager', 'manage_structure')).toBe(true)
    expect(can('manager', 'delete_products')).toBe(true)
  })
  it('atendente cria/edita produto e estoque, mas não apaga nem gerencia estrutura', () => {
    expect(can('attendant', 'edit_products')).toBe(true)
    expect(can('attendant', 'update_stock')).toBe(true)
    expect(can('attendant', 'delete_products')).toBe(false)
    expect(can('attendant', 'manage_structure')).toBe(false)
    expect(can('attendant', 'view_reports')).toBe(false)
  })
  it('sem papel não pode nada', () => {
    expect(can(null, 'edit_products')).toBe(false)
    expect(can(undefined, 'edit_products')).toBe(false)
  })
  it('isRole valida papéis', () => {
    expect(isRole('owner')).toBe(true)
    expect(isRole('admin')).toBe(false)
    expect(isRole(undefined)).toBe(false)
  })
})

describe('slug', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Boutique Açaí & Cia')).toBe('boutique-acai-cia')
    expect(slugify('  Moda  Feminina!! ')).toBe('moda-feminina')
  })
  it('limita a 40 caracteres sem terminar em hífen', () => {
    const s = slugify('a'.repeat(39) + ' b')
    expect(s.length).toBeLessThanOrEqual(40)
    expect(s.endsWith('-')).toBe(false)
  })
  it('aceita e recusa', () => {
    expect(slugProblem('loja-aurora')).toBeNull()
    expect(slugProblem('ab')).not.toBeNull()
    expect(slugProblem('-loja')).not.toBeNull()
    expect(slugProblem('Loja')).not.toBeNull()
    expect(slugProblem('admin')).not.toBeNull()
    expect(slugProblem('entrar')).not.toBeNull()
  })
  it('a lista de reservados do app é a mesma do banco', () => {
    const sql = readFileSync('supabase/migrations/20261004000005_reserved_slugs.sql', 'utf8')
    const inSql = [...sql.matchAll(/'([a-z_-]+)'/g)].map((m) => m[1]).filter((w) => !w.startsWith('^'))
    for (const w of RESERVED_SLUGS) expect(inSql).toContain(w)
    expect(inSql.sort()).toEqual([...RESERVED_SLUGS].sort())
  })
})

describe('safeNext (anti redirecionamento aberto)', () => {
  it('aceita caminhos internos', () => {
    expect(safeNext('/app/loja')).toBe('/app/loja')
    expect(safeNext('/app?x=1')).toBe('/app?x=1')
  })
  it('recusa destinos externos ou estranhos', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'evil', '', null, undefined, 42, '/a\nb']) {
      expect(safeNext(bad)).toBe('/app')
    }
  })
})

describe('validação', () => {
  it('login normaliza o e-mail', () => {
    const r = loginSchema.safeParse({ email: '  ANA@Loja.com ', password: 'x' })
    expect(r.success && r.data.email).toBe('ana@loja.com')
  })
  it('cadastro exige senha de 8+ e nome', () => {
    expect(signUpSchema.safeParse({ fullName: 'Ana', email: 'a@b.com', password: '1234567' }).success).toBe(false)
    expect(signUpSchema.safeParse({ fullName: 'A', email: 'a@b.com', password: '12345678' }).success).toBe(false)
    expect(signUpSchema.safeParse({ fullName: 'Ana', email: 'a@b.com', password: '12345678' }).success).toBe(true)
    expect(signUpSchema.safeParse({ fullName: 'Ana', email: 'nao-e-email', password: '12345678' }).success).toBe(false)
  })
  it('nova senha precisa de confirmação igual', () => {
    expect(newPasswordSchema.safeParse({ password: '12345678', confirm: '12345679' }).success).toBe(false)
    expect(newPasswordSchema.safeParse({ password: '12345678', confirm: '12345678' }).success).toBe(true)
  })
  it('loja valida nome e endereço', () => {
    expect(storeSchema.safeParse({ name: 'Aurora', slug: ' Aurora-Moda ' }).success).toBe(true)
    expect(storeSchema.safeParse({ name: '', slug: 'aurora' }).success).toBe(false)
    expect(storeSchema.safeParse({ name: 'X', slug: 'admin' }).success).toBe(false)
  })
  it('membro: só papéis conhecidos', () => {
    expect(addMemberSchema.safeParse({ email: 'a@b.com', role: 'attendant' }).success).toBe(true)
    expect(addMemberSchema.safeParse({ email: 'a@b.com', role: 'root' }).success).toBe(false)
  })
})

describe('mensagens de erro', () => {
  it('traduz erros de autenticação e nunca vaza o texto bruto', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
    expect(authErrorMessage({ code: 'xyz', message: 'secret stack' })).not.toContain('secret')
  })
  it('traduz erros de produto', () => {
    expect(dbErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "products_sku_uidx"' })).toContain('SKU')
    expect(dbErrorMessage({ code: 'P0002', message: 'not_found' })).toContain('não existe')
    expect(dbErrorMessage({ code: '23503', message: 'x' })).toContain('Categoria')
  })
  it('traduz erros de estoque', () => {
    expect(dbErrorMessage({ code: '23514', message: 'below_reserved' })).toContain('reservado')
    expect(dbErrorMessage({ code: '23514', message: 'insufficient_stock' })).toContain('suficiente')
  })
  it('traduz erros do banco', () => {
    expect(dbErrorMessage({ message: 'user_not_found', code: 'P0002' })).toContain('criar uma conta')
    expect(dbErrorMessage({ message: 'already_member', code: '23505' })).toContain('já faz parte')
    expect(dbErrorMessage({ code: '42501', message: 'x' })).toContain('permissão')
    expect(dbErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "stores_slug_key"' })).toContain('endereço')
  })
})
