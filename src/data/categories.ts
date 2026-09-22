import type { Category, Section } from './types'

/** Perguntas feitas para todas as categorias, antes das específicas. */
export const overviewSection: Section = {
  id: 'overview',
  title: 'Visão geral',
  description: 'Conte em poucas palavras o que você quer construir.',
  questions: [
    {
      id: 'projectName',
      label: 'Nome do projeto',
      type: 'text',
      placeholder: 'Ex.: AgendaFácil',
    },
    {
      id: 'description',
      label: 'Descreva o sistema de forma simples',
      type: 'textarea',
      placeholder: 'Ex.: Um sistema para a minha barbearia onde os clientes marcam horário pelo celular.',
      required: true,
    },
    {
      id: 'audience',
      label: 'Quem vai usar?',
      type: 'text',
      placeholder: 'Ex.: clientes da barbearia, entre 18 e 40 anos',
    },
    {
      id: 'mainGoal',
      label: 'Qual é o principal objetivo?',
      type: 'single',
      options: ['Vender', 'Organizar processos internos', 'Captar clientes', 'Ensinar', 'Automatizar tarefas', 'Outro'],
    },
  ],
}

/** Perguntas feitas para todas as categorias, depois das específicas. */
export const technicalSection: Section = {
  id: 'technical',
  title: 'Preferências técnicas',
  description: 'Se não souber, deixe em branco — a IA vai sugerir.',
  questions: [
    {
      id: 'stack',
      label: 'Tecnologias preferidas',
      type: 'text',
      placeholder: 'Ex.: React, Node.js, PostgreSQL',
    },
    {
      id: 'experience',
      label: 'Seu nível de experiência com programação',
      type: 'single',
      options: ['Iniciante', 'Intermediário', 'Avançado'],
    },
    {
      id: 'priorities',
      label: 'O que é mais importante?',
      type: 'multi',
      options: ['Segurança', 'Performance', 'Baixo custo', 'Facilidade de manutenção', 'Design bonito', 'Acessibilidade', 'SEO'],
    },
    {
      id: 'extra',
      label: 'Algo mais que a IA deva saber?',
      type: 'textarea',
      placeholder: 'Restrições, prazos, referências de sites que você gosta…',
    },
  ],
}

