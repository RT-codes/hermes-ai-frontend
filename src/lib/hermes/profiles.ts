export type HermesProfile = {
  id: string
  displayName: string
  isDefault: boolean
  available: boolean
  metadata: Record<string, unknown>
}

export type HermesProfileDiscoveryStatus = 'ready' | 'degraded'

export type HermesProfileDiscoveryResult = {
  profiles: HermesProfile[]
  status: HermesProfileDiscoveryStatus
  warning: string | null
}

export const DEFAULT_HERMES_PROFILE_ID = 'default'

export const defaultHermesProfile: HermesProfile = {
  id: DEFAULT_HERMES_PROFILE_ID,
  displayName: 'Default',
  isDefault: true,
  available: true,
  metadata: {},
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function firstBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return false
}

function humanizeProfileId(id: string) {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function normalizeProfile(value: unknown): HermesProfile | null {
  if (typeof value === 'string' && value.trim()) {
    const id = value.trim()
    return {
      id,
      displayName: humanizeProfileId(id),
      isDefault: id === DEFAULT_HERMES_PROFILE_ID,
      available: true,
      metadata: {},
    }
  }

  const record = asRecord(value)
  if (!record) return null

  const id = firstString(record, ['id', 'name', 'profile', 'profile_id', 'slug'])
  if (!id) return null

  const displayName = firstString(record, ['display_name', 'displayName', 'label', 'title'])
    || humanizeProfileId(id)

  return {
    id,
    displayName,
    isDefault: firstBoolean(record, ['is_default', 'isDefault', 'default'])
      || id === DEFAULT_HERMES_PROFILE_ID,
    available: record.available === false ? false : true,
    metadata: record,
  }
}

function profilePayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  if (!record) return []

  for (const key of ['profiles', 'items', 'data']) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }

  return []
}

function normalizeProfiles(payload: unknown) {
  const deduplicated = new Map<string, HermesProfile>()

  for (const value of profilePayload(payload)) {
    const profile = normalizeProfile(value)
    if (profile) deduplicated.set(profile.id, profile)
  }

  const profiles = [...deduplicated.values()]
  if (profiles.length === 0) return []

  if (!profiles.some((profile) => profile.isDefault)) {
    const namedDefault = profiles.find((profile) => profile.id === DEFAULT_HERMES_PROFILE_ID)
    if (namedDefault) namedDefault.isDefault = true
  }

  return profiles.sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
    return left.displayName.localeCompare(right.displayName)
  })
}

function degradedResult(message: string): HermesProfileDiscoveryResult {
  return {
    profiles: [defaultHermesProfile],
    status: 'degraded',
    warning: message,
  }
}

export async function discoverHermesProfiles(signal?: AbortSignal): Promise<HermesProfileDiscoveryResult> {
  try {
    const response = await fetch('/hermes-profile-api/api/profiles', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, ' ').trim()
      return degradedResult(
        detail
          ? `Hermes profile discovery returned HTTP ${response.status}: ${detail}`
          : `Hermes profile discovery returned HTTP ${response.status}.`,
      )
    }

    const profiles = normalizeProfiles(await response.json())
    if (profiles.length === 0) {
      return degradedResult('Hermes profile discovery returned no recognizable profiles.')
    }

    return {
      profiles,
      status: 'ready',
      warning: null,
    }
  } catch (error) {
    if (signal?.aborted) throw error
    const detail = error instanceof Error ? error.message : 'Unknown profile discovery error.'
    return degradedResult(`Hermes profile discovery is unavailable: ${detail}`)
  }
}
