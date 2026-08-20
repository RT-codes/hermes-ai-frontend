import type { StoredChatState } from './types'

export type ChatPersistence = {
  loadState: () => StoredChatState | null
  saveState: (state: StoredChatState) => void
  loadDrafts: () => Record<string, string>
  saveDrafts: (drafts: Record<string, string>) => void
}

const STORAGE_KEY = 'hermes-chat-sessions:v2'
const LEGACY_STORAGE_KEY = 'hermes-chat-sessions:v1'
const DRAFTS_KEY = 'hermes-chat-drafts:v1'

export const browserChatPersistence: ChatPersistence = {
  loadState() {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredChatState
    } catch {
      return null
    }
  },

  saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  loadDrafts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}') as Record<string, unknown>
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    } catch {
      return {}
    }
  },

  saveDrafts(drafts) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
  },
}
