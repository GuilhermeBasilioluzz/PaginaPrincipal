export type QuestionType = 'text' | 'textarea' | 'single' | 'multi'

export interface Question {
  id: string
  label: string
  type: QuestionType
  placeholder?: string
  help?: string
  options?: string[]
  required?: boolean
}

export interface Section {
  id: string
  title: string
  description?: string
  questions: Question[]
}

export interface Category {
  id: string
  name: string
  icon: string
  description: string
  /** Papel que a IA deve assumir no prompt gerado. */
  role: string
  /** Seções exclusivas deste segmento. */
  sections: Section[]
  /** Entregáveis que o prompt pede à IA, específicos do segmento. */
  deliverables: string[]
}

export type AnswerValue = string | string[]
export type Answers = Record<string, AnswerValue>
