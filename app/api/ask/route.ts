import { NextRequest, NextResponse } from 'next/server'
import { AzureOpenAI } from 'openai'
import { AskRequest, RAGResponse } from '@/lib/types'
import { retrieve } from '@/lib/retrieval'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompt'

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: AskRequest = await request.json()
    const { question, topic } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    const documents = await retrieve(question, 'UK', topic)
    
    let response: RAGResponse

    if (documents.length === 0) {
      response = {
        answer: "I couldn't find relevant information in my sources to answer your question. Please check these official sources:\n\n• GOV.UK employment pages\n• ACAS guidance\n• HMRC guidance for tax-related matters",
        sources: [],
        confidence: 'low',
        refused: true,
      }
    } else {
      const userPrompt = buildUserPrompt(question, documents, topic)
      
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      const result = completion.choices[0].message.content
      response = JSON.parse(result || '{}') as RAGResponse
    }

    const latencyMs = Date.now() - startTime
    
    console.log({
      ts: new Date().toISOString(),
      question,
      topic,
      doc_ids: documents.map(d => d.id),
      latency_ms: latencyMs,
      refused: response.refused,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in /api/ask:', error)
    return NextResponse.json(
      { 
        error: 'An error occurred processing your request',
        answer: 'I encountered an error. Please try again.',
        sources: [],
        confidence: 'low',
        refused: true,
      },
      { status: 500 }
    )
  }
}