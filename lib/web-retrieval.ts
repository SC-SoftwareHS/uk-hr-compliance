import { config } from 'dotenv'
config({ path: '.env.local' })
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { generateEmbedding } from './embeddings'
import { createClient } from '@supabase/supabase-js'
import { Document } from './types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Search GOV.UK API for relevant pages
async function searchGovUK(query: string): Promise<Array<{url: string, title: string}>> {
  const searchUrl = `https://www.gov.uk/api/search.json?q=${encodeURIComponent(query)}&count=5&fields=web_url,title`
  
  try {
    const response = await fetch(searchUrl)
    if (!response.ok) {
      console.error(`GOV.UK search failed: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    return data.results?.map((result: any) => ({
      url: result.web_url,
      title: result.title
    })).filter((item: any) => 
      item.url && 
      item.url.includes('gov.uk') &&
      !item.url.includes('/api/') &&
      !item.url.includes('#')
    ) || []
  } catch (error) {
    console.error('GOV.UK search error:', error)
    return []
  }
}

// Search ACAS for relevant pages  
async function searchACAS(query: string): Promise<Array<{url: string, title: string}>> {
  // ACAS doesn't have a public API, so we'll use targeted searches
  const acasPages = [
    'https://www.acas.org.uk/search?q=' + encodeURIComponent(query)
  ]
  
  // For now, return predefined relevant ACAS pages based on keywords
  const keywordMappings: {[key: string]: Array<{url: string, title: string}>} = {
    'pension': [{url: 'https://www.acas.org.uk/pensions', title: 'Pensions - ACAS'}],
    'working time': [{url: 'https://www.acas.org.uk/working-time-rules', title: 'Working time rules - ACAS'}],
    'minimum wage': [{url: 'https://www.acas.org.uk/national-minimum-wage', title: 'National minimum wage - ACAS'}],
    'discrimination': [{url: 'https://www.acas.org.uk/discrimination-and-the-law', title: 'Discrimination - ACAS'}],
    'equality': [{url: 'https://www.acas.org.uk/equality-and-discrimination', title: 'Equality and discrimination - ACAS'}]
  }
  
  const lowerQuery = query.toLowerCase()
  for (const [keyword, pages] of Object.entries(keywordMappings)) {
    if (lowerQuery.includes(keyword)) {
      return pages
    }
  }
  
  return []
}

// Chunking function for real-time content
function chunkContent(content: string, title: string): Array<{section: string, content: string}> {
  // Simple chunking by paragraphs, keeping chunks under ~1000 tokens
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50)
  const chunks: Array<{section: string, content: string}> = []
  
  let currentChunk = ''
  let chunkIndex = 1
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > 3000) { // ~1000 tokens
      if (currentChunk.trim()) {
        chunks.push({
          section: `Part ${chunkIndex}`,
          content: currentChunk.trim()
        })
        chunkIndex++
      }
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push({
      section: `Part ${chunkIndex}`,
      content: currentChunk.trim()
    })
  }
  
  return chunks.length > 0 ? chunks : [{section: 'Full Content', content: content}]
}

// Fetch and process a URL in real-time
async function fetchAndIngest(url: string, title: string, topic: string): Promise<Document[]> {
  console.log(`Fetching real-time content from: ${url}`)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HR-Compliance-Bot/1.0)'
      }
    })
    
    if (!response.ok) {
      console.error(`HTTP ${response.status} for ${url}`)
      return []
    }
    
    const html = await response.text()
    
    // Check if we already have this content (avoid duplicates)
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('url', url)
      .limit(1)
    
    if (existing && existing.length > 0) {
      console.log(`Content already exists for ${url}, skipping`)
      return []
    }
    
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    
    if (!article || !article.textContent || article.textContent.length < 100) {
      console.error(`Could not extract meaningful content from ${url}`)
      return []
    }
    
    // Chunk the content
    const chunks = chunkContent(article.textContent, article.title)
    const documents: Document[] = []
    
    for (const chunk of chunks) {
      try {
        // Generate embedding
        const { embedding } = await generateEmbedding(chunk.content)
        
        // Create document
        const document: Partial<Document> = {
          title: article.title || title,
          url,
          country: 'UK',
          topic,
          section: chunk.section,
          content: chunk.content,
          last_crawled_at: new Date().toISOString(),
        }
        
        // Store in database for future use
        const { data, error } = await supabase.from('documents').upsert({
          ...document,
          embedding,
        }, {
          onConflict: 'url,section'
        }).select().single()
        
        if (!error && data) {
          documents.push(data as Document)
          console.log(`✓ Real-time ingested: ${chunk.section}`)
        }
        
        // Rate limiting between embeddings
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (chunkError) {
        console.error(`Error processing chunk from ${url}:`, chunkError)
      }
    }
    
    return documents
    
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return []
  }
}

// Infer topic from query
function inferTopicFromQuery(query: string): string {
  const lowerQuery = query.toLowerCase()
  
  if (lowerQuery.includes('pension')) return 'Pensions'
  if (lowerQuery.includes('maternity') || lowerQuery.includes('paternity')) return 'Maternity/Paternity'
  if (lowerQuery.includes('holiday') || lowerQuery.includes('annual leave')) return 'Holiday'
  if (lowerQuery.includes('sick') || lowerQuery.includes('ssp')) return 'Sick'
  if (lowerQuery.includes('tupe')) return 'TUPE'
  if (lowerQuery.includes('visa') || lowerQuery.includes('right to work')) return 'Visas'
  if (lowerQuery.includes('redundancy')) return 'Redundancy'
  if (lowerQuery.includes('disciplinary') || lowerQuery.includes('dismissal')) return 'Disciplinary'
  if (lowerQuery.includes('working time') || lowerQuery.includes('minimum wage')) return 'Working Time'
  if (lowerQuery.includes('discrimination') || lowerQuery.includes('equality')) return 'Equality'
  if (lowerQuery.includes('health') || lowerQuery.includes('safety')) return 'Health Safety'
  if (lowerQuery.includes('contract') || lowerQuery.includes('employment')) return 'Employment'
  
  return 'General'
}

// Main real-time retrieval function
export async function searchAndIngestRealTime(
  query: string, 
  topic?: string
): Promise<Document[]> {
  console.log(`🔍 Real-time search initiated for: "${query}"`)
  
  const searchTopic = topic || inferTopicFromQuery(query)
  console.log(`📋 Inferred/selected topic: ${searchTopic}`)
  
  // Search for relevant URLs from multiple sources
  const [govUkResults, acasResults] = await Promise.all([
    searchGovUK(query),
    searchACAS(query)
  ])
  
  const allResults = [...govUkResults, ...acasResults]
  console.log(`🌐 Found ${allResults.length} potential URLs to fetch`)
  
  if (allResults.length === 0) {
    console.log('❌ No relevant URLs found for real-time retrieval')
    return []
  }
  
  // Fetch and ingest up to 2 new documents (to control costs and time)
  const documents: Document[] = []
  for (const {url, title} of allResults.slice(0, 2)) {
    try {
      const newDocs = await fetchAndIngest(url, title, searchTopic)
      documents.push(...newDocs)
      
      // Rate limiting between URLs
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`Error processing ${url}:`, error)
    }
  }
  
  console.log(`✅ Real-time retrieval completed: ${documents.length} new documents added`)
  return documents
}