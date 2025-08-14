'use client'

import { useState } from 'react'
import { RAGResponse, Topic } from '@/lib/types'

const topics: { value: Topic | ''; label: string }[] = [
  { value: '', label: 'All topics' },
  { value: 'TUPE', label: 'TUPE' },
  { value: 'Sick', label: 'Statutory Sick Pay' },
  { value: 'Maternity/Paternity', label: 'Maternity/Paternity' },
  { value: 'Holiday', label: 'Holiday Entitlement' },
  { value: 'Pensions', label: 'Pensions' },
  { value: 'Visas', label: 'Visas & Right to Work' },
]

export default function Home() {
  const [question, setQuestion] = useState('')
  const [topic, setTopic] = useState<Topic | ''>('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<RAGResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question, 
          topic: topic || undefined 
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyAnswer = () => {
    if (response?.answer) {
      navigator.clipboard.writeText(response.answer)
    }
  }

  const reset = () => {
    setQuestion('')
    setResponse(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            UK HR Compliance Assistant
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Get answers to UK HR compliance questions with citations to official sources
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                Your question
              </label>
              <textarea
                id="question"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., What are the key employer steps for TUPE transfers?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <div className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md">
                  <span className="text-sm">UK</span>
                </div>
              </div>

              <div className="flex-1">
                <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                  Topic (optional)
                </label>
                <select
                  id="topic"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as Topic | '')}
                  disabled={loading}
                >
                  {topics.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Searching...' : 'Get Answer'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {response && (
            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Answer</h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      response.confidence === 'high' ? 'bg-green-100 text-green-800' :
                      response.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {response.confidence} confidence
                    </span>
                    <button
                      onClick={copyAnswer}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Copy answer
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ 
                    __html: response.answer.replace(/\n/g, '<br />') 
                  }} />
                </div>
              </div>

              {response.sources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sources</h3>
                  <ul className="space-y-2">
                    {response.sources.map((source, index) => (
                      <li key={index}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={reset}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Ask another question
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              ⚠️ Not legal advice. Always verify with official sources or counsel.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}