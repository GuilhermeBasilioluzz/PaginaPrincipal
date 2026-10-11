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
  | 'invite'
  | 'view_all_activity'

const MATRIX: Record<Capability, Role[]> = {
  edit_store: ['owner'],
  manage_team: ['owner'],
  manage_structure: ['owner', 'manager'],
  edit_products: ['owner', 'manager', 'attendant'],
  delete_products: ['owner', 'manager'],
  update_stock: ['owner', 'manager', 'attendant'],
  view_reports: ['owner', 'manager'],
  invite: ['owner'],
  view_all_activity: ['owner', 'manager'],
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[capability].includes(role)
}

/** Tabela "quem pode o quê" mostrada na tela da equipe. Um teste garante que ela bate com as regras reais (can). */
export const PERMISSION_TABLE: { label: string; capability: Capability; owner: boolean; manager: boolean; attendant: boolean }[] = [
  { label: 'Cadastrar e editar produtos, fotos e estoque', capability: 'edit_products', owner: true, manager: true, attendant: true },
  { label: 'Fazer reservas e anotar interessadas', capability: 'update_stock', owner: true, manager: true, attendant: true },
  { label: 'Excluir produtos (atendente só arquiva)', capability: 'delete_products', owner: true, manager: true, attendant: false },
  { label: 'Criar categorias e coleções', capability: 'manage_structure', owner: true, manager: true, attendant: false },
  { label: 'Ver o histórico de toda a equipe (atendente vê só o próprio)', capability: 'view_all_activity', owner: true, manager: true, attendant: false },
  { label: 'Convidar pessoas e mudar papéis', capability: 'manage_team', owner: true, manager: false, attendant: false },
  { label: 'Alterar configurações, logo e catálogo da loja', capability: 'edit_store', owner: true, manager: false, attendant: false },
]
