import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, UIEvent } from 'react'
import { useChatSessions } from '../../../context/ChatSessionsContext'
import { useRuntimeStatus } from '../../../context/RuntimeStatusContext'
import type { ChatMessage } from '../types'
import { MarkdownMessage } from './MarkdownMessage'

type ChatSurfaceProps = {
  conversationId: string
}

const FOLLOW_THRESHOLD_PX = 72

function MessageActions({
  message,
  busy,
  onRegenerate,
}: {
  message: ChatMessage
  busy: boolean
  onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const canRegenerate = message.role === 'assistant' && !message.id.startsWith('welcome-') && !busy

  return (
    <div className="chat-message__meta">
      <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      {message.status !== 'completed' && <span className={`chat-message__status chat-message__status--${message.status}`}>{message.status}</span>}
      {message.content && <button type="button" onClick={() => void copy()}>{copied ? 'COPIED' : 'COPY'}</button>}
      {canRegenerate && (
        <button type="button" onClick={onRegenerate}>
          {message.status === 'failed' ? 'RETRY' : 'REGENERATE'}
        </button>
      )}
    </div>
  )
}

export function ChatSurface({ conversationId }: ChatSurfaceProps) {
  const {
    sessions,
    drafts,
    setDraft,
    clearDraft,
    sendMessage,
    cancelGeneration,
    retryResponse,
  } = useChatSessions()
  const { hermesOnline, checkedAt, refresh } = useRuntimeStatus()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const followLatestRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const conversation = sessions.find((session) => session.id === conversationId) ?? null
  const input = drafts[conversationId] ?? ''
  const latestContent = conversation?.messages.at(-1)?.content ?? ''

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [conversationId, input])

  useEffect(() => {
    followLatestRef.current = true
    setShowJumpToLatest(false)
    const container = messagesRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [conversationId])

  useEffect(() => {
    const container = messagesRef.current
    if (!container || !followLatestRef.current) return
    container.scrollTop = container.scrollHeight
  }, [conversation?.messages.length, latestContent])

  if (!conversation) return null

  const isBusy = conversation.connectionState === 'connecting' || conversation.connectionState === 'streaming'
  const isKnownOffline = checkedAt !== null && !hermesOnline
  const latestFailedAssistant = [...conversation.messages].reverse().find((message) => message.role === 'assistant' && message.status === 'failed') ?? null
  const statusLabel = conversation.connectionState === 'connecting'
    ? 'Connecting'
    : conversation.connectionState === 'streaming'
      ? 'Hermes is working'
      : conversation.connectionState === 'error'
        ? 'Connection error'
        : isKnownOffline
          ? 'Hermes offline'
          : 'Ready'

  function handleMessagesScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    const shouldFollow = distanceFromBottom <= FOLLOW_THRESHOLD_PX
    followLatestRef.current = shouldFollow
    setShowJumpToLatest(!shouldFollow)
  }

  function jumpToLatest() {
    const container = messagesRef.current
    if (!container) return
    followLatestRef.current = true
    setShowJumpToLatest(false)
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }

  async function submitMessage() {
    const content = input.trim()
    if (!content || isBusy || isKnownOffline) return
    followLatestRef.current = true
    setShowJumpToLatest(false)
    clearDraft(conversationId)
    await sendMessage(conversationId, content)
    textareaRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitMessage()
    }
  }

  return (
    <div className="chat-surface" data-conversation-id={conversationId}>
      <div className={`chat-status chat-status--${conversation.connectionState} ${isKnownOffline ? 'chat-status--offline' : ''}`}>
        <span className="chat-status__dot" />
        {statusLabel}
      </div>

      {isKnownOffline && (
        <div className="chat-offline" role="status">
          <span>Hermes is offline. Your conversations and draft are preserved.</span>
          <button type="button" onClick={() => void refresh()}>CHECK AGAIN</button>
        </div>
      )}

      <div className="chat-messages" ref={messagesRef} onScroll={handleMessagesScroll} aria-live="polite">
        {conversation.messages.length === 0 && (
          <div className="chat-conversation-empty">
            <strong>New conversation</strong>
            <span>{isKnownOffline ? 'Hermes is offline, but you can prepare a draft now.' : 'Ask Hermes anything when you are ready.'}</span>
          </div>
        )}
        {conversation.messages.map((message) => (
          <div className={`chat-message chat-message--${message.role}`} key={message.id} data-status={message.status}>
            <span className="chat-message__role">{message.role === 'user' ? 'YOU' : 'HERMES'}</span>
            {message.role === 'assistant'
              ? <MarkdownMessage content={message.content || (isBusy ? '…' : '')} />
              : <p>{message.content}</p>}
            <MessageActions
              message={message}
              busy={isBusy}
              onRegenerate={() => void retryResponse(conversationId, message.id)}
            />
          </div>
        ))}
      </div>

      {showJumpToLatest && (
        <button className="chat-jump-latest" type="button" onClick={jumpToLatest} aria-label="Jump to latest message">
          ↓ LATEST
        </button>
      )}

      {conversation.error && (
        <div className="chat-error" title={conversation.error} role="alert">
          <span>{conversation.error}</span>
          <div className="chat-error__actions">
            {latestFailedAssistant && !isBusy && (
              <button type="button" onClick={() => void retryResponse(conversationId, latestFailedAssistant.id)}>RETRY RESPONSE</button>
            )}
            <button type="button" onClick={() => void refresh()}>CHECK CONNECTION</button>
          </div>
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setDraft(conversationId, event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isKnownOffline ? 'Hermes is offline — draft is saved' : `Message ${conversation.title}…`}
          rows={1}
          aria-label="Message Hermes"
          style={{ maxHeight: 160, overflowY: 'auto', resize: 'none' }}
        />
        {isBusy ? (
          <button type="button" onClick={() => cancelGeneration(conversationId)} aria-label="Stop generation">
            STOP
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || isKnownOffline} aria-label="Send message">
            SEND
          </button>
        )}
      </form>
    </div>
  )
}
