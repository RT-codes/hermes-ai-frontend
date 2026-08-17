import { useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import { useChatSessions } from '../../context/ChatSessionsContext'

export function ChatPanel() {
  const {
    sessions,
    openTabIds,
    activeSession,
    activeSessionId,
    createSession,
    selectSession,
    closeTab,
    closeAllTabs,
    sendMessage,
  } = useChatSessions()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (!activeSession || !activeSessionId) return null

  const input = drafts[activeSessionId] ?? ''
  const isBusy = activeSession.connectionState === 'connecting' || activeSession.connectionState === 'streaming'
  const statusLabel = activeSession.connectionState === 'connecting'
    ? 'Connecting'
    : activeSession.connectionState === 'streaming'
      ? 'Hermes is working'
      : activeSession.connectionState === 'error'
        ? 'Connection error'
        : 'Ready'

  const openSessions = openTabIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session) => session !== undefined)

  async function submitMessage() {
    const content = input.trim()
    if (!content || isBusy) return

    setDrafts((current) => ({ ...current, [activeSessionId]: '' }))
    await sendMessage(activeSessionId, content)
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

  function handleClose(event: MouseEvent<HTMLButtonElement>, sessionId: string) {
    event.stopPropagation()
    closeTab(sessionId)
  }

  return (
    <div className="chat-shell">
      <div className="chat-tabs" role="tablist" aria-label="Open Hermes chats">
        <div className="chat-tabs__scroll">
          {openSessions.map((session) => (
            <button
              className={`chat-tab ${session.id === activeSessionId ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={session.id === activeSessionId}
              key={session.id}
              onClick={() => selectSession(session.id)}
            >
              <span className={`chat-tab__state chat-tab__state--${session.connectionState}`} />
              <span className="chat-tab__title">{session.title}</span>
              <button
                className="chat-tab__close"
                type="button"
                aria-label={`Close ${session.title} tab`}
                onClick={(event) => handleClose(event, session.id)}
              >
                ×
              </button>
            </button>
          ))}
        </div>

        <button className="chat-tabs__new" type="button" onClick={createSession} aria-label="New Hermes chat">
          +
        </button>
        <button className="chat-tabs__close-all" type="button" onClick={closeAllTabs}>
          CLOSE ALL
        </button>
      </div>

      <div className={`chat-status chat-status--${activeSession.connectionState}`}>
        <span className="chat-status__dot" />
        {statusLabel}
      </div>

      <div className="chat-messages" aria-live="polite">
        {activeSession.messages.map((message) => (
          <div className={`chat-message chat-message--${message.role}`} key={message.id}>
            <span className="chat-message__role">{message.role === 'user' ? 'YOU' : 'HERMES'}</span>
            <p>{message.content || (isBusy ? '…' : '')}</p>
          </div>
        ))}
      </div>

      {activeSession.error && (
        <div className="chat-error" title={activeSession.error}>
          Hermes API unavailable. Check the local API server and frontend proxy configuration.
        </div>
      )}

      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setDrafts((current) => ({ ...current, [activeSessionId]: event.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${activeSession.title}…`}
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
