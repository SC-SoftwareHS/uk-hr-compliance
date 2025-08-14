import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface Question {
  question: string
  topic?: string
}

interface EvalResult {
  q: string
  has_answer: boolean
  num_sources: number
  refused: boolean
  latency_ms: number
}

async function runEvaluation() {
  const questionsPath = join(__dirname, 'questions_uk.json')
  const questions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf-8'))
  
  const results: EvalResult[] = []
  
  console.log(`Running evaluation with ${questions.length} questions...`)
  
  for (const [index, { question, topic }] of questions.entries()) {
    console.log(`[${index + 1}/${questions.length}] ${question}`)
    
    const startTime = Date.now()
    
    try {
      const response = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, topic }),
      })
      
      const data = await response.json()
      const latency = Date.now() - startTime
      
      results.push({
        q: question,
        has_answer: !data.refused && data.answer && data.answer.length > 0,
        num_sources: data.sources?.length || 0,
        refused: data.refused || false,
        latency_ms: latency,
      })
      
      console.log(`  ✓ ${data.refused ? 'Refused' : 'Answered'} with ${data.sources?.length || 0} sources (${latency}ms)`)
    } catch (error) {
      console.error(`  ✗ Error: ${error}`)
      results.push({
        q: question,
        has_answer: false,
        num_sources: 0,
        refused: true,
        latency_ms: Date.now() - startTime,
      })
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Generate CSV
  const csv = [
    'q,has_answer,num_sources,refused,latency_ms',
    ...results.map(r => 
      `"${r.q.replace(/"/g, '""')}",${r.has_answer},${r.num_sources},${r.refused},${r.latency_ms}`
    )
  ].join('\n')
  
  writeFileSync(join(__dirname, 'eval.csv'), csv)
  
  // Print summary
  const totalAnswered = results.filter(r => r.has_answer).length
  const avgSources = results.reduce((acc, r) => acc + r.num_sources, 0) / results.length
  const avgLatency = results.reduce((acc, r) => acc + r.latency_ms, 0) / results.length
  
  console.log('\n=== Evaluation Summary ===')
  console.log(`Total questions: ${results.length}`)
  console.log(`Answered: ${totalAnswered} (${(totalAnswered / results.length * 100).toFixed(1)}%)`)
  console.log(`Average sources: ${avgSources.toFixed(1)}`)
  console.log(`Average latency: ${avgLatency.toFixed(0)}ms`)
  console.log(`\nResults saved to eval.csv`)
}

runEvaluation().catch(console.error)