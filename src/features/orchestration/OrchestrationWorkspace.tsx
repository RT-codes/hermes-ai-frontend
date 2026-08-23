import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BrainHudPanel } from '../../components/BrainHudPanel/BrainHudPanel'
import { SpatialInteractionCanvas } from '../../components/SpatialInteractionCanvas/SpatialInteractionCanvas'
import { SpatialStageEnvironment } from '../../components/SpatialStageEnvironment/SpatialStageEnvironment'
import { TimelineHud, type TimelineMarker } from '../../components/TimelineHud/TimelineHud'
import { useHermesProfiles } from '../../context/HermesProfileContext'

type Agent = {
  id: string
  name: string
  activity_state: 'working' | 'blocked' | 'unknown' | string
  current_task_id: string | null
  task_counts: Record<string, number>
  gateway_running: boolean | null
  description: string | null
}

type Task = {
  id: string
  title: string
  body?: string | null
  assignee: string | null
  status: string
  priority?: number | null
  created_by?: string | null
  result?: string | null
  timestamps?: {
    created_at?: string | null
    started_at?: string | null
    completed_at?: string | null
  }
}

type TaskEvent = {
  sequence: number
  kind: string
  created_at_iso: string | null
  run_id: number | null
  payload: unknown
}

type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

const BOARD = 'orchestration-lab'
const API = '/control-api'

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function taskStateLabel(status: string) {
  if (status === 'running') return 'WORKING'
  if (status === 'blocked') return 'BLOCKED'
  if (status === 'done') return 'DONE'
  if (status === 'ready') return 'READY'
  return status.toUpperCase()
}

function eventTone(kind: string): TimelineMarker['tone'] {
  if (kind === 'completed') return 'success'
  if (kind === 'blocked' || kind === 'failed' || kind === 'timeout') return 'danger'
  if (kind === 'claimed' || kind === 'spawned') return 'accent'
  if (kind === 'heartbeat') return 'default'
  return 'warning'
}

