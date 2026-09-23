/**
 * Dados de quem vende o PromptForge. Aparecem nos Termos de Uso e na Política de Privacidade.
 * PREENCHA antes de começar a vender. Campos vazios usam um texto genérico.
 */
export const company = {
  /** Nome da marca, como aparece no site. */
  brand: 'PromptForge',
  /** Seu nome completo ou a razão social da empresa. Ex.: 'Fulano de Tal ME' */
  legalName: '',
  /** CPF ou CNPJ. Ex.: '12.345.678/0001-90' */
  document: '',
  /** E-mail para suporte e para pedidos sobre dados pessoais (LGPD). Ex.: 'contato@seudominio.com.br' */
  contactEmail: '',
  /** Data da última atualização dos documentos. */
  updatedAt: '23 de setembro de 2026',
}

/** Quem é o responsável, em texto corrido. */
export function responsible(): string {
  const name = company.legalName || `o responsável pelo ${company.brand}`
  return company.document ? `${name}, inscrito(a) sob o nº ${company.document}` : name
}

/** Como falar com o responsável, em texto corrido. */
export function contactText(): string {
  return company.contactEmail
    ? `pelo e-mail ${company.contactEmail}`
    : 'pelo e-mail de suporte informado no comprovante da sua compra'
}
