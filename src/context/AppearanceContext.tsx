import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type InterfaceFontPreset = 'modern' | 'humanist' | 'technical' | 'mono'
export type HudFontPreset = 'technical' | 'mono' | 'modern'

export type AppearanceSettings = {
  accentColor: string
  backgroundColor: string
  panelColor: string
  panelOpacity: number
  panelBlur: number
  workspaceMargin: number
  cornerCut: number
  computeHudPosition: 'top-right' | 'bottom-right'
  brainHudColor: string
  brainHudOpacity: number
  rubikTurnSpeedMs: number
  viewTransitionDurationMs: number
  panelTransitionDurationMs: number
  panelTransitionStaggerMs: number
  interfaceScale: number
  interfaceFont: InterfaceFontPreset
  hudFont: HudFontPreset
}

type AppearanceContextValue = {
  settings: AppearanceSettings
  updateSetting: <Key extends keyof AppearanceSettings>(key: Key, value: AppearanceSettings[Key]) => void
  resetAppearance: () => void
}

const STORAGE_KEY = 'hermes-appearance:v1'
const interfaceFontStacks: Record<InterfaceFontPreset, string> = {
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  humanist: '"Segoe UI", Candara, Calibri, ui-sans-serif, system-ui, sans-serif',
  technical: 'Bahnschrift, "DIN Alternate", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
  mono: '"Cascadia Code", "Cascadia Mono", Consolas, "SFMono-Regular", ui-monospace, monospace',
}
const hudFontStacks: Record<HudFontPreset, string> = {
  technical: 'Bahnschrift, "DIN Alternate", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
  mono: '"Cascadia Code", "Cascadia Mono", Consolas, "SFMono-Regular", ui-monospace, monospace',
  modern: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const defaults: AppearanceSettings = {
  accentColor: '#35d9ff',
  backgroundColor: '#04080d',
  panelColor: '#061019',
  panelOpacity: 0.72,
  panelBlur: 20,
  workspaceMargin: 24,
  cornerCut: 18,
  computeHudPosition: 'bottom-right',
  brainHudColor: '#02070c',
  brainHudOpacity: 0.72,
  rubikTurnSpeedMs: 650,
  viewTransitionDurationMs: 520,
  panelTransitionDurationMs: 280,
  panelTransitionStaggerMs: 45,
  interfaceScale: 1,
  interfaceFont: 'modern',
  hudFont: 'technical',
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
  const brainHudRgb = hexToRgb(settings.brainHudColor)
  const brainHudOpacitySoft = Math.max(0.12, settings.brainHudOpacity * 0.9)
  const safeScale = Math.min(1.4, Math.max(0.85, settings.interfaceScale))

  root.style.fontSize = `${safeScale * 100}%`
  root.style.setProperty('--font-ui', interfaceFontStacks[settings.interfaceFont] ?? interfaceFontStacks.modern)
  root.style.setProperty('--font-hud', hudFontStacks[settings.hudFont] ?? hudFontStacks.technical)
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
  root.style.setProperty('--brain-hud-rgb', brainHudRgb)
  root.style.setProperty('--brain-hud-opacity', `${settings.brainHudOpacity}`)
  root.style.setProperty('--brain-hud-opacity-soft', `${brainHudOpacitySoft}`)
  root.style.setProperty('--view-transition-duration', `${Math.max(160, settings.viewTransitionDurationMs)}ms`)
  root.style.setProperty('--panel-transition-duration', `${Math.max(100, settings.panelTransitionDurationMs)}ms`)
  root.style.setProperty('--panel-transition-stagger', `${Math.max(0, settings.panelTransitionStaggerMs)}ms`)
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
