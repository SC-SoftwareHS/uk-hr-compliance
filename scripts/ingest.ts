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
  { url: 'https://www.gov.uk/government/publications/tupe-a-guide-to-the-2006-regulations', topic: 'TUPE', title: 'TUPE regulations guide' },
  
  // Statutory Sick Pay
  { url: 'https://www.gov.uk/statutory-sick-pay', topic: 'Sick', title: 'Statutory Sick Pay (SSP)' },
  { url: 'https://www.acas.org.uk/absence-from-work/time-off-sick', topic: 'Sick', title: 'Time off sick - ACAS' },
  { url: 'https://www.gov.uk/statutory-sick-pay/what-youll-get', topic: 'Sick', title: 'SSP rates and payments' },
  { url: 'https://www.acas.org.uk/managing-short-term-sickness-absence', topic: 'Sick', title: 'Managing sickness absence - ACAS' },
  
  // Maternity/Paternity - Enhanced coverage
  { url: 'https://www.gov.uk/maternity-pay-leave', topic: 'Maternity/Paternity', title: 'Maternity pay and leave' },
  { url: 'https://www.gov.uk/paternity-pay-leave', topic: 'Maternity/Paternity', title: 'Paternity pay and leave' },
  { url: 'https://www.gov.uk/shared-parental-leave-and-pay', topic: 'Maternity/Paternity', title: 'Shared parental leave and pay' },
  { url: 'https://www.gov.uk/adoption-pay-leave', topic: 'Maternity/Paternity', title: 'Adoption pay and leave' },
  { url: 'https://www.acas.org.uk/maternity-paternity-and-adoption-leave', topic: 'Maternity/Paternity', title: 'Maternity, paternity and adoption - ACAS' },
  { url: 'https://www.gov.uk/statutory-maternity-pay', topic: 'Maternity/Paternity', title: 'Statutory Maternity Pay' },
  { url: 'https://www.gov.uk/statutory-paternity-pay', topic: 'Maternity/Paternity', title: 'Statutory Paternity Pay' },
  
  // Holiday entitlement - Enhanced coverage
  { url: 'https://www.gov.uk/holiday-entitlement-rights', topic: 'Holiday', title: 'Holiday entitlement' },
  { url: 'https://www.acas.org.uk/checking-holiday-entitlement', topic: 'Holiday', title: 'Checking holiday entitlement - ACAS' },
  { url: 'https://www.gov.uk/calculate-your-holiday-entitlement', topic: 'Holiday', title: 'Calculate holiday entitlement' },
  { url: 'https://www.acas.org.uk/holiday-pay', topic: 'Holiday', title: 'Holiday pay - ACAS' },
  
  // Pensions - New comprehensive coverage
  { url: 'https://www.gov.uk/workplace-pensions', topic: 'Pensions', title: 'Workplace pensions' },
  { url: 'https://www.gov.uk/pension-automatic-enrolment', topic: 'Pensions', title: 'Automatic enrolment into workplace pensions' },
  { url: 'https://www.thepensionsregulator.gov.uk/en/employers/new-employers-guide', topic: 'Pensions', title: 'New employers pension guide' },
  { url: 'https://www.gov.uk/pension-automatic-enrolment/opt-out', topic: 'Pensions', title: 'Opting out of workplace pensions' },
  
  // Employment contracts - Enhanced coverage
  { url: 'https://www.gov.uk/employment-contracts-and-conditions', topic: 'Employment', title: 'Employment contracts' },
  { url: 'https://www.acas.org.uk/employment-contracts', topic: 'Employment', title: 'Employment contracts - ACAS' },
  { url: 'https://www.gov.uk/employment-status', topic: 'Employment', title: 'Employment status' },
  { url: 'https://www.gov.uk/zero-hours-contracts', topic: 'Employment', title: 'Zero-hours contracts' },
  
  // Right to work/visas - Enhanced coverage
  { url: 'https://www.gov.uk/legal-right-work-uk', topic: 'Visas', title: 'Right to work in the UK' },
  { url: 'https://www.gov.uk/check-job-applicant-right-to-work', topic: 'Visas', title: 'Check right to work' },
  { url: 'https://www.gov.uk/government/publications/right-to-work-checks-employers-guide', topic: 'Visas', title: 'Right to work checks guide' },
  { url: 'https://www.gov.uk/settled-status-eu-citizens-families', topic: 'Visas', title: 'EU settled status' },
  
  // Redundancy - Enhanced coverage
  { url: 'https://www.gov.uk/redundancy-your-rights', topic: 'Redundancy', title: 'Redundancy rights' },
  { url: 'https://www.acas.org.uk/redundancy', topic: 'Redundancy', title: 'Redundancy - ACAS' },
  { url: 'https://www.gov.uk/calculate-your-redundancy-pay', topic: 'Redundancy', title: 'Calculate redundancy pay' },
  { url: 'https://www.acas.org.uk/collective-redundancies', topic: 'Redundancy', title: 'Collective redundancies - ACAS' },
  
  // Disciplinaries - Enhanced coverage
  { url: 'https://www.acas.org.uk/disciplinary-procedure-step-by-step', topic: 'Disciplinary', title: 'Disciplinary procedures - ACAS' },
  { url: 'https://www.acas.org.uk/dismissal', topic: 'Disciplinary', title: 'Dismissal - ACAS' },
  { url: 'https://www.gov.uk/dismiss-staff', topic: 'Disciplinary', title: 'Dismissing staff' },
  { url: 'https://www.acas.org.uk/grievance-procedures', topic: 'Disciplinary', title: 'Grievance procedures - ACAS' },
  
  // Working Time & Wages - New coverage
  { url: 'https://www.gov.uk/maximum-weekly-working-hours', topic: 'Working Time', title: 'Maximum weekly working hours' },
  { url: 'https://www.gov.uk/rest-breaks-work', topic: 'Working Time', title: 'Rest breaks at work' },
  { url: 'https://www.gov.uk/national-minimum-wage-rates', topic: 'Working Time', title: 'National Minimum Wage rates' },
  { url: 'https://www.acas.org.uk/working-time-rules', topic: 'Working Time', title: 'Working time rules - ACAS' },
  
  // Discrimination & Equality - New coverage
  { url: 'https://www.gov.uk/workplace-discrimination', topic: 'Equality', title: 'Workplace discrimination' },
  { url: 'https://www.acas.org.uk/discrimination-and-the-law', topic: 'Equality', title: 'Discrimination and the law - ACAS' },
  { url: 'https://www.gov.uk/reasonable-adjustments-for-disabled-workers', topic: 'Equality', title: 'Reasonable adjustments' },
  
  // Health & Safety - New coverage
  { url: 'https://www.hse.gov.uk/simple-health-safety/index.htm', topic: 'Health Safety', title: 'Simple health and safety' },
  { url: 'https://www.acas.org.uk/health-and-safety-at-work', topic: 'Health Safety', title: 'Health and safety at work - ACAS' },
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

export async function main() {
  console.log('Starting ingestion...')
  console.log(`Processing ${SEED_URLS.length} URLs`)
  
  for (const seedUrl of SEED_URLS) {
    await ingestURL(seedUrl)
  }
  
  console.log('Ingestion complete!')
}

// Allow this script to be run directly or imported
if (require.main === module) {
  main().catch(console.error)
}