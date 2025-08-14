import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { generateEmbeddings } from '../lib/embeddings'
import { Document } from '../lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SeedURL {
  url: string
  topic: string
  title?: string
}

const SEED_URLS: SeedURL[] = [
  // TUPE
  { url: 'https://www.gov.uk/transfers-takeovers', topic: 'TUPE', title: 'TUPE transfers and takeovers' },
  { url: 'https://www.acas.org.uk/tupe', topic: 'TUPE', title: 'TUPE - ACAS guidance' },
  
  // Statutory Sick Pay
  { url: 'https://www.gov.uk/statutory-sick-pay', topic: 'Sick', title: 'Statutory Sick Pay (SSP)' },
  { url: 'https://www.acas.org.uk/absence-from-work/time-off-sick', topic: 'Sick', title: 'Time off sick - ACAS' },
  
  // Maternity/Paternity
  { url: 'https://www.gov.uk/maternity-pay-leave', topic: 'Maternity/Paternity', title: 'Maternity pay and leave' },
  { url: 'https://www.gov.uk/paternity-pay-leave', topic: 'Maternity/Paternity', title: 'Paternity pay and leave' },
  { url: 'https://www.acas.org.uk/maternity-paternity-and-adoption-leave', topic: 'Maternity/Paternity', title: 'Maternity, paternity and adoption - ACAS' },
  
  // Holiday entitlement
  { url: 'https://www.gov.uk/holiday-entitlement-rights', topic: 'Holiday', title: 'Holiday entitlement' },
  { url: 'https://www.acas.org.uk/checking-holiday-entitlement', topic: 'Holiday', title: 'Checking holiday entitlement - ACAS' },
  
  // Employment contracts
  { url: 'https://www.gov.uk/employment-contracts-and-conditions', topic: 'Employment', title: 'Employment contracts' },
  
  // Right to work/visas
  { url: 'https://www.gov.uk/legal-right-work-uk', topic: 'Visas', title: 'Right to work in the UK' },
  { url: 'https://www.gov.uk/check-job-applicant-right-to-work', topic: 'Visas', title: 'Check right to work' },
  
  // Redundancy
  { url: 'https://www.gov.uk/redundancy-your-rights', topic: 'Redundancy', title: 'Redundancy rights' },
  
  // Disciplinaries
  { url: 'https://www.acas.org.uk/disciplinary-procedure-step-by-step', topic: 'Disciplinary', title: 'Disciplinary procedures - ACAS' },
]

async function fetchAndParse(url: string): Promise<{ title: string; content: string; textContent: string } | null> {
  try {
    const response = await fetch(url)
    const html = await response.text()
    
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    
    if (!article) {
      console.error(`Failed to parse ${url}`)
      return null
    }
    
    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return null
  }
}

function chunkByHeadings(html: string, textContent: string, maxTokens: number = 1000): { section: string; content: string }[] {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const chunks: { section: string; content: string }[] = []
  
  const headings = doc.querySelectorAll('h2, h3')
  
  if (headings.length === 0) {
    // Fallback to token-based chunking
    const words = textContent.split(/\s+/)
    const wordsPerChunk = maxTokens * 0.75 // Rough estimate
    const overlap = Math.floor(wordsPerChunk * 0.1)
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlap) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ')
      chunks.push({ section: `Part ${chunks.length + 1}`, content: chunk })
    }
    
    return chunks
  }
  
  // Chunk by headings
  headings.forEach((heading, index) => {
    const section = heading.textContent?.trim() || `Section ${index + 1}`
    let content = ''
    let node = heading.nextSibling
    
    while (node && !['H2', 'H3'].includes(node.nodeName)) {
      if (node.textContent) {
        content += node.textContent + ' '
      }
      node = node.nextSibling
    }
    
    if (content.trim()) {
      chunks.push({ section, content: content.trim() })
    }
  })
  
  return chunks
}

async function ingestURL(seedUrl: SeedURL) {
  console.log(`Ingesting ${seedUrl.url}...`)
  
  const parsed = await fetchAndParse(seedUrl.url)
  if (!parsed) return
  
  const chunks = chunkByHeadings(parsed.content, parsed.textContent)
  console.log(`Found ${chunks.length} chunks`)
  
  for (const chunk of chunks) {
    const document: Partial<Document> = {
      title: seedUrl.title || parsed.title,
      url: seedUrl.url,
      country: 'UK',
      topic: seedUrl.topic,
      section: chunk.section,
      content: chunk.content,
      last_crawled_at: new Date().toISOString(),
    }
    
    // Generate embedding
    const { embedding } = await generateEmbeddings([chunk.content]).then(results => results[0])
    
    // Upsert to database
    const { error } = await supabase
      .from('documents')
      .upsert({
        ...document,
        embedding,
      }, {
        onConflict: 'url,section',
      })
    
    if (error) {
      console.error(`Error upserting chunk for ${seedUrl.url}:`, error)
    } else {
      console.log(`✓ Ingested: ${chunk.section}`)
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

async function main() {
  console.log('Starting ingestion...')
  console.log(`Processing ${SEED_URLS.length} URLs`)
  
  for (const seedUrl of SEED_URLS) {
    await ingestURL(seedUrl)
  }
  
  console.log('Ingestion complete!')
}

main().catch(console.error)