import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type RuntimeStatus = {
  hermesOnline: boolean
  hindsightOnline: boolean
  hermesVersion: string | null
  apiModel: string | null
  checkedAt: number | null
}

type RuntimeStatusContextValue = RuntimeStatus & {
  refresh: () => Promise<void>
}

const RuntimeStatusContext = createContext<RuntimeStatusContextValue | null>(null)

const initialStatus: RuntimeStatus = {
  hermesOnline: false,
  hindsightOnline: false,
  hermesVersion: null,
  apiModel: null,
  checkedAt: null,
}

export function RuntimeStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus>(initialStatus)

  async function refresh() {
    if (document.visibilityState === 'hidden') return

    const [healthResult, modelsResult, hindsightResult] = await Promise.allSettled([
      fetch('/hermes-api/health', { cache: 'no-store' }),
      fetch('/hermes-api/v1/models', { cache: 'no-store' }),
      fetch('/hindsight-api/docs', { cache: 'no-store' }),
    ])

    let hermesOnline = false
    let hindsightOnline = false
    let hermesVersion: string | null = null
    let apiModel: string | null = null

    if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
      hermesOnline = true
      const payload = await healthResult.value.json() as { version?: string }
      hermesVersion = payload.version ?? null
    }

    if (modelsResult.status === 'fulfilled' && modelsResult.value.ok) {
      const payload = await modelsResult.value.json() as { data?: Array<{ id?: string }> }
      apiModel = payload.data?.[0]?.id ?? null
    }

    if (hindsightResult.status === 'fulfilled') {
      hindsightOnline = hindsightResult.value.ok
    }

    setStatus({
      hermesOnline,
      hindsightOnline,
      hermesVersion,
      apiModel,
      checkedAt: Date.now(),
    })
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [])

  const value = useMemo(() => ({ ...status, refresh }), [status])

  return <RuntimeStatusContext.Provider value={value}>{children}</RuntimeStatusContext.Provider>
}

export function useRuntimeStatus() {
  const context = useContext(RuntimeStatusContext)
  if (!context) throw new Error('useRuntimeStatus must be used inside RuntimeStatusProvider')
  return context
}