export const categories: Category[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce',
    icon: '🛒',
    description: 'Loja virtual, catálogo de produtos e vendas online.',
    role: 'engenheiro de software sênior especializado em e-commerce e conversão de vendas',
    sections: [
      {
        id: 'ecommerce-catalog',
        title: 'Produtos e catálogo',
        questions: [
          { id: 'productType', label: 'O que você vai vender?', type: 'single', options: ['Produtos físicos', 'Produtos digitais', 'Serviços', 'Assinaturas'], required: true },
          { id: 'catalogSize', label: 'Quantos produtos, aproximadamente?', type: 'single', options: ['Até 50', '50 a 500', 'Mais de 500'] },
          { id: 'variations', label: 'Os produtos têm variações?', type: 'multi', options: ['Tamanho', 'Cor', 'Sabor', 'Personalização', 'Não têm'] },
        ],
      },
      {
        id: 'ecommerce-checkout',
        title: 'Vendas e pagamento',
        questions: [
          { id: 'payments', label: 'Formas de pagamento', type: 'multi', options: ['Pix', 'Cartão de crédito', 'Boleto', 'Carteiras digitais'], required: true },
          { id: 'shipping', label: 'Como será a entrega?', type: 'multi', options: ['Correios', 'Transportadora', 'Entrega própria', 'Retirada no local', 'Não se aplica'] },
          { id: 'ecommerceFeatures', label: 'Funcionalidades desejadas', type: 'multi', options: ['Cupons de desconto', 'Avaliações de clientes', 'Lista de desejos', 'Carrinho abandonado', 'Painel de estoque', 'Área do cliente'] },
        ],
      },
    ],
    deliverables: [
      'Arquitetura da aplicação e modelo de dados (produtos, pedidos, clientes, estoque)',
      'Fluxo completo de compra, do catálogo à confirmação do pedido',
      'Integração com gateway de pagamento e cálculo de frete',
      'Painel administrativo para gerenciar produtos e pedidos',
    ],
  },
  {
    id: 'saas',
    name: 'SaaS / Sistema de gestão',
    icon: '📊',
    description: 'Software por assinatura, ERP, CRM ou painel administrativo.',
    role: 'arquiteto de software sênior especializado em produtos SaaS B2B',
    sections: [
      {
        id: 'saas-business',
        title: 'Modelo do sistema',
        questions: [
          { id: 'saasType', label: 'Que tipo de sistema é?', type: 'single', options: ['CRM', 'ERP / gestão', 'Financeiro', 'Gestão de projetos', 'Recursos humanos', 'Outro'], required: true },
          { id: 'multiTenant', label: 'Vários clientes (empresas) vão usar o mesmo sistema?', type: 'single', options: ['Sim, cada empresa com seus dados', 'Não, é para uma empresa só'] },
          { id: 'billing', label: 'Como será cobrado?', type: 'single', options: ['Assinatura mensal', 'Por usuário', 'Plano gratuito + pago', 'Uso interno, sem cobrança'] },
        ],
      },
      {
        id: 'saas-features',
        title: 'Usuários e funcionalidades',
        questions: [
          { id: 'roles', label: 'Tipos de usuário', type: 'text', placeholder: 'Ex.: administrador, gerente, vendedor' },
          { id: 'coreEntities', label: 'Principais cadastros do sistema', type: 'textarea', placeholder: 'Ex.: clientes, contratos, faturas, tarefas' },
          { id: 'saasFeatures', label: 'Funcionalidades desejadas', type: 'multi', options: ['Dashboard com gráficos', 'Relatórios exportáveis', 'Notificações por e-mail', 'Permissões por perfil', 'Integração via API', 'Log de auditoria'] },
        ],
      },
    ],
    deliverables: [
      'Arquitetura (incluindo estratégia multi-tenant, se aplicável) e modelo de dados',
      'Sistema de autenticação e controle de acesso por perfil',
      'CRUDs das entidades principais e dashboard inicial',
      'Estratégia de planos e cobrança, se houver',
    ],
  },
  {
    id: 'landing',
    name: 'Site institucional / Landing page',
    icon: '🌐',
    description: 'Presença online, página de vendas ou captação de leads.',
    role: 'desenvolvedor front-end sênior e especialista em UX e copywriting para conversão',
    sections: [
      {
        id: 'landing-content',
        title: 'Conteúdo e páginas',
        questions: [
          { id: 'business', label: 'Qual é o negócio ou produto?', type: 'text', placeholder: 'Ex.: escritório de advocacia trabalhista', required: true },
          { id: 'pages', label: 'Seções ou páginas desejadas', type: 'multi', options: ['Início / Hero', 'Sobre', 'Serviços', 'Depoimentos', 'Preços', 'Perguntas frequentes', 'Blog', 'Contato'] },
          { id: 'cta', label: 'Qual ação o visitante deve tomar?', type: 'single', options: ['Falar no WhatsApp', 'Preencher formulário', 'Comprar', 'Agendar', 'Baixar material'] },
        ],
      },
      {
        id: 'landing-style',
        title: 'Identidade visual',
        questions: [
          { id: 'tone', label: 'Tom de comunicação', type: 'single', options: ['Profissional', 'Descontraído', 'Luxuoso', 'Técnico', 'Acolhedor'] },
          { id: 'brand', label: 'Cores, logo e referências', type: 'textarea', placeholder: 'Ex.: azul-marinho e dourado; gosto do estilo do site X' },
        ],
      },
    ],
    deliverables: [
      'Estrutura de seções com textos (copy) sugeridos para cada uma',
      'Código responsivo, com foco em performance e SEO',
      'Chamadas para ação claras e integração com o canal de contato escolhido',
    ],
  },
  {
    id: 'mobile',
    name: 'Aplicativo mobile',
    icon: '📱',
    description: 'App para Android e/ou iOS.',
    role: 'desenvolvedor mobile sênior especializado em apps multiplataforma',
    sections: [
      {
        id: 'mobile-platform',
        title: 'Plataforma',
        questions: [
          { id: 'platforms', label: 'Para quais plataformas?', type: 'multi', options: ['Android', 'iOS', 'Web (PWA)'], required: true },
          { id: 'offline', label: 'Precisa funcionar sem internet?', type: 'single', options: ['Sim', 'Parcialmente', 'Não'] },
        ],
      },
      {
        id: 'mobile-features',
        title: 'Funcionalidades',
        questions: [
          { id: 'mainScreens', label: 'Principais telas', type: 'textarea', placeholder: 'Ex.: login, lista de serviços, agendamento, perfil' },
          { id: 'mobileFeatures', label: 'Recursos do celular', type: 'multi', options: ['Notificações push', 'Câmera', 'Localização / GPS', 'Login com Google/Apple', 'Pagamento no app', 'Chat'] },
        ],
      },
    ],
    deliverables: [
      'Escolha justificada de tecnologia (nativo ou multiplataforma)',
      'Mapa de navegação entre as telas',
      'Estrutura do projeto, componentes e gerenciamento de estado',
      'Passos para publicar nas lojas',
    ],
  },
  {
    id: 'education',
    name: 'Educação / Cursos online',
    icon: '🎓',
    description: 'Plataforma de cursos, área de membros ou escola.',
    role: 'engenheiro de software sênior especializado em plataformas de ensino (EdTech)',
    sections: [
      {
        id: 'education-content',
        title: 'Conteúdo',
        questions: [
          { id: 'contentFormat', label: 'Formato das aulas', type: 'multi', options: ['Vídeo', 'Texto', 'PDF / materiais', 'Aulas ao vivo', 'Áudio'], required: true },
          { id: 'courseStructure', label: 'Como os cursos são organizados?', type: 'text', placeholder: 'Ex.: cursos > módulos > aulas' },
        ],
      },
      {
        id: 'education-features',
        title: 'Alunos e recursos',
        questions: [
          { id: 'access', label: 'Como o aluno ganha acesso?', type: 'single', options: ['Compra avulsa', 'Assinatura', 'Gratuito', 'Cadastro manual pela escola'] },
          { id: 'educationFeatures', label: 'Recursos desejados', type: 'multi', options: ['Progresso do aluno', 'Quizzes / provas', 'Certificados', 'Comentários nas aulas', 'Gamificação', 'Painel do professor'] },
        ],
      },
    ],
    deliverables: [
      'Modelo de dados de cursos, módulos, aulas e matrículas',
      'Área do aluno com acompanhamento de progresso',
      'Painel para cadastro de conteúdo',
      'Estratégia de hospedagem e proteção dos vídeos/materiais',
    ],
  },
  {
    id: 'scheduling',
    name: 'Serviços e agendamentos',
    icon: '📅',
    description: 'Clínicas, salões, consultorias e reservas.',
    role: 'engenheiro de software sênior especializado em sistemas de agendamento',
    sections: [
      {
        id: 'scheduling-business',
        title: 'Negócio',
        questions: [
          { id: 'serviceType', label: 'Qual é o tipo de negócio?', type: 'text', placeholder: 'Ex.: clínica de fisioterapia', required: true },
          { id: 'professionals', label: 'Quantos profissionais atendem?', type: 'single', options: ['Só eu', '2 a 5', 'Mais de 5'] },
          { id: 'locations', label: 'Onde acontece o atendimento?', type: 'multi', options: ['No local', 'Online', 'Na casa do cliente'] },
        ],
      },
      {
        id: 'scheduling-rules',
        title: 'Agenda e regras',
        questions: [
          { id: 'schedulingRules', label: 'Regras de agendamento', type: 'textarea', placeholder: 'Ex.: horários de 30 min, cancelamento até 24h antes' },
          { id: 'schedulingFeatures', label: 'Funcionalidades desejadas', type: 'multi', options: ['Lembrete por WhatsApp/e-mail', 'Pagamento antecipado', 'Lista de espera', 'Prontuário / histórico do cliente', 'Integração com Google Agenda', 'Avaliação pós-atendimento'] },
        ],
      },
    ],
    deliverables: [
      'Modelo de dados de profissionais, serviços, horários e agendamentos',
      'Lógica de disponibilidade que evite conflitos de horário',
      'Fluxo de agendamento para o cliente e painel para o negócio',
      'Estratégia de lembretes e notificações',
    ],
  },
]

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}

/** Todas as etapas do questionário de uma categoria, na ordem. */
export function getSections(category: Category): Section[] {
  return [overviewSection, ...category.sections, technicalSection]
}
