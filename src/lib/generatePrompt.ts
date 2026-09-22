import { overviewSection, technicalSection } from '../data/categories'
import type { AnswerValue, Answers, Category, Question, Section } from '../data/types'

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return value.trim() !== ''
}

function formatValue(value: AnswerValue): string {
  return Array.isArray(value) ? value.join(', ') : value.trim()
}

/** Perguntas obrigatórias sem resposta em uma seção. */
export function missingRequired(section: Section, answers: Answers): Question[] {
  return section.questions.filter((q) => q.required && !isAnswered(answers[q.id]))
}

function sectionLines(section: Section, answers: Answers, skip: string[] = []): string[] {
  return section.questions
    .filter((q) => !skip.includes(q.id) && isAnswered(answers[q.id]))
    .map((q) => `- **${q.label}${q.label.endsWith('?') ? '' : ':'}** ${formatValue(answers[q.id])}`)
}

export function generatePrompt(category: Category, answers: Answers): string {
  const name = isAnswered(answers.projectName) ? formatValue(answers.projectName) : 'o projeto'
  const out: string[] = []

  out.push(`# Papel`)
  out.push(`Você é um ${category.role}. Seu trabalho é me ajudar a planejar e construir ${name}, um projeto da categoria **${category.name}**.`)

  out.push('', `# Descrição do sistema`)
  out.push(formatValue(answers.description ?? ''))

  const context = sectionLines(overviewSection, answers, ['projectName', 'description'])
  if (context.length) out.push('', `# Contexto`, ...context)

  const specific = category.sections.flatMap((s) => {
    const lines = sectionLines(s, answers)
    return lines.length ? ['', `## ${s.title}`, ...lines] : []
  })
  if (specific.length) out.push('', `# Requisitos de ${category.name}`, ...specific)

  const technical = sectionLines(technicalSection, answers, ['experience', 'extra'])
  out.push('', `# Requisitos técnicos`)
  if (technical.length) out.push(...technical)
  if (!isAnswered(answers.stack)) {
    out.push('- Não tenho preferência de tecnologia: recomende uma stack adequada e justifique a escolha.')
  }

  if (isAnswered(answers.extra)) out.push('', `# Observações adicionais`, formatValue(answers.extra))

  out.push('', `# O que eu preciso que você entregue`)
  category.deliverables.forEach((d, i) => out.push(`${i + 1}. ${d}`))
  out.push(`${category.deliverables.length + 1}. Um plano de implementação em etapas pequenas, começando por um MVP funcional`)

  out.push('', `# Regras`)
  out.push('- Antes de escrever código, liste as dúvidas ou suposições importantes sobre os requisitos.')
  out.push('- Siga boas práticas de segurança, organização de código e tratamento de erros.')
  out.push('- Não invente requisitos que eu não pedi; se sugerir algo extra, marque como opcional.')
  const experience = isAnswered(answers.experience) ? formatValue(answers.experience) : ''
  if (experience === 'Iniciante') {
    out.push('- Sou iniciante: explique cada passo de forma simples, sem pular etapas, incluindo como rodar o projeto.')
  } else if (experience) {
    out.push(`- Meu nível de experiência é ${experience.toLowerCase()}: ajuste o nível de detalhe das explicações.`)
  }

  out.push('', `# Formato da resposta`)
  out.push('Responda em português, usando Markdown com títulos para cada entregável e blocos de código quando houver código.')

  return out.join('\n')
}

