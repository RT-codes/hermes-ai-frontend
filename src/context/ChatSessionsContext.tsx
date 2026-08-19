import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { streamHermesChat } from '../lib/hermes/client'
import type { ChatConversation, ChatMessage, StoredChatState } from '../features/chat/types'

type ChatSessionsContextValue = {
  sessions: ChatConversation[]
  openTabIds: string[]
  activeSessionId: string | null
  activeSession: ChatConversation | null
  drafts: Record<string, string>
  createSession: () => string
  openSession: (sessionId: string) => void
  selectSession: (sessionId: string) => void
  closeTab: (sessionId: string) => void
  closeAllTabs: () => void
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => void
  setDraft: (sessionId: string, content: string) => void
  clearDraft: (sessionId: string) => void
  sendMessage: (sessionId: string, content: string) => Promise<void>
  cancelGeneration: (sessionId: string) => void
  regenerateFromUser: (sessionId: string, userMessageId: string) => Promise<void>
  retryResponse: (sessionId: string, assistantMessageId: string) => Promise<void>
}

const STORAGE_KEY = 'hermes-chat-sessions:v2'
const DRAFTS_KEY = 'hermes-chat-drafts:v1'
const ChatSessionsContext = createContext<ChatSessionsContextValue | null>(null)

function createMessage(conversationId: string, role: ChatMessage['role'], content: string, status: ChatMessage['status'] = 'completed'): ChatMessage {
  return {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: Date.now(),
    status,
    error: null,
    requestId: null,
  }
}

function createFreshSession(index = 1): ChatConversation {
  const now = Date.now()
  const id = crypto.randomUUID()
  return {
    id,
    title: index === 1 ? 'New chat' : `New chat ${index}`,
    messages: [{ ...createMessage(id, 'assistant', 'Hermes is ready.'), id: `welcome-${id}` }],
    connectionState: 'idle',
    error: null,
    createdAt: now,
    updatedAt: now,
    hermesSessionId: id,
  }
}

function normalizeStoredSession(session: ChatConversation): ChatConversation {
  const now = Date.now()
  return {
    ...session,
    connectionState: 'idle',
    error: null,
    hermesSessionId: session.hermesSessionId ?? session.id,
    messages: (session.messages ?? []).map((message) => ({
      ...message,
      conversationId: message.conversationId ?? session.id,
      createdAt: message.createdAt ?? now,
      status: message.status === 'streaming' || message.status === 'sending' || message.status === 'queued' ? 'completed' : (message.status ?? 'completed'),
      error: null,
      requestId: null,
    })),
  }
}

function loadStoredState(): StoredChatState {
  const fallback = createFreshSession()
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('hermes-chat-sessions:v1')
  if (!raw) return { sessions: [fallback], openTabIds: [], activeSessionId: null }

  try {
    const parsed = JSON.parse(raw) as StoredChatState
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeStoredSession) : []
    return { sessions: sessions.length ? sessions : [fallback], openTabIds: [], activeSessionId: null }
  } catch {
    return { sessions: [fallback], openTabIds: [], activeSessionId: null }
  }
}

function loadDrafts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

function titleFromMessage(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length <= 30 ? compact : `${compact.slice(0, 29)}…`
}

