export type HermesConnectionSettings = {
  apiBasePath: string
  model: string
  requestTimeoutMs: number
}

export const defaultHermesConnectionSettings: HermesConnectionSettings = {
  apiBasePath: '/hermes-api',
  model: 'hermes-agent',
  requestTimeoutMs: 10 * 60 * 1000,
}

const STORAGE_KEY = 'hermes-connection:v1'
let cachedSettings: HermesConnectionSettings | null = null

function normalizeBasePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return defaultHermesConnectionSettings.apiBasePath
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

export function normalizeConnectionSettings(settings: HermesConnectionSettings): HermesConnectionSettings {
  return {
    apiBasePath: normalizeBasePath(settings.apiBasePath),
    model: settings.model.trim() || defaultHermesConnectionSettings.model,
    requestTimeoutMs: Math.max(10_000, Math.min(30 * 60 * 1000, Number(settings.requestTimeoutMs) || defaultHermesConnectionSettings.requestTimeoutMs)),
  }
}

export function loadHermesConnectionSettings(): HermesConnectionSettings {
  if (cachedSettings) return cachedSettings
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    cachedSettings = defaultHermesConnectionSettings
    return cachedSettings
  }

  try {
    cachedSettings = normalizeConnectionSettings({
      ...defaultHermesConnectionSettings,
      ...JSON.parse(stored),
    })
  } catch {
    cachedSettings = defaultHermesConnectionSettings
  }
  return cachedSettings
}

export function saveHermesConnectionSettings(settings: HermesConnectionSettings) {
  cachedSettings = normalizeConnectionSettings(settings)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings))
  return cachedSettings
}

export function getHermesConnectionSettings() {
  return cachedSettings ?? loadHermesConnectionSettings()
}
