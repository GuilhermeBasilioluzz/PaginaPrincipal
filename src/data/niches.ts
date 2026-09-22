/** Tipos de comércio que a pessoa pode prospectar, e qual projeto combina com cada um. */
export interface Niche {
  id: string
  label: string
  /** Texto enviado para a busca do Google Maps. */
  query: string
  /** Categoria de projeto sugerida (ver categories.ts). */
  categoryId: string
  /** O que o sistema resolve para esse tipo de negócio (entra na descrição do projeto). */
  idea: string
  /** Filtros do OpenStreetMap (Overpass) que encontram esse tipo de comércio na versão gratuita. */
  osm: string[]
}

export const niches: Niche[] = [
  { id: 'barbearia', label: 'Barbearia', query: 'barbearia', categoryId: 'scheduling', idea: 'agendamento online de horários, lembretes automáticos e fidelização de clientes', osm: ['["shop"="barber"]', '["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="hairdresser"]["name"~"barb",i]'] },
  { id: 'salao', label: 'Salão de beleza', query: 'salão de beleza', categoryId: 'scheduling', idea: 'agendamento online por profissional e serviço, lembretes e histórico de clientes', osm: ['["shop"="hairdresser"]', '["shop"="beauty"]'] },
  { id: 'estetica', label: 'Clínica de estética', query: 'clínica de estética', categoryId: 'scheduling', idea: 'agendamento de procedimentos, pacotes de sessões e ficha do cliente', osm: ['["shop"="beauty"]', '["amenity"="clinic"]["name"~"est[eé]tica",i]'] },
  { id: 'dentista', label: 'Clínica odontológica', query: 'clínica odontológica', categoryId: 'scheduling', idea: 'agendamento de consultas, confirmação por WhatsApp e prontuário do paciente', osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
  { id: 'veterinaria', label: 'Clínica veterinária', query: 'clínica veterinária', categoryId: 'scheduling', idea: 'agendamento de consultas, cadastro dos pets e lembretes de vacina', osm: ['["amenity"="veterinary"]'] },
  { id: 'petshop', label: 'Pet shop', query: 'pet shop', categoryId: 'scheduling', idea: 'agendamento de banho e tosa, avisos de pet pronto e venda de produtos', osm: ['["shop"="pet"]', '["shop"="pet_grooming"]'] },
  { id: 'academia', label: 'Academia', query: 'academia', categoryId: 'scheduling', idea: 'matrículas, agenda de aulas, controle de mensalidades e check-in', osm: ['["leisure"="fitness_centre"]', '["amenity"="gym"]'] },
  { id: 'restaurante', label: 'Restaurante', query: 'restaurante', categoryId: 'ecommerce', idea: 'cardápio digital e pedidos online para retirada e entrega', osm: ['["amenity"="restaurant"]'] },
  { id: 'pizzaria', label: 'Pizzaria', query: 'pizzaria', categoryId: 'ecommerce', idea: 'cardápio digital com montagem de pizza e pedidos para entrega', osm: ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"pizza",i]', '["amenity"~"^(restaurant|fast_food)$"]["name"~"pizz",i]'] },
  { id: 'hamburgueria', label: 'Hamburgueria', query: 'hamburgueria', categoryId: 'ecommerce', idea: 'cardápio digital, adicionais por item e pedidos para entrega', osm: ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"burger",i]', '["amenity"~"^(restaurant|fast_food)$"]["name"~"burg",i]'] },
  { id: 'roupas', label: 'Loja de roupas', query: 'loja de roupas', categoryId: 'ecommerce', idea: 'loja virtual com catálogo, grade de tamanhos e pagamento online', osm: ['["shop"="clothes"]', '["shop"="boutique"]'] },
  { id: 'oficina', label: 'Oficina mecânica', query: 'oficina mecânica', categoryId: 'saas', idea: 'ordens de serviço, orçamentos, histórico do veículo e avisos ao cliente', osm: ['["shop"="car_repair"]'] },
  { id: 'imobiliaria', label: 'Imobiliária', query: 'imobiliária', categoryId: 'landing', idea: 'site com vitrine de imóveis, filtros de busca e captação de interessados', osm: ['["office"="estate_agent"]', '["shop"="estate_agent"]'] },
  { id: 'advocacia', label: 'Escritório de advocacia', query: 'escritório de advocacia', categoryId: 'landing', idea: 'site profissional com áreas de atuação e captação de contatos', osm: ['["office"="lawyer"]'] },
  { id: 'idiomas', label: 'Escola de idiomas', query: 'escola de idiomas', categoryId: 'education', idea: 'área do aluno com aulas, materiais, turmas e acompanhamento de progresso', osm: ['["amenity"="language_school"]'] },
  { id: 'autoescola', label: 'Autoescola', query: 'autoescola', categoryId: 'education', idea: 'agenda de aulas práticas, conteúdo teórico online e acompanhamento do aluno', osm: ['["amenity"="driving_school"]'] },
]

export function getNiche(id: string): Niche | undefined {
  return niches.find((n) => n.id === id)
}

/** Nicho digitado livremente pela pessoa. */
export function customNiche(text: string): Niche {
  const label = text.trim()
  return { id: 'custom', label, query: label, categoryId: 'landing', idea: 'presença online e captação de novos clientes', osm: [] }
}

/** Atalhos para as capitais (centro aproximado). */
export const capitals = [
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
  { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 },
  { name: 'Brasília', lat: -15.7939, lng: -47.8828 },
  { name: 'Salvador', lat: -12.9777, lng: -38.5016 },
  { name: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  { name: 'Recife', lat: -8.0476, lng: -34.877 },
  { name: 'Porto Alegre', lat: -30.0346, lng: -51.2177 },
  { name: 'Fortaleza', lat: -3.7319, lng: -38.5267 },
  { name: 'Goiânia', lat: -16.6869, lng: -49.2648 },
]
