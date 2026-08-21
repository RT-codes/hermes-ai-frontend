import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { browserChatPersistence } from '../features/chat/persistence'
import type { ChatActivityEvent, ChatActivityKind, ChatActivityState, ChatConversation, ChatMessage, StoredChatState } from '../features/chat/types'
import { streamHermesChat, type HermesNativeEvent } from '../lib/hermes/client'
import { DEFAULT_HERMES_PROFILE_ID } from '../lib/hermes/profiles'

type ChatSessionsContextValue = {
  sessions: ChatConversation[]
  openTabIds: string[]
  activeSessionId: string | null
  activeSession: ChatConversation | null
  activityBySession: Record<string, ChatActivityEvent[]>
  activeActivity: ChatActivityEvent[]
  drafts: Record<string, string>
  createSession: (profileId?: string) => string
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

const ChatSessionsContext = createContext<ChatSessionsContextValue | null>(null)
const MAX_ACTIVITY_EVENTS = 240
export const NEW_CHAT_PROFILE_REQUEST_EVENT = 'hermes:new-chat-profile-request'

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

function createFreshSession(index = 1, profileId = DEFAULT_HERMES_PROFILE_ID): ChatConversation {
  const now = Date.now()
  const id = crypto.randomUUID()
  return {
    id,
    title: index === 1 ? 'New chat' : `New chat ${index}`,
    profileId,
    messages: [],
    connectionState: 'idle',
    error: null,
    createdAt: now,
    updatedAt: now,
    hermesSessionId: id,
    metadata: { nativeSession: profileId === DEFAULT_HERMES_PROFILE_ID },
  }
}

function normalizeStoredSession(session: ChatConversation): ChatConversation {
  const now = Date.now()
  const storedProfileId = typeof session.profileId === 'string' && session.profileId.trim()
    ? session.profileId.trim()
    : DEFAULT_HERMES_PROFILE_ID

  return {
    ...session,
    profileId: storedProfileId,
    connectionState: 'idle',
    error: null,
    hermesSessionId: session.hermesSessionId ?? session.id,
    metadata: {
      ...session.metadata,
      nativeSession: storedProfileId === DEFAULT_HERMES_PROFILE_ID && session.metadata?.nativeSession !== false,
    },
    messages: (session.messages ?? []).map((message) => ({
      ...message,
      conversationId: message.conversationId ?? session.id,
      createdAt: message.createdAt ?? now,
      status: message.status === 'streaming' || message.status === 'sending' || message.status === 'queued' ? 'completed' : (message.status ?? 'completed'),
      error: null,
      requestId: typeof message.requestId === 'string' ? message.requestId : null,
    })),
  }
}

function normalizeStoredActivity(value: StoredChatState['activityBySession']) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).map(([sessionId, events]) => [
      sessionId,
      Array.isArray(events)
        ? events
            .filter((event): event is ChatActivityEvent => Boolean(event && typeof event === 'object' && typeof event.id === 'string'))
            .slice(-MAX_ACTIVITY_EVENTS)
        : [],
    ]),
  )
}

function loadStoredState(): StoredChatState {
  const persisted = browserChatPersistence.loadState()
  if (!persisted) return { sessions: [], openTabIds: [], activeSessionId: null, activityBySession: {} }
  const sessions = Array.isArray(persisted.sessions) ? persisted.sessions.map(normalizeStoredSession) : []
  return {
    sessions,
    openTabIds: [],
    activeSessionId: null,
    activityBySession: normalizeStoredActivity(persisted.activityBySession),
  }
}

function deriveConversationTitle(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length <= 30 ? compact : `${compact.slice(0, 29)}…`
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' ? value : ''
}

function compactJson(value: unknown) {
  if (value == null) return ''
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text.length > 260 ? `${text.slice(0, 257)}…` : text
  } catch {
    return ''
  }
}

