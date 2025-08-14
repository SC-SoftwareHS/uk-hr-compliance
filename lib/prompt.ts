import { Document } from './types'

export const SYSTEM_PROMPT = `You are an HR compliance advisor for UK employment. Answer ONLY using the provided context chunks. 
If context is insufficient or outdated, explicitly say so and list likely official sources to check next.
Style: plain English, short bullets, include a concise "Key steps" checklist for procedural topics.
Every factual bullet must include a bracketed citation like [1] that maps to the Sources list (title + URL). 
Never invent law, dates, thresholds, or numbers.`

export function buildUserPrompt(
  question: string,
  documents: Document[],
  topic?: string
): string {
  const contextChunks = documents.map((doc, i) => 
    `${i + 1}) ${doc.title} - ${doc.section || 'Main'}
URL: ${doc.url}
Excerpt: ${doc.content}`
  ).join('\n\n')

  return `Question: ${question}
${topic ? `Topic filter (optional): ${topic}` : ''}
Context Chunks (each has title, url, section, excerpt):
${contextChunks}

Return JSON:
{
  "answer": "<markdown with bracketed [n] citations>",
  "sources": [{"title": "...", "url": "..."}, ...],
  "confidence": "high" | "medium" | "low",
  "refused": boolean
}`
}

export function extractSourcesFromAnswer(answer: string, documents: Document[]): { title: string; url: string }[] {
  const sources: { title: string; url: string }[] = []
  const citationPattern = /\[(\d+)\]/g
  const citations = new Set<number>()
  
  let match
  while ((match = citationPattern.exec(answer)) !== null) {
    const index = parseInt(match[1]) - 1
    if (index >= 0 && index < documents.length) {
      citations.add(index)
    }
  }

  citations.forEach(index => {
    sources.push({
      title: documents[index].title,
      url: documents[index].url,
    })
  })

  return sources
}