export function OrchestrationWorkspace() {
  const { getProfileColor } = useHermesProfiles()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<TaskEvent[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const refreshSnapshot = useCallback(async () => {
    const [agentsResponse, tasksResponse] = await Promise.all([
      fetch(`${API}/v1/agents?board=${BOARD}`, { cache: 'no-store' }),
      fetch(`${API}/v1/tasks?board=${BOARD}&limit=200`, { cache: 'no-store' }),
    ])

    if (!agentsResponse.ok || !tasksResponse.ok) {
      throw new Error(`Control service snapshot failed (${agentsResponse.status}/${tasksResponse.status})`)
    }

    const agentsPayload = await agentsResponse.json() as { agents: Agent[] }
    const tasksPayload = await tasksResponse.json() as { tasks: Task[] }
    setAgents(agentsPayload.agents)
    setTasks(tasksPayload.tasks)
    setSelectedTaskId((current) => current ?? tasksPayload.tasks[0]?.id ?? null)
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    refreshSnapshot()
      .then(() => {
        if (!cancelled) setConnectionState('live')
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setConnectionState('offline')
          setError(reason instanceof Error ? reason.message : 'Control service unavailable')
        }
      })

    return () => {
      cancelled = true
    }
  }, [refreshSnapshot])

  useEffect(() => {
    const source = new EventSource(`${API}/v1/events/stream?board=${BOARD}`)

    source.onopen = () => setConnectionState('live')
    source.onerror = () => setConnectionState((current) => current === 'offline' ? 'offline' : 'reconnecting')

    const reconcile = () => {
      void refreshSnapshot().catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Snapshot reconciliation failed')
      })
    }

    source.addEventListener('board_snapshot', reconcile)
    source.addEventListener('task_event', reconcile)
    source.addEventListener('snapshot', reconcile)
    source.addEventListener('reconcile', reconcile)

    return () => source.close()
  }, [refreshSnapshot])

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedEvents([])
      return
    }

    let cancelled = false
    fetch(`${API}/v1/tasks/${selectedTaskId}/events?board=${BOARD}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Task events failed (${response.status})`)
        return response.json() as Promise<{ events: TaskEvent[] }>
      })
      .then((payload) => {
        if (!cancelled) setSelectedEvents(payload.events.slice().reverse())
      })
      .catch(() => {
        if (!cancelled) setSelectedEvents([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedTaskId, tasks])

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  )

  const timelineMarkers = useMemo<TimelineMarker[]>(() => {
    const ownerColor = getProfileColor(selectedTask?.assignee ?? 'default')
    return selectedEvents
      .filter((event): event is TaskEvent & { created_at_iso: string } => Boolean(event.created_at_iso))
      .map((event) => ({
        id: `${selectedTaskId ?? 'task'}:${event.sequence}:${event.kind}`,
        at: event.created_at_iso,
        label: event.kind,
        tone: eventTone(event.kind),
        color: ownerColor,
        detail: event.run_id == null ? `Event ${event.sequence}` : `Run ${event.run_id} · event ${event.sequence}`,
      }))
  }, [getProfileColor, selectedEvents, selectedTask?.assignee, selectedTaskId])

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'running' || task.status === 'blocked' || task.status === 'ready'),
    [tasks],
  )

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'done').slice().sort((a, b) =>
      (b.timestamps?.completed_at ?? '').localeCompare(a.timestamps?.completed_at ?? ''),
    ),
    [tasks],
  )

  const panelMeta = (
    <span className="orchestration-panel-meta">
      <span className={`orchestration-connection orchestration-connection--${connectionState}`}>
        <span aria-hidden="true" />
        {connectionState.toUpperCase()} · {agents.length} PROFILES
      </span>
      <button
        type="button"
        className="orchestration-panel-toggle"
        onClick={() => setPanelCollapsed((value) => !value)}
        aria-expanded={!panelCollapsed}
      >
        {panelCollapsed ? 'EXPAND' : 'COLLAPSE'}
      </button>
    </span>
  )

  return (
    <section className="workspace-stage workspace-stage--interactive orchestration-stage orchestration-stage--spatial" aria-label="Orchestration workspace">
      <SpatialStageEnvironment className="orchestration-spatial-environment" />
      <SpatialInteractionCanvas />

      <TimelineHud
        className="brain-timeline-hud orchestration-canonical-timeline"
        eyebrow={selectedTask ? `TASK TRACE · ${selectedTask.id}` : 'TASK TEMPORAL TRACE'}
        title="OPERATIONS TRACE · LIVE"
        markers={timelineMarkers}
      />

      {error && <div className="orchestration-banner orchestration-banner--spatial">{error}</div>}

      <div className={`orchestration-spatial-panel-shell ${panelCollapsed ? 'is-collapsed' : ''}`}>
        <BrainHudPanel title="OPERATIONS" meta={panelMeta} className="orchestration-spatial-panel">
          <div className="orchestration-spatial-panel__body">
            <section className="orchestration-spatial-panel__work" aria-label="Hermes work queue">
              <div className="orchestration-zone__heading orchestration-zone__heading--embedded">
                <span>WORK</span>
                <small>{activeTasks.length} ACTIVE / {completedTasks.length} DONE</small>
              </div>

              <div className="orchestration-task-list orchestration-task-list--embedded">
                <div className="orchestration-section-label">ACTIVE QUEUE</div>
                {activeTasks.length === 0 && <div className="orchestration-empty">No active Hermes tasks.</div>}
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    onSelect={setSelectedTaskId}
                    color={getProfileColor(task.assignee ?? 'default')}
                  />
                ))}

                <div className="orchestration-section-label">RECENTLY COMPLETED</div>
                {completedTasks.slice(0, 8).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    onSelect={setSelectedTaskId}
                    color={getProfileColor(task.assignee ?? 'default')}
                  />
                ))}
              </div>
            </section>

            <section className="orchestration-spatial-panel__detail" aria-label="Selected task inspector">
              <div className="orchestration-inspector orchestration-inspector--embedded">
                {selectedTask ? (
                  <>
                    <div className="orchestration-inspector__topline">
                      <span>{selectedTask.id}</span>
                      <strong className={`task-state task-state--${selectedTask.status}`}>{taskStateLabel(selectedTask.status)}</strong>
                    </div>
                    <h3>{selectedTask.title}</h3>
                    <div className="orchestration-inspector__meta">
                      <span>OWNER <strong>{selectedTask.assignee ?? 'UNASSIGNED'}</strong></span>
                      <span>CREATOR <strong>{selectedTask.created_by ?? 'UNKNOWN'}</strong></span>
                      <span>START <strong>{formatTime(selectedTask.timestamps?.started_at)}</strong></span>
                    </div>
                    {selectedTask.body && <p className="orchestration-inspector__body">{selectedTask.body}</p>}
                    {selectedTask.result && (
                      <div className="orchestration-result">
                        <span>RESULT</span>
                        <p>{selectedTask.result}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="orchestration-empty">Select a task to inspect it.</div>
                )}
              </div>

              <div className="orchestration-activity-inline">
                <div className="orchestration-zone__heading orchestration-zone__heading--embedded">
                  <span>ACTIVITY</span>
                  <small>{selectedTask ? selectedTask.id : 'NO TASK'}</small>
                </div>
                <div className="orchestration-activity__feed orchestration-activity__feed--embedded">
                  {selectedEvents.length === 0 && <div className="orchestration-empty">No task activity selected.</div>}
                  {selectedEvents.slice(0, 8).map((event) => (
                    <article className="orchestration-event" key={`${event.sequence}-${event.kind}`}>
                      <span className="orchestration-event__line" />
                      <div>
                        <div className="orchestration-event__heading">
                          <strong>{event.kind.toUpperCase()}</strong>
                          <time>{formatTime(event.created_at_iso)}</time>
                        </div>
                        <small>{event.run_id == null ? `EVENT ${event.sequence}` : `RUN ${event.run_id} · EVENT ${event.sequence}`}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </BrainHudPanel>
      </div>

      <div className="orchestration-view-controls" aria-label="Future Operations 3D view controls">
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
      </div>

      <div className="brain-scene-help orchestration-scene-help">
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
      </div>
    </section>
  )
}

function TaskCard({ task, selected, onSelect, color }: { task: Task; selected: boolean; onSelect: (id: string) => void; color: string }) {
  return (
    <button
      type="button"
      className={`orchestration-task ${selected ? 'is-selected' : ''}`}
      style={{ '--profile-color': color } as CSSProperties}
      onClick={() => onSelect(task.id)}
    >
      <span className="orchestration-task__accent" />
      <span className="orchestration-task__copy">
        <strong>{task.title}</strong>
        <span>{task.assignee ?? 'unassigned'} · {task.id}</span>
      </span>
      <span className={`task-state task-state--${task.status}`}>{taskStateLabel(task.status)}</span>
    </button>
  )
}
