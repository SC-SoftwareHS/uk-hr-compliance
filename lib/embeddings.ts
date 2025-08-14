import { config } from 'dotenv'
config({ path: '.env.local' })
import { AzureOpenAI } from 'openai'
import { EmbeddingResult } from './types'

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
})

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const response = await client.embeddings.create({
    model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    input: text,
    dimensions: 1536,
  })

  return {
    embedding: response.data[0].embedding,
    usage: {
      prompt_tokens: response.usage.prompt_tokens,
      total_tokens: response.usage.total_tokens,
    },
  }
}

export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const response = await client.embeddings.create({
    model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    input: texts,
    dimensions: 1536,
  })

  return response.data.map((data, index) => ({
    embedding: data.embedding,
    usage: {
      prompt_tokens: response.usage.prompt_tokens / texts.length,
      total_tokens: response.usage.total_tokens / texts.length,
    },
  }))
}