export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessageStatus = 'queued' | 'sending' | 'streaming' | 'completed' | 'cancelled' | 'failed'

export type ChatMessage = {
  id: string
  conversationId: string
  role: ChatRole
  content: string
  createdAt: number
  status: ChatMessageStatus
  error?: string | null
  requestId?: string | null
}

export type ChatConnectionState = 'idle' | 'connecting' | 'streaming' | 'error'

export type ChatActivityKind = 'session' | 'connection' | 'generation' | 'tool' | 'reasoning' | 'error'
export type ChatActivityState = 'info' | 'active' | 'success' | 'warning' | 'error'

export type ChatActivityEvent = {
  id: string
  conversationId: string
  requestId?: string | null
  kind: ChatActivityKind
  state: ChatActivityState
  label: string
  detail?: string | null
  createdAt: number
}

export type ChatConversation = {
  id: string
  title: string
  messages: ChatMessage[]
  connectionState: ChatConnectionState
  error: string | null
  createdAt: number
  updatedAt: number
  hermesSessionId?: string | null
  metadata?: Record<string, unknown>
}

export type StoredChatState = {
  sessions: ChatConversation[]
  openTabIds: string[]
  activeSessionId: string | null
}
