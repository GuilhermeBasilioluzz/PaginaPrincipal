// Espelho das regras do banco (supabase/migrations/..._rls.sql). O banco é quem DECIDE;
// isto só serve para mostrar ou esconder botões. Se mudar um, mude o outro.

export type Role = 'owner' | 'manager' | 'attendant'

export const ROLES: Role[] = ['owner', 'manager', 'attendant']

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dono(a)',
  manager: 'Gerente',
  attendant: 'Atendente',
}

export type Capability =
  | 'edit_store'
  | 'manage_team'
  | 'manage_structure' // categorias e coleções
  | 'edit_products'
  | 'delete_products'
  | 'update_stock'
  | 'view_reports'

const MATRIX: Record<Capability, Role[]> = {
  edit_store: ['owner'],
  manage_team: ['owner'],
  manage_structure: ['owner', 'manager'],
  edit_products: ['owner', 'manager', 'attendant'],
  delete_products: ['owner', 'manager'],
  update_stock: ['owner', 'manager', 'attendant'],
  view_reports: ['owner', 'manager'],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[capability].includes(role)
}
