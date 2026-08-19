import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useChatSessions } from '../../../context/ChatSessionsContext'

type ChatSurfaceProps = {
  conversationId: string
}

export function ChatSurface({ conversationId }: ChatSurfaceProps) {
  const { sessions, sendMessage, cancelGeneration } = useChatSessions()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const conversation = sessions.find((session) => session.id === conversationId) ?? null

  if (!conversation) return null

  const input = drafts[conversationId] ?? ''
  const isBusy = conversation.connectionState === 'connecting' || conversation.connectionState === 'streaming'
  const statusLabel = conversation.connectionState === 'connecting'
    ? 'Connecting'
    : conversation.connectionState === 'streaming'
      ? 'Hermes is working'
      : conversation.connectionState === 'error'
        ? 'Connection error'
        : 'Ready'

  async function submitMessage() {
    const content = input.trim()
    if (!content || isBusy) return
    setDrafts((current) => ({ ...current, [conversationId]: '' }))
    await sendMessage(conversationId, content)
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
      <div className={`chat-status chat-status--${conversation.connectionState}`}>
        <span className="chat-status__dot" />
        {statusLabel}
      </div>

      <div className="chat-messages" aria-live="polite">
        {conversation.messages.map((message) => (
          <div className={`chat-message chat-message--${message.role}`} key={message.id} data-status={message.status}>
            <span className="chat-message__role">{message.role === 'user' ? 'YOU' : 'HERMES'}</span>
            <p>{message.content || (isBusy ? '…' : '')}</p>
          </div>
        ))}
      </div>

      {conversation.error && (
        <div className="chat-error" title={conversation.error}>
          Hermes API unavailable. Check the local API server and frontend proxy configuration.
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setDrafts((current) => ({ ...current, [conversationId]: event.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${conversation.title}…`}
          rows={1}
          disabled={false}
          aria-label="Message Hermes"
        />
        {isBusy ? (
          <button type="button" onClick={() => cancelGeneration(conversationId)} aria-label="Stop generation">
            STOP
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send message">
            SEND
          </button>
        )}
      </form>
    </div>
  )
}
