import { useChatSessions } from '../../context/ChatSessionsContext'
import { useRuntimeStatus } from '../../context/RuntimeStatusContext'

function activityLabel(state: string) {
  switch (state) {
    case 'connecting': return 'CONNECTING'
    case 'streaming': return 'RESPONDING'
    case 'error': return 'FAILED'
    default: return 'READY'
  }
}

export function ActivityPanel() {
  const { activeSession, activeActivity } = useChatSessions()
  const { hermesOnline } = useRuntimeStatus()

  if (!activeSession) {
    return (
      <div className="hermes-activity hermes-activity--empty">
        <div className="hermes-activity__headline">
          <span className={`activity-dot ${hermesOnline ? 'active' : 'error'}`} />
          <div>
            <strong>{hermesOnline ? 'Hermes ready' : 'Hermes offline'}</strong>
            <span>Select a chat to inspect its runtime activity.</span>
          </div>
        </div>
      </div>
    )
  }

  const isBusy = activeSession.connectionState === 'connecting' || activeSession.connectionState === 'streaming'
  const recent = [...activeActivity].reverse().slice(0, 8)

  return (
    <div className="hermes-activity" data-session-id={activeSession.id}>
      <div className="hermes-activity__headline">
        <span className={`activity-dot ${activeSession.connectionState === 'error' ? 'error' : isBusy ? 'busy' : hermesOnline ? 'active' : 'error'}`} />
        <div>
          <strong>{activityLabel(activeSession.connectionState)}</strong>
          <span title={activeSession.title}>{activeSession.title}</span>
        </div>
        <small>{activeSession.messages.length} MSG</small>
      </div>

      <div className="hermes-activity__session">
        <span>SESSION</span>
        <code title={activeSession.hermesSessionId ?? activeSession.id}>{(activeSession.hermesSessionId ?? activeSession.id).slice(0, 8)}</code>
      </div>

      <div className="hermes-activity__timeline" aria-live="polite">
        {recent.length === 0 ? (
          <div className="hermes-activity__empty-row">No runtime activity recorded yet.</div>
        ) : recent.map((event) => (
          <div className={`hermes-activity-event hermes-activity-event--${event.state}`} key={event.id}>
            <span className="hermes-activity-event__rail" />
            <div className="hermes-activity-event__copy">
              <div>
                <strong>{event.label}</strong>
                <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              </div>
              {event.detail && <p>{event.detail}</p>}
              <small>{event.kind.toUpperCase()}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="hermes-activity__footer">
        <span>Structured tool + reasoning events</span>
        <strong>AWAITING BACKEND SIGNALS</strong>
      </div>
    </div>
  )
}
