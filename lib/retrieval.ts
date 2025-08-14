import { createClient } from '@supabase/supabase-js'
import { AzureOpenAI } from 'openai'
import { Document, RetrievalResult } from './types'
import { generateEmbedding } from './embeddings'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
})

export async function vectorSearch(
  query: string,
  country: string = 'UK',
  topic?: string,
  limit: number = 12
): Promise<RetrievalResult> {
  const { embedding } = await generateEmbedding(query)

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: limit,
    filter_country: country,
    filter_topic: topic || null,
  })

  if (error) {
    console.error('Vector search error:', error)
    return { documents: [], scores: [] }
  }

  if (!data || data.length === 0) {
    return { documents: [], scores: [] }
  }

  const documents = data.map((row: any) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    country: row.country,
    topic: row.topic,
    section: row.section,
    content: row.content,
    last_crawled_at: row.last_crawled_at,
  }))

  const scores = data.map((row: any) => row.similarity)

  return { documents, scores }
}

export async function rerankDocuments(
  query: string,
  documents: Document[],
  topK: number = 6
): Promise<Document[]> {
  if (documents.length <= topK) {
    return documents
  }

  const prompt = `Given this query: "${query}"
  
Rank these documents by relevance (1 = most relevant):
${documents.map((doc, i) => `
${i + 1}. ${doc.title} - ${doc.section || 'Main'}
${doc.content.substring(0, 200)}...
`).join('')}

Return only the numbers of the top ${topK} most relevant documents as a comma-separated list.`

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 50,
  })

  const rankings = response.choices[0].message.content
    ?.split(',')
    .map(n => parseInt(n.trim()) - 1)
    .filter(n => !isNaN(n) && n >= 0 && n < documents.length) || []

  return rankings.slice(0, topK).map(index => documents[index])
}

export async function retrieve(
  query: string,
  country: string = 'UK',
  topic?: string,
  useReranking: boolean = true
): Promise<Document[]> {
  const { documents, scores } = await vectorSearch(query, country, topic)

  if (documents.length === 0) {
    return []
  }

  const threshold = 0.7
  const relevantDocs = documents.filter((_, i) => scores[i] >= threshold)

  if (relevantDocs.length === 0) {
    return documents.slice(0, 6)
  }

  if (useReranking && relevantDocs.length > 6) {
    return await rerankDocuments(query, relevantDocs, 6)
  }

  return relevantDocs.slice(0, 6)
}