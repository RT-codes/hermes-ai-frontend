import type { CSSProperties, MouseEvent } from 'react'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { useHermesProfiles } from '../../context/HermesProfileContext'
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
  const { getProfile, getProfileColor } = useHermesProfiles()

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
          {openSessions.map((session) => {
            const profile = getProfile(session.profileId)
            const profileColor = getProfileColor(session.profileId)
            const profileName = profile?.displayName ?? session.profileId

            return (
              <div
                className={`chat-tab ${session.id === activeSessionId ? 'is-active' : ''}`}
                key={session.id}
                style={{ '--profile-color': profileColor } as CSSProperties}
              >
                <button
                  className="chat-tab__select"
                  type="button"
                  role="tab"
                  aria-selected={session.id === activeSessionId}
                  onClick={() => selectSession(session.id)}
                >
                  <span className={`chat-tab__state chat-tab__state--${session.connectionState}`} />
                  <span className="chat-tab__identity">
                    <span className="chat-tab__profile" title={`Hermes profile: ${profileName}`}>
                      <span className="chat-profile-dot" aria-hidden="true" />
                      {profileName}
                    </span>
                    <span className="chat-tab__title">{session.title}</span>
                  </span>
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
            )
          })}
        </div>

        <button className="chat-tabs__new" type="button" onClick={() => createSession()} aria-label="New Hermes chat">
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
