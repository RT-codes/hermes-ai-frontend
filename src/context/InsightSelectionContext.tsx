import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type InsightSelectionContextValue = {
  selectedRequestBySession: Record<string, string | null>
  selectRequestTrace: (sessionId: string, requestId: string | null) => void
  clearRequestTrace: (sessionId: string) => void
}

const InsightSelectionContext = createContext<InsightSelectionContextValue | null>(null)

export function InsightSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedRequestBySession, setSelectedRequestBySession] = useState<Record<string, string | null>>({})

  const value = useMemo<InsightSelectionContextValue>(() => ({
    selectedRequestBySession,
    selectRequestTrace(sessionId, requestId) {
      setSelectedRequestBySession((current) => ({ ...current, [sessionId]: requestId }))
    },
    clearRequestTrace(sessionId) {
      setSelectedRequestBySession((current) => ({ ...current, [sessionId]: null }))
    },
  }), [selectedRequestBySession])

  return <InsightSelectionContext.Provider value={value}>{children}</InsightSelectionContext.Provider>
}

export function useInsightSelection() {
  const context = useContext(InsightSelectionContext)
  if (!context) throw new Error('useInsightSelection must be used inside InsightSelectionProvider')
  return context
}
