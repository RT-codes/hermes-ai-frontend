import type { CSSProperties } from 'react'
import type { KanbanPhase, Task } from './types'
import { RoleFilter } from './RoleFilter'

type KanbanBoardProps = {
  phases: KanbanPhase[]
  tasks: Task[]
  allTaskCount: number
  selectedTaskId: string | null
  agents: import('./types').Agent[]
  roleOptions: string[]
  selectedRoles: Set<string>
  getProfileColor: (profileId: string) => string
  onSelectTask: (taskId: string) => void
  onToggleRole: (role: string) => void
  onSelectAllRoles: () => void
  onSelectNoRoles: () => void
}

export function KanbanBoard({
  phases,
  tasks,
  allTaskCount,
  selectedTaskId,
  agents,
  roleOptions,
  selectedRoles,
  getProfileColor,
  onSelectTask,
  onToggleRole,
  onSelectAllRoles,
  onSelectNoRoles,
}: KanbanBoardProps) {
  return (
    <section className="orchestration-kanban" aria-label="Hermes Kanban board">
      <div className="orchestration-kanban__toolbar">
        <div>
          <span>WORK</span>
          <small>{tasks.length} VISIBLE / {allTaskCount} TOTAL</small>
        </div>
        <RoleFilter
          agents={agents}
          roleOptions={roleOptions}
          selectedRoles={selectedRoles}
          getProfileColor={getProfileColor}
          onToggleRole={onToggleRole}
          onSelectAll={onSelectAllRoles}
          onSelectNone={onSelectNoRoles}
        />
      </div>

      <div className="orchestration-kanban__board">
        {phases.map((phase) => {
          const phaseTasks = tasks.filter((task) => task.status === phase.id)
          return (
            <section className={`orchestration-kanban__column orchestration-kanban__column--${phase.id}`} key={phase.id}>
              <header>
                <span>{phase.label}</span>
                <small>{phaseTasks.length}</small>
              </header>
              <div className="orchestration-kanban__cards">
                {phaseTasks.length === 0 && <div className="orchestration-kanban__empty">NO TASKS</div>}
                {phaseTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    onSelect={onSelectTask}
                    color={getProfileColor(task.assignee ?? 'default')}
                  />
                ))}
              </div>
            </section>
          )
        })}
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
      <span className={`task-state task-state--${task.status}`}>{task.status === 'running' ? 'WORKING' : task.status.toUpperCase()}</span>
    </button>
  )
}
