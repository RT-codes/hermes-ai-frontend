import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultHermesProfile,
  discoverHermesProfiles,
  type HermesProfile,
  type HermesProfileDiscoveryStatus,
} from '../lib/hermes/profiles'

type HermesProfileRegistryStatus = 'loading' | HermesProfileDiscoveryStatus

const PROFILE_COLORS_STORAGE_KEY = 'hermes-profile-colors:v1'
const DEFAULT_PROFILE_COLORS = [
  '#3FD9FF',
  '#9D7CFF',
  '#FFAD5C',
  '#55E6A5',
  '#FF6B9D',
  '#FFD166',
  '#72A7FF',
  '#C6F06A',
]

type ProfileColorOverrides = Record<string, string>

type HermesProfileContextValue = {
  profiles: HermesProfile[]
  status: HermesProfileRegistryStatus
  warning: string | null
  refreshProfiles: () => Promise<void>
  getProfile: (profileId: string) => HermesProfile | undefined
  getProfileColor: (profileId: string) => string
  setProfileColor: (profileId: string, color: string) => void
  resetProfileColors: () => void
}

function normalizeProfileColor(value: string) {
  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null
}

function stableColorIndex(profileId: string) {
  let hash = 0
  for (const character of profileId) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  return hash % DEFAULT_PROFILE_COLORS.length
}

export function defaultProfileColor(profileId: string) {
  if (profileId === 'default') return DEFAULT_PROFILE_COLORS[0]
  return DEFAULT_PROFILE_COLORS[stableColorIndex(profileId)]
}

function loadProfileColorOverrides(): ProfileColorOverrides {
  try {
    const stored = window.localStorage.getItem(PROFILE_COLORS_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([profileId, value]) => [profileId, typeof value === 'string' ? normalizeProfileColor(value) : null] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    )
  } catch {
    return {}
  }
}

const HermesProfileContext = createContext<HermesProfileContextValue | null>(null)

export function HermesProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<HermesProfile[]>([defaultHermesProfile])
  const [status, setStatus] = useState<HermesProfileRegistryStatus>('loading')
  const [warning, setWarning] = useState<string | null>(null)
  const [profileColorOverrides, setProfileColorOverrides] = useState<ProfileColorOverrides>(loadProfileColorOverrides)

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

  useEffect(() => {
    window.localStorage.setItem(PROFILE_COLORS_STORAGE_KEY, JSON.stringify(profileColorOverrides))
  }, [profileColorOverrides])

  const refreshProfiles = useCallback(async () => {
    await loadProfiles()
  }, [loadProfiles])

  const getProfileColor = useCallback((profileId: string) => (
    profileColorOverrides[profileId] ?? defaultProfileColor(profileId)
  ), [profileColorOverrides])

  const setProfileColor = useCallback((profileId: string, color: string) => {
    const normalized = normalizeProfileColor(color)
    if (!normalized) return
    setProfileColorOverrides((current) => ({ ...current, [profileId]: normalized }))
  }, [])

  const resetProfileColors = useCallback(() => {
    setProfileColorOverrides({})
  }, [])

  const value = useMemo<HermesProfileContextValue>(() => ({
    profiles,
    status,
    warning,
    refreshProfiles,
    getProfile: (profileId: string) => profiles.find((profile) => profile.id === profileId),
    getProfileColor,
    setProfileColor,
    resetProfileColors,
  }), [getProfileColor, profiles, refreshProfiles, resetProfileColors, setProfileColor, status, warning])

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