export function ChatSessionsProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadStoredState, [])
  const [sessions, setSessions] = useState<ChatConversation[]>(initial.sessions)
  const [openTabIds, setOpenTabIds] = useState<string[]>(initial.openTabIds)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initial.activeSessionId)
  const [activityBySession, setActivityBySession] = useState<Record<string, ChatActivityEvent[]>>(initial.activityBySession ?? {})
  const [drafts, setDrafts] = useState<Record<string, string>>(() => browserChatPersistence.loadDrafts())
  const sessionsRef = useRef(sessions)
  const controllersRef = useRef(new Map<string, AbortController>())
  const firstDeltaSeenRef = useRef(new Set<string>())

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => {
    browserChatPersistence.saveState({ sessions, openTabIds, activeSessionId, activityBySession })
  }, [activeSessionId, activityBySession, openTabIds, sessions])
  useEffect(() => { browserChatPersistence.saveDrafts(drafts) }, [drafts])
  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort())
    controllersRef.current.clear()
  }, [])

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const activeActivity = activeSessionId ? activityBySession[activeSessionId] ?? [] : []

  function patchSession(sessionId: string, patch: (session: ChatConversation) => ChatConversation) {
    setSessions((current) => current.map((session) => session.id === sessionId ? patch(session) : session))
  }

  function appendActivity(sessionId: string, kind: ChatActivityKind, state: ChatActivityState, label: string, detail?: string | null, requestId?: string | null) {
    const event: ChatActivityEvent = {
      id: crypto.randomUUID(),
      conversationId: sessionId,
      requestId: requestId ?? null,
      kind,
      state,
      label,
      detail: detail ?? null,
      createdAt: Date.now(),
    }
    setActivityBySession((current) => ({
      ...current,
      [sessionId]: [...(current[sessionId] ?? []), event].slice(-MAX_ACTIVITY_EVENTS),
    }))
  }

  function mapHermesEvent(sessionId: string, requestId: string, event: HermesNativeEvent) {
    const { type, payload } = event

    if (type === 'transport.profile_route') {
      appendActivity(sessionId, 'connection', 'info', 'Profile route selected', payloadString(payload, 'route') || payloadString(payload, 'profileId'), requestId)
      return
    }

    if (type === 'transport.fallback') {
      appendActivity(sessionId, 'connection', 'warning', 'Compatibility transport', 'Native Hermes session events are unavailable for this conversation; using Chat Completions.', requestId)
      return
    }

    if (type === 'run.started') {
      appendActivity(sessionId, 'generation', 'active', 'Agent run started', 'Hermes accepted the turn and started agent execution.', requestId)
      return
    }

    if (type === 'message.started') {
      appendActivity(sessionId, 'generation', 'active', 'Assistant stream opened', 'Waiting for model or tool output.', requestId)
      return
    }

    if (type === 'tool.progress') {
      const toolName = payloadString(payload, 'tool_name') || payloadString(payload, 'tool')
      const reasoning = payloadString(payload, 'delta')
      if (toolName === '_thinking' || reasoning) {
        if (reasoning) appendActivity(sessionId, 'reasoning', 'active', 'Hermes reasoning', reasoning, requestId)
        return
      }
      const detail = payloadString(payload, 'preview') || payloadString(payload, 'label') || compactJson(payload.args)
      appendActivity(sessionId, 'tool', 'active', toolName ? `Tool · ${toolName}` : 'Tool progress', detail || null, requestId)
      return
    }

    if (type === 'hermes.tool.progress') {
      const toolName = payloadString(payload, 'tool') || 'tool'
      const status = payloadString(payload, 'status')
      const detail = payloadString(payload, 'label')
      appendActivity(sessionId, 'tool', status === 'completed' ? 'success' : 'active', `${status === 'completed' ? 'Tool complete' : 'Tool'} · ${toolName}`, detail || null, requestId)
      return
    }

    if (type === 'tool.started' || type === 'tool.completed' || type === 'tool.failed') {
      const toolName = payloadString(payload, 'tool_name') || 'tool'
      const detail = payloadString(payload, 'preview') || compactJson(payload.args)
      appendActivity(
        sessionId,
        'tool',
        type === 'tool.completed' ? 'success' : type === 'tool.failed' ? 'error' : 'active',
        `${type === 'tool.completed' ? 'Tool complete' : type === 'tool.failed' ? 'Tool failed' : 'Tool'} · ${toolName}`,
        detail || null,
        requestId,
      )
      return
    }

    if (type === 'assistant.completed') {
      appendActivity(sessionId, 'generation', 'success', 'Assistant output complete', 'Hermes finalized the assistant message.', requestId)
      return
    }

    if (type === 'run.completed') {
      const usage = payload.usage && typeof payload.usage === 'object' ? compactJson(payload.usage) : ''
      appendActivity(sessionId, 'generation', 'success', 'Agent run complete', usage || 'Turn completed successfully.', requestId)
      return
    }

    if (type === 'error') {
      appendActivity(sessionId, 'error', 'error', 'Hermes runtime error', payloadString(payload, 'message') || 'The native session stream reported an error.', requestId)
    }
  }

  function createSession(profileId?: string) {
    if (!profileId) {
      window.dispatchEvent(new CustomEvent(NEW_CHAT_PROFILE_REQUEST_EVENT))
      return ''
    }

    const session = createFreshSession(sessionsRef.current.length + 1, profileId)
    setSessions((current) => [...current, session])
    setOpenTabIds((current) => [...current, session.id])
    setActiveSessionId(session.id)
    appendActivity(session.id, 'session', 'success', 'Session ready', `Bound to Hermes profile: ${profileId}`)
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
    const controller = controllersRef.current.get(sessionId)
    if (!controller) return
    appendActivity(sessionId, 'generation', 'warning', 'Stopping response', 'Cancellation requested for the active generation.')
    controller.abort()
  }

  function deleteSession(sessionId: string) {
    cancelGeneration(sessionId)
    setDrafts((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
    setActivityBySession((current) => {
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

  async function runAssistantGeneration(
    sessionId: string,
    requestMessages: ChatMessage[],
    assistantId: string,
    requestId: string,
    hermesSessionId: string,
    profileId: string,
    preferNativeSession: boolean,
  ) {
    const controller = new AbortController()
    controllersRef.current.set(sessionId, controller)
    firstDeltaSeenRef.current.delete(requestId)
    appendActivity(
      sessionId,
      'connection',
      'active',
      'Connecting to Hermes',
      profileId === DEFAULT_HERMES_PROFILE_ID
        ? (preferNativeSession ? 'Opening native session event stream.' : 'Opening compatibility response stream.')
        : `Routing to Hermes profile: ${profileId}`,
      requestId,
    )

    try {
      await streamHermesChat({
        messages: requestMessages,
        sessionId: hermesSessionId,
        profileId,
        preferNativeSession,
        signal: controller.signal,
        onEvent: (event) => mapHermesEvent(sessionId, requestId, event),
        onDelta: (delta) => {
          if (!firstDeltaSeenRef.current.has(requestId)) {
            firstDeltaSeenRef.current.add(requestId)
            appendActivity(sessionId, 'generation', 'active', 'Hermes responding', 'First response token received.', requestId)
          }
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
      appendActivity(sessionId, 'generation', 'success', 'Response complete', 'Hermes finished the current response.', requestId)
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
      appendActivity(
        sessionId,
        aborted ? 'generation' : 'error',
        aborted ? 'warning' : 'error',
        aborted ? 'Response stopped' : 'Hermes request failed',
        aborted ? 'Partial response preserved.' : error,
        requestId,
      )
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
      firstDeltaSeenRef.current.delete(requestId)
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
    const nextTitle = session.title.startsWith('New chat') ? deriveConversationTitle(trimmed) : session.title
    const hermesSessionId = session.hermesSessionId ?? session.id
    const profileId = session.profileId || DEFAULT_HERMES_PROFILE_ID
    const preferNativeSession = profileId === DEFAULT_HERMES_PROFILE_ID && session.metadata?.nativeSession === true

    appendActivity(sessionId, 'generation', 'info', 'Request queued', `Hermes profile: ${profileId}`, requestId)
    patchSession(sessionId, (current) => ({
      ...current,
      title: nextTitle,
      messages: [...current.messages, userMessage, assistantMessage],
      connectionState: 'connecting',
      error: null,
      updatedAt: Date.now(),
    }))

    await runAssistantGeneration(sessionId, requestMessages, assistantId, requestId, hermesSessionId, profileId, preferNativeSession)
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
    const profileId = session.profileId || DEFAULT_HERMES_PROFILE_ID

    appendActivity(sessionId, 'session', 'info', 'Fresh compatibility session', `Replaying visible history for profile: ${profileId}`, requestId)
    patchSession(sessionId, (current) => ({
      ...current,
      hermesSessionId: nextHermesSessionId,
      metadata: { ...current.metadata, nativeSession: false },
      messages: [...history, assistantMessage],
      connectionState: 'connecting',
      error: null,
      updatedAt: Date.now(),
    }))

    await runAssistantGeneration(sessionId, requestMessages, assistantId, requestId, nextHermesSessionId, profileId, false)
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
    activityBySession,
    activeActivity,
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
