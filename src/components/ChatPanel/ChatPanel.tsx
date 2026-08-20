import type { MouseEvent } from 'react'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { ChatSurface } from '../../features/chat/components/ChatSurface'

export function ChatPanel() {
  const {
    sessions,
    openTabIds,
    activeSessionId,
    createSession,
    selectSession,
    closeTab,
    closeAllTabs,
    renameSession,
  } = useChatSessions()

  if (!activeSessionId) return null

  const openSessions = openTabIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session) => session !== undefined)

  function handleClose(event: MouseEvent<HTMLButtonElement>, sessionId: string) {
    event.stopPropagation()
    closeTab(sessionId)
  }

  function handleRename(event: MouseEvent<HTMLButtonElement>, sessionId: string, currentTitle: string) {
    event.stopPropagation()
    const nextTitle = window.prompt('Rename conversation', currentTitle)
    if (nextTitle !== null) renameSession(sessionId, nextTitle)
  }

  return (
    <div className="chat-shell">
      <div className="chat-tabs" role="tablist" aria-label="Open Hermes chats">
        <div className="chat-tabs__scroll">
          {openSessions.map((session) => (
            <div className={`chat-tab ${session.id === activeSessionId ? 'is-active' : ''}`} key={session.id}>
              <button
                className="chat-tab__select"
                type="button"
                role="tab"
                aria-selected={session.id === activeSessionId}
                onClick={() => selectSession(session.id)}
              >
                <span className={`chat-tab__state chat-tab__state--${session.connectionState}`} />
                <span className="chat-tab__title">{session.title}</span>
              </button>
              <button
                className="chat-tab__rename"
                type="button"
                aria-label={`Rename ${session.title}`}
                title="Rename chat"
                onClick={(event) => handleRename(event, session.id, session.title)}
              >
                ✎
              </button>
              <button
                className="chat-tab__close"
                type="button"
                aria-label={`Close ${session.title} tab`}
                onClick={(event) => handleClose(event, session.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button className="chat-tabs__new" type="button" onClick={createSession} aria-label="New Hermes chat">
          +
        </button>
        <button className="chat-tabs__close-all" type="button" onClick={closeAllTabs}>
          CLOSE ALL
        </button>
      </div>

      <ChatSurface conversationId={activeSessionId} />
    </div>
  )
}
