import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultHermesProfile,
  discoverHermesProfiles,
  type HermesProfile,
  type HermesProfileDiscoveryStatus,
} from '../lib/hermes/profiles'

type HermesProfileRegistryStatus = 'loading' | HermesProfileDiscoveryStatus

type HermesProfileContextValue = {
  profiles: HermesProfile[]
  status: HermesProfileRegistryStatus
  warning: string | null
  refreshProfiles: () => Promise<void>
  getProfile: (profileId: string) => HermesProfile | undefined
}

const HermesProfileContext = createContext<HermesProfileContextValue | null>(null)

export function HermesProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<HermesProfile[]>([defaultHermesProfile])
  const [status, setStatus] = useState<HermesProfileRegistryStatus>('loading')
  const [warning, setWarning] = useState<string | null>(null)

  const loadProfiles = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading')
    const result = await discoverHermesProfiles(signal)
    if (signal?.aborted) return
    setProfiles(result.profiles)
    setStatus(result.status)
    setWarning(result.warning)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadProfiles(controller.signal).catch((error) => {
      if (controller.signal.aborted) return
      setProfiles([defaultHermesProfile])
      setStatus('degraded')
      setWarning(error instanceof Error ? error.message : 'Hermes profile discovery failed.')
    })
    return () => controller.abort()
  }, [loadProfiles])

  const refreshProfiles = useCallback(async () => {
    await loadProfiles()
  }, [loadProfiles])

  const value = useMemo<HermesProfileContextValue>(() => ({
    profiles,
    status,
    warning,
    refreshProfiles,
    getProfile: (profileId: string) => profiles.find((profile) => profile.id === profileId),
  }), [profiles, refreshProfiles, status, warning])

  return (
    <HermesProfileContext.Provider value={value}>
      {children}
    </HermesProfileContext.Provider>
  )
}

export function useHermesProfiles() {
  const context = useContext(HermesProfileContext)
  if (!context) throw new Error('useHermesProfiles must be used within HermesProfileProvider.')
  return context
}
