import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type TelemetrySnapshot = {
  sampledAt: number
  host: {
    cpuName: string
    cpuUsage: number | null
    cpuTempC: number | null
    memoryTotalBytes: number
    memoryUsedBytes: number | null
    memoryUsage: number | null
  } | null
  gpu: {
    name: string
    memoryTotalMb: number
    memoryUsedMb: number
    utilization: number
    temperatureC: number
    memoryUsage: number | null
  } | null
  ollama: {
    models: Array<{
      name: string
      size: number
      sizeVram: number
    }>
  }
}

type TelemetryPoint = {
  sampledAt: number
  cpu: number
  gpu: number
  vram: number
}

type SystemTelemetryContextValue = {
  snapshot: TelemetrySnapshot | null
  history: TelemetryPoint[]
  error: string | null
  refresh: () => Promise<void>
}

const SystemTelemetryContext = createContext<SystemTelemetryContextValue | null>(null)

export function SystemTelemetryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [history, setHistory] = useState<TelemetryPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (document.visibilityState === 'hidden') return

    try {
      const response = await fetch('/system-api/telemetry', { cache: 'no-store' })
      if (!response.ok) throw new Error(`Telemetry returned ${response.status}`)

      const next = await response.json() as TelemetrySnapshot
      setSnapshot(next)
      setError(null)
      setHistory((current) => [
        ...current,
        {
          sampledAt: next.sampledAt,
          cpu: next.host?.cpuUsage ?? 0,
          gpu: next.gpu?.utilization ?? 0,
          vram: next.gpu?.memoryUsage ?? 0,
        },
      ].slice(-48))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Telemetry unavailable')
    }
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <SystemTelemetryContext.Provider value={{ snapshot, history, error, refresh }}>
      {children}
    </SystemTelemetryContext.Provider>
  )
}

export function useSystemTelemetry() {
  const context = useContext(SystemTelemetryContext)
  if (!context) throw new Error('useSystemTelemetry must be used inside SystemTelemetryProvider')
  return context
}
