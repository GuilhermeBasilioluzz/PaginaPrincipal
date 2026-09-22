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
      id: 'problem',
      label: 'Que problema esse sistema resolve hoje?',
      type: 'textarea',
      placeholder: 'Ex.: os clientes ligam o dia todo para marcar horário e a agenda de papel vive dando conflito.',
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
      id: 'deadline',
      label: 'Prazo desejado para a primeira versão',
      type: 'single',
      options: ['Até 1 mês', '1 a 3 meses', 'Mais de 3 meses', 'Sem prazo definido'],
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
      {
        id: 'ecommerce-operation',
        title: 'Operação e divulgação',
        questions: [
          { id: 'physicalStore', label: 'Também tem loja física?', type: 'single', options: ['Sim, e o estoque é compartilhado', 'Sim, com estoque separado', 'Não, só online'] },
          { id: 'averageTicket', label: 'Valor médio de uma compra', type: 'single', options: ['Até R$ 100', 'R$ 100 a R$ 300', 'R$ 300 a R$ 1.000', 'Acima de R$ 1.000'] },
          { id: 'invoice', label: 'Emite nota fiscal?', type: 'single', options: ['Sim, precisa ser automática', 'Sim, faço manualmente', 'Não'] },
          { id: 'ecommerceIntegrations', label: 'Integrações desejadas', type: 'multi', options: ['WhatsApp', 'Instagram / Facebook Shop', 'Google Shopping', 'Marketplaces (Mercado Livre, Shopee)', 'Sistema de gestão (ERP)', 'E-mail marketing'] },
          { id: 'differential', label: 'O que diferencia a sua loja das concorrentes?', type: 'textarea', placeholder: 'Ex.: peças exclusivas, entrega no mesmo dia na cidade, atendimento personalizado' },
        ],
      },
    ],
    deliverables: [
      'Arquitetura da aplicação e modelo de dados (produtos, pedidos, clientes, estoque)',
      'Fluxo completo de compra, do catálogo à confirmação do pedido',
      'Integração com gateway de pagamento e cálculo de frete',
      'Painel administrativo para gerenciar produtos e pedidos',
      'Integrações de divulgação e de emissão de nota fiscal, se aplicável',
    ],
  },
  {
    id: 'saas',
    name: 'SaaS / Sistema de gestão',
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
      {
        id: 'saas-rules',
        title: 'Processos e regras',
        questions: [
          { id: 'currentTool', label: 'Como esse trabalho é feito hoje?', type: 'single', options: ['Planilhas', 'Papel / caderno', 'Outro sistema', 'WhatsApp e memória', 'Ainda não existe'] },
          { id: 'workflows', label: 'Descreva o processo principal, passo a passo', type: 'textarea', placeholder: 'Ex.: cliente pede orçamento → técnico visita → orçamento aprovado → serviço → cobrança' },
          { id: 'usersCount', label: 'Quantas pessoas vão usar ao mesmo tempo?', type: 'single', options: ['Até 10', '10 a 100', 'Mais de 100'] },
          { id: 'saasIntegrations', label: 'Integrações necessárias', type: 'multi', options: ['WhatsApp', 'E-mail', 'Pagamentos (Pix/cartão)', 'Nota fiscal', 'Google Agenda', 'Importar planilhas'] },
          { id: 'sensitiveData', label: 'Vai guardar dados pessoais ou sensíveis (LGPD)?', type: 'single', options: ['Sim, dados pessoais', 'Sim, dados de saúde ou financeiros', 'Não', 'Não sei'] },
          { id: 'saasMobile', label: 'Vai ser usado no celular?', type: 'single', options: ['Principalmente no celular', 'No celular e no computador', 'Só no computador'] },
        ],
      },
    ],
    deliverables: [
      'Arquitetura (incluindo estratégia multi-tenant, se aplicável) e modelo de dados',
      'Sistema de autenticação e controle de acesso por perfil',
      'CRUDs das entidades principais e dashboard inicial',
      'Estratégia de planos e cobrança, se houver',
      'Adequação à LGPD e plano para migrar os dados que existem hoje',
    ],
  },
  {
    id: 'landing',
    name: 'Site institucional / Landing page',
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
      {
        id: 'landing-growth',
        title: 'Captação e resultados',
        questions: [
          { id: 'leadCapture', label: 'Como captar os contatos?', type: 'multi', options: ['Botão de WhatsApp', 'Formulário', 'Agendamento online', 'Chat no site', 'Lista de e-mails'] },
          { id: 'searchTerms', label: 'Como os clientes procuram esse negócio no Google?', type: 'text', placeholder: 'Ex.: advogado trabalhista em Campinas' },
          { id: 'competitors', label: 'Concorrentes ou sites de referência', type: 'text', placeholder: 'Ex.: site do concorrente X, página Y que eu gosto' },
          { id: 'domain', label: 'Já tem domínio (endereço .com.br)?', type: 'single', options: ['Sim', 'Não, preciso registrar', 'Não sei o que é'] },
          { id: 'contentUpdates', label: 'Quem vai atualizar o conteúdo?', type: 'single', options: ['O próprio dono, com um painel simples', 'Um desenvolvedor', 'Quase nunca muda'] },
          { id: 'tracking', label: 'Ferramentas de acompanhamento', type: 'multi', options: ['Google Analytics', 'Pixel do Meta', 'Perfil da Empresa no Google', 'Nenhuma por enquanto'] },
        ],
      },
    ],
    deliverables: [
      'Estrutura de seções com textos (copy) sugeridos para cada uma',
      'Código responsivo, com foco em performance e SEO',
      'Chamadas para ação claras e integração com o canal de contato escolhido',
      'Configuração de SEO local, domínio e ferramentas de acompanhamento',
    ],
  },
  {
    id: 'mobile',
    name: 'Aplicativo mobile',
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
      {
        id: 'mobile-business',
        title: 'Negócio e publicação',
        questions: [
          { id: 'monetization', label: 'Como o app gera receita?', type: 'single', options: ['Gratuito (apoia o negócio)', 'Assinatura', 'Compras dentro do app', 'Anúncios', 'Uso interno da empresa'] },
          { id: 'userAccounts', label: 'O usuário precisa criar conta?', type: 'single', options: ['Sim, obrigatório', 'Opcional', 'Não'] },
          { id: 'adminPanel', label: 'Precisa de um painel web para gerenciar o app?', type: 'single', options: ['Sim', 'Não', 'Não sei'] },
          { id: 'mobileIntegrations', label: 'Integrações', type: 'multi', options: ['WhatsApp', 'Pagamentos', 'Mapas', 'Redes sociais', 'Agenda do celular'] },
          { id: 'storePublish', label: 'Publicação nas lojas (Google Play / App Store)', type: 'single', options: ['Tenho as contas de desenvolvedor', 'Preciso de ajuda para criar', 'Ainda não sei'] },
          { id: 'appReferences', label: 'Apps que servem de referência', type: 'text', placeholder: 'Ex.: gosto da simplicidade do app X' },
        ],
      },
    ],
    deliverables: [
      'Escolha justificada de tecnologia (nativo ou multiplataforma)',
      'Mapa de navegação entre as telas',
      'Estrutura do projeto, componentes e gerenciamento de estado',
      'Painel de gerenciamento, se necessário',
      'Passos para publicar nas lojas',
    ],
  },
  {
    id: 'education',
    name: 'Educação / Cursos online',
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
      {
        id: 'education-business',
        title: 'Vendas e comunidade',
        questions: [
          { id: 'studentsCount', label: 'Quantos alunos no primeiro ano?', type: 'single', options: ['Até 100', '100 a 1.000', 'Mais de 1.000'] },
          { id: 'teachers', label: 'Quem ensina?', type: 'single', options: ['Só eu', 'Vários professores', 'Uma escola com equipe'] },
          { id: 'eduPayments', label: 'Formas de pagamento', type: 'multi', options: ['Pix', 'Cartão de crédito', 'Parcelamento', 'Boleto', 'Não se aplica'] },
          { id: 'community', label: 'Interação com os alunos', type: 'multi', options: ['Fórum / comentários', 'Grupo de WhatsApp ou Telegram', 'Aulas ao vivo', 'Mentoria individual'] },
          { id: 'contentProtection', label: 'Proteger os vídeos contra cópia é importante?', type: 'single', options: ['Essencial', 'Desejável', 'Não importa'] },
          { id: 'eduIntegrations', label: 'Integrações', type: 'multi', options: ['Zoom / Google Meet', 'YouTube / Vimeo', 'E-mail marketing', 'Emissão de certificados'] },
        ],
      },
    ],
    deliverables: [
      'Modelo de dados de cursos, módulos, aulas e matrículas',
      'Área do aluno com acompanhamento de progresso',
      'Painel para cadastro de conteúdo',
      'Estratégia de hospedagem e proteção dos vídeos/materiais',
      'Fluxo de venda, matrícula e emissão de certificados',
    ],
  },
  {
    id: 'scheduling',
    name: 'Serviços e agendamentos',
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
      {
        id: 'scheduling-ops',
        title: 'Clientes e operação',
        questions: [
          { id: 'currentScheduling', label: 'Como os horários são marcados hoje?', type: 'single', options: ['WhatsApp', 'Telefone', 'Agenda de papel', 'Outro aplicativo', 'Chegada sem hora marcada'] },
          { id: 'servicesList', label: 'Principais serviços, com duração e preço', type: 'textarea', placeholder: 'Ex.: corte 30 min R$ 45; barba 20 min R$ 30; corte + barba 50 min R$ 70' },
          { id: 'bookingChannels', label: 'Por onde o cliente vai agendar?', type: 'multi', options: ['Site', 'Aplicativo', 'Link no WhatsApp', 'Link no Instagram', 'Recepção / balcão'] },
          { id: 'clientData', label: 'O que guardar de cada cliente?', type: 'multi', options: ['Nome e telefone', 'Histórico de atendimentos', 'Preferências', 'Data de aniversário', 'Fotos de antes e depois'] },
          { id: 'loyalty', label: 'Quer um programa de fidelidade?', type: 'single', options: ['Sim (ex.: 10º corte grátis)', 'Talvez depois', 'Não'] },
          { id: 'reports', label: 'Relatórios desejados', type: 'multi', options: ['Faturamento por período', 'Serviços mais vendidos', 'Desempenho por profissional', 'Faltas e cancelamentos'] },
        ],
      },
    ],
    deliverables: [
      'Modelo de dados de profissionais, serviços, horários e agendamentos',
      'Lógica de disponibilidade que evite conflitos de horário',
      'Fluxo de agendamento para o cliente e painel para o negócio',
      'Estratégia de lembretes e notificações',
      'Cadastro de clientes, fidelidade e relatórios do negócio',
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
