import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type AppearanceSettings = {
  accentColor: string
  backgroundColor: string
  panelColor: string
  panelOpacity: number
  panelBlur: number
  workspaceMargin: number
  cornerCut: number
  computeHudPosition: 'top-right' | 'bottom-right'
}

type AppearanceContextValue = {
  settings: AppearanceSettings
  updateSetting: <Key extends keyof AppearanceSettings>(key: Key, value: AppearanceSettings[Key]) => void
  resetAppearance: () => void
}

const STORAGE_KEY = 'hermes-appearance:v1'
const defaults: AppearanceSettings = {
  accentColor: '#35d9ff',
  backgroundColor: '#04080d',
  panelColor: '#061019',
  panelOpacity: 0.72,
  panelBlur: 20,
  workspaceMargin: 24,
  cornerCut: 18,
  computeHudPosition: 'bottom-right',
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function loadSettings() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return defaults

  try {
    return { ...defaults, ...JSON.parse(stored) } as AppearanceSettings
  } catch {
    return defaults
  }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized
  const number = Number.parseInt(value, 16)
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`
}

function applySettings(settings: AppearanceSettings) {
  const root = document.documentElement
  const accentRgb = hexToRgb(settings.accentColor)
  const panelRgb = hexToRgb(settings.panelColor)

  root.style.setProperty('--cyan', settings.accentColor)
  root.style.setProperty('--accent-rgb', accentRgb)
  root.style.setProperty('--cyan-soft', `color-mix(in srgb, ${settings.accentColor} 70%, white)`)
  root.style.setProperty('--cyan-dim', `rgb(${accentRgb} / 0.24)`)
  root.style.setProperty('--cyan-faint', `rgb(${accentRgb} / 0.09)`)
  root.style.setProperty('--glass-border', `rgb(${accentRgb} / 0.28)`)
  root.style.setProperty('--bg', settings.backgroundColor)
  root.style.setProperty('--panel-rgb', panelRgb)
  root.style.setProperty('--glass', `rgb(${panelRgb} / ${settings.panelOpacity})`)
  root.style.setProperty('--glass-soft', `rgb(${panelRgb} / ${Math.max(0.12, settings.panelOpacity - 0.14)})`)
  root.style.setProperty('--blur-panel', `${settings.panelBlur}px`)
  root.style.setProperty('--space-page', `${settings.workspaceMargin}px`)
  root.style.setProperty('--hud-cut', `${settings.cornerCut}px`)
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(loadSettings)

  useEffect(() => {
    applySettings(settings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  function updateSetting<Key extends keyof AppearanceSettings>(key: Key, value: AppearanceSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function resetAppearance() {
    setSettings(defaults)
  }

  return (
    <AppearanceContext.Provider value={{ settings, updateSetting, resetAppearance }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}
