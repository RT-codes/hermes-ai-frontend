import { useMemo } from 'react'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { useRuntimeStatus } from '../../context/RuntimeStatusContext'

function activityLabel(state: string) {
  switch (state) {
    case 'connecting': return 'CONNECTING'
    case 'streaming': return 'WORKING'
    case 'error': return 'FAILED'
    default: return 'READY'
  }
}

function eventTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ActivityPanel() {
  const { activeSession, activeActivity } = useChatSessions()
  const { hermesOnline } = useRuntimeStatus()

  const reasoningEvents = useMemo(
    () => activeActivity.filter((event) => event.kind === 'reasoning' && event.detail),
    [activeActivity],
  )
  const toolEvents = useMemo(
    () => activeActivity.filter((event) => event.kind === 'tool').slice(-8).reverse(),
    [activeActivity],
  )
  const runtimeEvents = useMemo(
    () => activeActivity.filter((event) => event.kind !== 'reasoning' && event.kind !== 'tool').slice(-7).reverse(),
    [activeActivity],
  )

  if (!activeSession) {
    return (
      <div className="hermes-insight hermes-insight--empty">
        <div className="hermes-activity__headline">
          <span className={`activity-dot ${hermesOnline ? 'active' : 'error'}`} />
          <div>
            <strong>{hermesOnline ? 'Hermes ready' : 'Hermes offline'}</strong>
            <span>Select a chat to inspect its runtime activity.</span>
          </div>
        </div>
        <div className="hermes-insight__working hermes-insight__working--empty">
          <span>WORKING TRACE</span>
          <p>Reasoning, tool activity, and runtime events will follow the active Hermes session here.</p>
        </div>
      </div>
    )
  }

  const isBusy = activeSession.connectionState === 'connecting' || activeSession.connectionState === 'streaming'
  const reasoningText = reasoningEvents.map((event) => event.detail).filter(Boolean).join('\n\n')
  const nativeSession = activeSession.metadata?.nativeSession === true

  return (
    <div className="hermes-insight" data-session-id={activeSession.id}>
      <div className="hermes-activity__headline">
        <span className={`activity-dot ${activeSession.connectionState === 'error' ? 'error' : isBusy ? 'busy' : hermesOnline ? 'active' : 'error'}`} />
        <div>
          <strong>{activityLabel(activeSession.connectionState)}</strong>
          <span title={activeSession.title}>{activeSession.title}</span>
        </div>
        <small>{nativeSession ? 'NATIVE' : 'COMPAT'}</small>
      </div>

      <div className="hermes-activity__session">
        <span>SESSION</span>
        <code title={activeSession.hermesSessionId ?? activeSession.id}>{(activeSession.hermesSessionId ?? activeSession.id).slice(0, 8)}</code>
      </div>

      <section className="hermes-insight__working" aria-label="Hermes reasoning and working trace">
        <div className="hermes-insight__section-heading">
          <span>WORKING TRACE</span>
          <small>{reasoningEvents.length ? `${reasoningEvents.length} SIGNAL${reasoningEvents.length === 1 ? '' : 'S'}` : 'LIVE WHEN AVAILABLE'}</small>
        </div>
        <div className="hermes-insight__reasoning" aria-live="polite">
          {reasoningText ? (
            <pre>{reasoningText}</pre>
          ) : (
            <div className="hermes-insight__placeholder">
              <strong>{isBusy ? 'Hermes is working…' : 'No reasoning text emitted for this turn.'}</strong>
              <p>
                {nativeSession
                  ? 'This panel only shows reasoning text Hermes explicitly publishes. Tool and lifecycle events still appear below.'
                  : 'This saved conversation predates the native session transport. New chats use richer Hermes events automatically.'}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="hermes-insight__tools" aria-label="Hermes tool activity">
        <div className="hermes-insight__section-heading">
          <span>TOOLS</span>
          <small>{toolEvents.length ? `${toolEvents.length} RECENT` : 'IDLE'}</small>
        </div>
        <div className="hermes-insight__tool-list">
          {toolEvents.length === 0 ? (
            <div className="hermes-activity__empty-row">No tool calls recorded for this session yet.</div>
          ) : toolEvents.map((event) => (
            <article className={`hermes-tool-event hermes-tool-event--${event.state}`} key={event.id}>
              <span className="hermes-tool-event__dot" />
              <div>
                <div><strong>{event.label}</strong><time>{eventTime(event.createdAt)}</time></div>
                {event.detail && <p>{event.detail}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="hermes-insight__runtime" aria-label="Hermes runtime timeline">
        <div className="hermes-insight__section-heading">
          <span>ACTIVITY</span>
          <small>SESSION PINNED</small>
        </div>
        <div className="hermes-activity__timeline">
          {runtimeEvents.length === 0 ? (
            <div className="hermes-activity__empty-row">No runtime activity recorded yet.</div>
          ) : runtimeEvents.map((event) => (
            <div className={`hermes-activity-event hermes-activity-event--${event.state}`} key={event.id}>
              <span className="hermes-activity-event__rail" />
              <div className="hermes-activity-event__copy">
                <div>
                  <strong>{event.label}</strong>
                  <time>{eventTime(event.createdAt)}</time>
                </div>
                {event.detail && <p>{event.detail}</p>}
                <small>{event.kind.toUpperCase()}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
