import type { Task, TaskEvent } from './types'

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type TaskInspectorProps = {
  task: Task | null
  events: TaskEvent[]
  hiddenByFilter: boolean
}

export function TaskInspector({ task, events, hiddenByFilter }: TaskInspectorProps) {
  return (
    <section className="orchestration-task-detail" aria-label="Selected task inspector">
      <div className="orchestration-inspector orchestration-inspector--embedded">
        {task ? (
          <>
            {hiddenByFilter && (
              <div className="orchestration-empty">SELECTED TASK IS HIDDEN BY THE CURRENT ROLE FILTER</div>
            )}
            <div className="orchestration-inspector__topline">
              <span>{task.id}</span>
              <strong className={`task-state task-state--${task.status}`}>{task.status === 'running' ? 'WORKING' : task.status.toUpperCase()}</strong>
            </div>
            <h3>{task.title}</h3>
            <div className="orchestration-inspector__meta">
              <span>OWNER <strong>{task.assignee ?? 'UNASSIGNED'}</strong></span>
              <span>CREATOR <strong>{task.created_by ?? 'UNKNOWN'}</strong></span>
              <span>START <strong>{formatTime(task.timestamps?.started_at)}</strong></span>
            </div>
            {task.body && <p className="orchestration-inspector__body">{task.body}</p>}
            {task.result && (
              <div className="orchestration-result">
                <span>RESULT</span>
                <p>{task.result}</p>
              </div>
            )}
          </>
        ) : (
          <div className="orchestration-empty">Select a task to inspect it.</div>
        )}
      </div>

      <div className="orchestration-activity-inline orchestration-activity-inline--detail">
        <div className="orchestration-zone__heading orchestration-zone__heading--embedded">
          <span>ACTIVITY</span>
          <small>{task ? task.id : 'NO TASK'}</small>
        </div>
        <div className="orchestration-activity__feed orchestration-activity__feed--embedded">
          {events.length === 0 && <div className="orchestration-empty">No task activity selected.</div>}
          {events.slice(0, 12).map((event) => (
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
  )
}
