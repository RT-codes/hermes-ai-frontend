import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { streamHermesChat } from '../lib/hermes/client'
import type { ChatMessage, HermesConnectionState } from '../lib/hermes/types'

type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  connectionState: HermesConnectionState
  error: string | null
  createdAt: number
  updatedAt: number
}

type ChatSessionsContextValue = {
  sessions: ChatSession[]
  openTabIds: string[]
  activeSessionId: string | null
  activeSession: ChatSession | null
  createSession: () => string
  openSession: (sessionId: string) => void
  selectSession: (sessionId: string) => void
  closeTab: (sessionId: string) => void
  closeAllTabs: () => void
  sendMessage: (sessionId: string, content: string) => Promise<void>
}

type StoredChatState = {
  sessions: ChatSession[]
  openTabIds: string[]
  activeSessionId: string | null
}

const STORAGE_KEY = 'hermes-chat-sessions:v1'
const ChatSessionsContext = createContext<ChatSessionsContextValue | null>(null)

function createFreshSession(index = 1): ChatSession {
  const now = Date.now()
  const id = crypto.randomUUID()

  return {
    id,
    title: index === 1 ? 'New chat' : `New chat ${index}`,
    messages: [
      {
        id: `welcome-${id}`,
        role: 'assistant',
        content: 'Hermes is ready.',
      },
    ],
    connectionState: 'idle',
    error: null,
    createdAt: now,
    updatedAt: now,
  }
}

function loadStoredState(): StoredChatState {
  const fallback = createFreshSession()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return {
      sessions: [fallback],
      openTabIds: [fallback.id],
      activeSessionId: fallback.id,
    }
  }

  try {
    const parsed = JSON.parse(raw) as StoredChatState
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map((session) => ({
          ...session,
          connectionState: 'idle' as HermesConnectionState,
          error: null,
        }))
      : []

    if (!sessions.length) {
      return {
        sessions: [fallback],
        openTabIds: [fallback.id],
        activeSessionId: fallback.id,
      }
    }

    const knownIds = new Set(sessions.map((session) => session.id))
    const openTabIds = Array.isArray(parsed.openTabIds)
      ? parsed.openTabIds.filter((id) => knownIds.has(id))
      : []
    const activeSessionId = parsed.activeSessionId && openTabIds.includes(parsed.activeSessionId)
      ? parsed.activeSessionId
      : openTabIds.at(-1) ?? null

    return { sessions, openTabIds, activeSessionId }
  } catch {
    return {
      sessions: [fallback],
      openTabIds: [fallback.id],
      activeSessionId: fallback.id,
    }
  }
}

function titleFromMessage(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= 30) return compact
  return `${compact.slice(0, 29)}…`
}

export function ChatSessionsProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadStoredState, [])
  const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions)
  const [openTabIds, setOpenTabIds] = useState<string[]>(initial.openTabIds)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initial.activeSessionId)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions, openTabIds, activeSessionId } satisfies StoredChatState),
    )
  }, [activeSessionId, openTabIds, sessions])

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null

  function createSession() {
    const session = createFreshSession(sessions.length + 1)
    setSessions((current) => [...current, session])
    setOpenTabIds((current) => [...current, session.id])
    setActiveSessionId(session.id)
    return session.id
  }

  function openSession(sessionId: string) {
    if (!sessions.some((session) => session.id === sessionId)) return
    setOpenTabIds((current) => current.includes(sessionId) ? current : [...current, sessionId])
    setActiveSessionId(sessionId)
  }

  function selectSession(sessionId: string) {
    if (!openTabIds.includes(sessionId)) return
    setActiveSessionId(sessionId)
  }

  function closeTab(sessionId: string) {
    setOpenTabIds((current) => {
      const next = current.filter((id) => id !== sessionId)
      if (activeSessionId === sessionId) {
        const closedIndex = current.indexOf(sessionId)
        setActiveSessionId(next[Math.min(closedIndex, next.length - 1)] ?? null)
      }
      return next
    })
  }

  function closeAllTabs() {
    setOpenTabIds([])
    setActiveSessionId(null)
  }

  function patchSession(sessionId: string, patch: (session: ChatSession) => ChatSession) {
    setSessions((current) => current.map((session) => session.id === sessionId ? patch(session) : session))
  }

  async function sendMessage(sessionId: string, content: string) {
    const trimmed = content.trim()
    const session = sessions.find((item) => item.id === sessionId)
    if (!trimmed || !session || session.connectionState === 'connecting' || session.connectionState === 'streaming') return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    const requestMessages = [...session.messages, userMessage].filter((message) => !message.id.startsWith('welcome-'))
    const nextTitle = session.title.startsWith('New chat') ? titleFromMessage(trimmed) : session.title

    patchSession(sessionId, (current) => ({
      ...current,
      title: nextTitle,
      messages: [...current.messages, userMessage, assistantMessage],
      connectionState: 'connecting',
      error: null,
      updatedAt: Date.now(),
    }))

    try {
      await streamHermesChat({
        messages: requestMessages,
        sessionId,
        onDelta: (delta) => {
          patchSession(sessionId, (current) => ({
            ...current,
            connectionState: 'streaming',
            messages: current.messages.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + delta } : message,
            ),
            updatedAt: Date.now(),
          }))
        },
      })

      patchSession(sessionId, (current) => ({
        ...current,
        connectionState: 'idle',
        updatedAt: Date.now(),
      }))
    } catch (caughtError) {
      const error = caughtError instanceof Error ? caughtError.message : 'Unable to reach Hermes'
      patchSession(sessionId, (current) => ({
        ...current,
        connectionState: 'error',
        error,
        messages: current.messages.filter((message) => message.id !== assistantId || message.content),
        updatedAt: Date.now(),
      }))
    }
  }

  const value = useMemo<ChatSessionsContextValue>(() => ({
    sessions,
    openTabIds,
    activeSessionId,
    activeSession,
    createSession,
    openSession,
    selectSession,
    closeTab,
    closeAllTabs,
    sendMessage,
  }), [activeSession, activeSessionId, openTabIds, sessions])

  return <ChatSessionsContext.Provider value={value}>{children}</ChatSessionsContext.Provider>
}

export function useChatSessions() {
  const context = useContext(ChatSessionsContext)
  if (!context) throw new Error('useChatSessions must be used inside ChatSessionsProvider')
  return context
}
