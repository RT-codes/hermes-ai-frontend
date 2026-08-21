import { useMemo, type CSSProperties } from 'react'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { useHermesProfiles } from '../../context/HermesProfileContext'
import { useInsightSelection } from '../../context/InsightSelectionContext'
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
  const { getProfile, getProfileColor } = useHermesProfiles()
  const { selectedRequestBySession, clearRequestTrace } = useInsightSelection()
  const { hermesOnline } = useRuntimeStatus()

  const isBusy = activeSession?.connectionState === 'connecting' || activeSession?.connectionState === 'streaming'
  const selectedRequestId = activeSession ? selectedRequestBySession[activeSession.id] ?? null : null
  const latestAssistant = useMemo(
    () => activeSession ? [...activeSession.messages].reverse().find((message) => message.role === 'assistant' && message.requestId) ?? null : null,
    [activeSession],
  )
  const traceRequestId = selectedRequestId ?? latestAssistant?.requestId ?? null
  const traceEvents = useMemo(
    () => traceRequestId ? activeActivity.filter((event) => event.requestId === traceRequestId) : activeActivity,
    [activeActivity, traceRequestId],
  )
  const reasoningEvents = useMemo(
    () => traceEvents.filter((event) => event.kind === 'reasoning' && event.detail),
    [traceEvents],
  )
  const toolEvents = useMemo(
    () => traceEvents.filter((event) => event.kind === 'tool').slice(-10).reverse(),
    [traceEvents],
  )
  const runtimeEvents = useMemo(
    () => traceEvents.filter((event) => event.kind !== 'reasoning' && event.kind !== 'tool').slice(-9).reverse(),
    [traceEvents],
  )
  const verifiedTraceLines = useMemo(
    () => traceEvents
      .filter((event) => event.kind !== 'reasoning')
      .map((event) => `${eventTime(event.createdAt)}  ${event.label}${event.detail ? ` — ${event.detail}` : ''}`),
    [traceEvents],
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

  const profile = getProfile(activeSession.profileId)
  const profileName = profile?.displayName ?? activeSession.profileId
  const profileColor = getProfileColor(activeSession.profileId)
  const reasoningText = reasoningEvents.map((event) => event.detail ?? '').join('')
  const nativeSession = activeSession.metadata?.nativeSession === true
  const historical = Boolean(selectedRequestId)
  const traceMode = historical ? 'HISTORICAL TRACE' : isBusy ? 'LIVE TRACE' : traceRequestId ? 'LATEST TRACE' : 'SESSION TRACE'
  const selectedAssistant = historical
    ? activeSession.messages.find((message) => message.role === 'assistant' && message.requestId === selectedRequestId) ?? null
    : latestAssistant

  return (
    <div
      className="hermes-insight hermes-insight--profile-aware"
      data-session-id={activeSession.id}
      data-profile-id={activeSession.profileId}
      data-trace-request-id={traceRequestId ?? undefined}
      style={{ '--profile-color': profileColor } as CSSProperties}
    >
      <div className="hermes-insight__profile-strip" title={`Hermes profile: ${activeSession.profileId}`}>
        <span className="hermes-insight__profile-dot" aria-hidden="true" />
        <div>
          <small>PROFILE</small>
          <strong>{profileName}</strong>
        </div>
        <code>{activeSession.profileId}</code>
      </div>

      <div className="hermes-activity__headline">
        <span className={`activity-dot ${activeSession.connectionState === 'error' ? 'error' : isBusy ? 'busy' : hermesOnline ? 'active' : 'error'}`} />
        <div>
          <strong>{activityLabel(activeSession.connectionState)}</strong>
          <span title={activeSession.title}>{activeSession.title}</span>
        </div>
        <small>{nativeSession ? 'NATIVE' : 'COMPAT'}</small>
      </div>

      <div className="hermes-activity__session hermes-activity__session--trace">
        <div>
          <span>SESSION</span>
          <code title={activeSession.hermesSessionId ?? activeSession.id}>{(activeSession.hermesSessionId ?? activeSession.id).slice(0, 8)}</code>
        </div>
        <div>
          <span>{traceMode}</span>
          <code title={traceRequestId ?? 'No response selected'}>{traceRequestId ? traceRequestId.slice(0, 8) : '—'}</code>
        </div>
        {historical && (
          <button type="button" onClick={() => clearRequestTrace(activeSession.id)}>RETURN LIVE</button>
        )}
      </div>

      <section className="hermes-insight__working" aria-label={`${profileName} reasoning and working trace`}>
        <div className="hermes-insight__section-heading">
          <span>WORKING TRACE · {profileName.toUpperCase()}</span>
          <small>{reasoningEvents.length ? `${reasoningEvents.length} SIGNAL${reasoningEvents.length === 1 ? '' : 'S'}` : traceMode}</small>
        </div>
        <div className="hermes-insight__reasoning" aria-live="polite">
          {reasoningText ? (
            <pre>{reasoningText}</pre>
          ) : verifiedTraceLines.length ? (
            <div className="hermes-insight__verified-trace">
              <strong>{nativeSession ? `No separate ${profileName} reasoning text was emitted for this response.` : 'Compatibility transport does not expose separate model reasoning.'}</strong>
              <p>Showing the verified Hermes execution trace instead; these lines come from actual session events, not generated thoughts.</p>
              <pre>{verifiedTraceLines.join('\n')}</pre>
            </div>
          ) : (
            <div className="hermes-insight__placeholder">
              <strong>{isBusy && !historical ? `Waiting for ${profileName} working signals…` : 'No trace events recorded for this response.'}</strong>
              <p>
                {nativeSession
                  ? `Reasoning appears here when ${profileName} publishes it. Tool and lifecycle evidence is shown as a verified trace when separate reasoning is unavailable.`
                  : `This conversation is using the ${profileName} compatibility transport. Profile provenance remains pinned to this chat even when richer native session events are unavailable.`}
              </p>
            </div>
          )}
        </div>
        {selectedAssistant?.content && (
          <div className="hermes-insight__response-context" title={selectedAssistant.content}>
            <span>RESPONSE · {profileName.toUpperCase()}</span>
            <p>{selectedAssistant.content.replace(/\s+/g, ' ').slice(0, 180)}{selectedAssistant.content.length > 180 ? '…' : ''}</p>
          </div>
        )}
      </section>

      <section className="hermes-insight__tools" aria-label={`${profileName} tool activity`}>
        <div className="hermes-insight__section-heading">
          <span>TOOLS · {profileName.toUpperCase()}</span>
          <small>{toolEvents.length ? `${toolEvents.length} RECENT` : 'IDLE'}</small>
        </div>
        <div className="hermes-insight__tool-list">
          {toolEvents.length === 0 ? (
            <div className="hermes-activity__empty-row">No tool calls recorded for this response.</div>
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

      <section className="hermes-insight__runtime" aria-label={`${profileName} runtime timeline`}>
        <div className="hermes-insight__section-heading">
          <span>ACTIVITY · {profileName.toUpperCase()}</span>
          <small>{historical ? 'RESPONSE PINNED' : 'SESSION PINNED'}</small>
        </div>
        <div className="hermes-activity__timeline">
          {runtimeEvents.length === 0 ? (
            <div className="hermes-activity__empty-row">No runtime activity recorded for this response.</div>
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
