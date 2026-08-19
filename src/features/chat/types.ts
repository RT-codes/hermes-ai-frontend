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
