import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import {
  defaultHermesConnectionSettings,
  loadHermesConnectionSettings,
  saveHermesConnectionSettings,
  type HermesConnectionSettings,
} from '../features/settings/connection'

type ConnectionSettingsContextValue = {
  settings: HermesConnectionSettings
  updateSetting: <Key extends keyof HermesConnectionSettings>(key: Key, value: HermesConnectionSettings[Key]) => void
  resetConnection: () => void
}

const ConnectionSettingsContext = createContext<ConnectionSettingsContextValue | null>(null)

export function ConnectionSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<HermesConnectionSettings>(loadHermesConnectionSettings)

  function updateSetting<Key extends keyof HermesConnectionSettings>(key: Key, value: HermesConnectionSettings[Key]) {
    setSettings((current) => saveHermesConnectionSettings({ ...current, [key]: value }))
  }

  function resetConnection() {
    setSettings(saveHermesConnectionSettings(defaultHermesConnectionSettings))
  }

  return (
    <ConnectionSettingsContext.Provider value={{ settings, updateSetting, resetConnection }}>
      {children}
    </ConnectionSettingsContext.Provider>
  )
}

export function useConnectionSettings() {
  const context = useContext(ConnectionSettingsContext)
  if (!context) throw new Error('useConnectionSettings must be used inside ConnectionSettingsProvider')
  return context
}
