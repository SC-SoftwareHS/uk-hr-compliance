export interface Document {
  id: string
  title: string
  url: string
  country: string
  topic?: string
  section?: string
  content: string
  last_crawled_at: string
  embedding?: number[]
}

export interface Source {
  title: string
  url: string
}

export interface RAGResponse {
  answer: string
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  refused: boolean
}

export interface AskRequest {
  question: string
  topic?: string
}

export interface EmbeddingResult {
  embedding: number[]
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface RetrievalResult {
  documents: Document[]
  scores: number[]
}

export type Topic = 'TUPE' | 'Sick' | 'Maternity/Paternity' | 'Holiday' | 'Pensions' | 'Visas' | 'Employment' | 'Redundancy' | 'Disciplinary' | 'Working Time' | 'Equality' | 'Health Safety'