export function ChatSessionsProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadStoredState, [])
  const [sessions, setSessions] = useState<ChatConversation[]>(initial.sessions)
  const [openTabIds, setOpenTabIds] = useState<string[]>(initial.openTabIds)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initial.activeSessionId)
  const [drafts, setDrafts] = useState<Record<string, string>>(loadDrafts)
  const sessionsRef = useRef(sessions)
  const controllersRef = useRef(new Map<string, AbortController>())

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, openTabIds, activeSessionId } satisfies StoredChatState))
  }, [activeSessionId, openTabIds, sessions])
  useEffect(() => { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)) }, [drafts])
  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort())
    controllersRef.current.clear()
  }, [])

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null

  function patchSession(sessionId: string, patch: (session: ChatConversation) => ChatConversation) {
    setSessions((current) => current.map((session) => session.id === sessionId ? patch(session) : session))
  }

  function createSession() {
    const session = createFreshSession(sessionsRef.current.length + 1)
    setSessions((current) => [...current, session])
    setOpenTabIds((current) => [...current, session.id])
    setActiveSessionId(session.id)
    return session.id
  }

  function openSession(sessionId: string) {
    if (!sessionsRef.current.some((session) => session.id === sessionId)) return
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

  function cancelGeneration(sessionId: string) {
    controllersRef.current.get(sessionId)?.abort()
  }

  function deleteSession(sessionId: string) {
    cancelGeneration(sessionId)
    setDrafts((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
    setSessions((current) => current.filter((session) => session.id !== sessionId))
    setOpenTabIds((current) => {
      const next = current.filter((id) => id !== sessionId)
      if (activeSessionId === sessionId) setActiveSessionId(next.at(-1) ?? null)
      return next
    })
  }

  function renameSession(sessionId: string, title: string) {
    const nextTitle = title.replace(/\s+/g, ' ').trim()
    if (!nextTitle) return
    patchSession(sessionId, (current) => ({ ...current, title: nextTitle, updatedAt: Date.now() }))
  }

  function setDraft(sessionId: string, content: string) {
    setDrafts((current) => ({ ...current, [sessionId]: content }))
  }

  function clearDraft(sessionId: string) {
    setDrafts((current) => ({ ...current, [sessionId]: '' }))
  }

  async function runAssistantGeneration(sessionId: string, requestMessages: ChatMessage[], assistantId: string, requestId: string, hermesSessionId: string) {
    const controller = new AbortController()
    controllersRef.current.set(sessionId, controller)

    try {
      await streamHermesChat({
        messages: requestMessages,
        sessionId: hermesSessionId,
        signal: controller.signal,
        onDelta: (delta) => {
          patchSession(sessionId, (current) => ({
            ...current,
            connectionState: 'streaming',
            messages: current.messages.map((message) => message.id === assistantId && message.requestId === requestId
              ? { ...message, content: message.content + delta, status: 'streaming' }
              : message),
            updatedAt: Date.now(),
          }))
        },
      })
      patchSession(sessionId, (current) => ({
        ...current,
        connectionState: 'idle',
        error: null,
        messages: current.messages.map((message) => message.id === assistantId ? { ...message, status: 'completed', error: null } : message),
        updatedAt: Date.now(),
      }))
    } catch (caughtError) {
      const aborted = controller.signal.aborted
      const error = caughtError instanceof Error ? caughtError.message : 'Unable to reach Hermes'
      patchSession(sessionId, (current) => ({
        ...current,
        connectionState: aborted ? 'idle' : 'error',
        error: aborted ? null : error,
        messages: current.messages.map((message) => message.id === assistantId
          ? { ...message, status: aborted ? 'cancelled' : 'failed', error: aborted ? null : error }
          : message),
        updatedAt: Date.now(),
      }))
    } finally {
      if (controllersRef.current.get(sessionId) === controller) controllersRef.current.delete(sessionId)
    }
  }

  async function sendMessage(sessionId: string, content: string) {
    const trimmed = content.trim()
    const session = sessionsRef.current.find((item) => item.id === sessionId)
    if (!trimmed || !session || controllersRef.current.has(sessionId) || session.connectionState === 'connecting' || session.connectionState === 'streaming') return

    const requestId = crypto.randomUUID()
    const userMessage = { ...createMessage(sessionId, 'user', trimmed), requestId }
    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      ...createMessage(sessionId, 'assistant', '', 'sending'),
      id: assistantId,
      requestId,
    }
    const requestMessages = [...session.messages, userMessage].filter((message) => !message.id.startsWith('welcome-'))
    const nextTitle = session.title.startsWith('New chat') ? titleFromMessage(trimmed) : session.title
    const hermesSessionId = session.hermesSessionId ?? session.id

    patchSession(sessionId, (current) => ({
      ...current,
      title: nextTitle,
      messages: [...current.messages, userMessage, assistantMessage],
      connectionState: 'connecting',
      error: null,
      updatedAt: Date.now(),
    }))

    await runAssistantGeneration(sessionId, requestMessages, assistantId, requestId, hermesSessionId)
  }

  async function regenerateFromUser(sessionId: string, userMessageId: string) {
    const session = sessionsRef.current.find((item) => item.id === sessionId)
    if (!session || controllersRef.current.has(sessionId)) return
    const userIndex = session.messages.findIndex((message) => message.id === userMessageId && message.role === 'user')
    if (userIndex < 0) return

    const requestId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    const nextHermesSessionId = crypto.randomUUID()
    const history = session.messages.slice(0, userIndex + 1).map((message, index) => index === userIndex
      ? { ...message, requestId, status: 'completed' as const, error: null }
      : message)
    const assistantMessage: ChatMessage = {
      ...createMessage(sessionId, 'assistant', '', 'sending'),
      id: assistantId,
      requestId,
    }
    const requestMessages = history.filter((message) => !message.id.startsWith('welcome-'))

    patchSession(sessionId, (current) => ({
      ...current,
      hermesSessionId: nextHermesSessionId,
      messages: [...history, assistantMessage],
      connectionState: 'connecting',
      error: null,
      updatedAt: Date.now(),
    }))

    await runAssistantGeneration(sessionId, requestMessages, assistantId, requestId, nextHermesSessionId)
  }

  async function retryResponse(sessionId: string, assistantMessageId: string) {
    const session = sessionsRef.current.find((item) => item.id === sessionId)
    if (!session) return
    const assistantIndex = session.messages.findIndex((message) => message.id === assistantMessageId && message.role === 'assistant')
    if (assistantIndex < 0) return
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      if (session.messages[index].role === 'user') {
        await regenerateFromUser(sessionId, session.messages[index].id)
        return
      }
    }
  }

  const value: ChatSessionsContextValue = {
    sessions,
    openTabIds,
    activeSessionId,
    activeSession,
    drafts,
    createSession,
    openSession,
    selectSession,
    closeTab,
    closeAllTabs,
    deleteSession,
    renameSession,
    setDraft,
    clearDraft,
    sendMessage,
    cancelGeneration,
    regenerateFromUser,
    retryResponse,
  }

  return <ChatSessionsContext.Provider value={value}>{children}</ChatSessionsContext.Provider>
}

export function useChatSessions() {
  const context = useContext(ChatSessionsContext)
  if (!context) throw new Error('useChatSessions must be used inside ChatSessionsProvider')
  return context
}
