'use client'

import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface DailySummaryCardProps {
  projectId: string
}

export function DailySummaryCard({ projectId }: DailySummaryCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  // Fetch summary when card is first expanded
  useEffect(() => {
    if (isOpen && !hasFetched && !loading) {
      fetchSummary()
    }
  }, [isOpen, hasFetched, loading])

  // Reset when project changes
  useEffect(() => {
    setSummary(null)
    setHasFetched(false)
    setError(null)
  }, [projectId])

  async function fetchSummary() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-summary`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      const data = await res.json()
      setSummary(data.summary)
      setHasFetched(true)
    } catch (err) {
      setError('Unable to load summary')
      console.error('Failed to fetch daily summary:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <div className="border rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 overflow-hidden">
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <span className="font-medium text-sm">AI Daily Summary</span>
            <span className="text-xs text-muted-foreground">Today's activity</span>
          </div>
          <svg
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Generating summary...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 dark:text-red-400 py-2">
                {error}
                <button
                  onClick={() => {
                    setHasFetched(false)
                    fetchSummary()
                  }}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : summary ? (
              <div className="text-sm leading-relaxed whitespace-pre-line">
                {summary}
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
