import { FormEvent, KeyboardEvent, useMemo, useState } from 'react'
import { streamHermesChat } from '../../lib/hermes/client'
import type { ChatMessage, HermesConnectionState } from '../../lib/hermes/types'

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Hermes is ready.',
  },
]

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [connectionState, setConnectionState] = useState<HermesConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)

  const isBusy = connectionState === 'connecting' || connectionState === 'streaming'
  const statusLabel = useMemo(() => {
    if (connectionState === 'connecting') return 'Connecting'
    if (connectionState === 'streaming') return 'Hermes is working'
    if (connectionState === 'error') return 'Connection error'
    return 'Ready'
  }, [connectionState])

  async function sendMessage() {
    const content = input.trim()
    if (!content || isBusy) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }
    const assistantId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }

    const requestMessages = [...messages, userMessage].filter((message) => message.id !== 'welcome')

    setInput('')
    setError(null)
    setConnectionState('connecting')
    setMessages((current) => [...current, userMessage, assistantMessage])

    try {
      await streamHermesChat({
        messages: requestMessages,
        onDelta: (delta) => {
          setConnectionState('streaming')
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + delta }
                : message,
            ),
          )
        },
      })
      setConnectionState('idle')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to reach Hermes'
      setError(message)
      setConnectionState('error')
      setMessages((current) => current.filter((item) => item.id !== assistantId || item.content))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="chat-shell">
      <div className={`chat-status chat-status--${connectionState}`}>
        <span className="chat-status__dot" />
        {statusLabel}
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div className={`chat-message chat-message--${message.role}`} key={message.id}>
            <span className="chat-message__role">{message.role === 'user' ? 'YOU' : 'HERMES'}</span>
            <p>{message.content || (isBusy ? '…' : '')}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="chat-error">
          Hermes API unavailable. Check the local API server and frontend proxy configuration.
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Hermes…"
          rows={1}
          disabled={isBusy}
          aria-label="Message Hermes"
        />
        <button type="submit" disabled={!input.trim() || isBusy} aria-label="Send message">
          SEND
        </button>
      </form>
    </div>
  )
}
