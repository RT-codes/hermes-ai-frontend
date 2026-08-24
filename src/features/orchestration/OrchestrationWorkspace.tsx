import { useEffect, useMemo, useRef, useState } from 'react'
import type { TimelineMarker } from '../../components/TimelineHud/TimelineHud'
import { useHermesProfiles } from '../../context/HermesProfileContext'
import { KanbanBoard } from './KanbanBoard'
import { OperationsSpatialShell } from './OperationsSpatialShell'
import { UNASSIGNED } from './RoleFilter'
import { TaskInspector } from './TaskInspector'
import type { KanbanPhase, TaskEvent } from './types'
import { useOrchestrationControl } from './useOrchestrationControl'

const KANBAN_PHASES: KanbanPhase[] = [
  { id: 'triage', label: 'TRIAGE' },
  { id: 'todo', label: 'TODO' },
  { id: 'ready', label: 'READY' },
  { id: 'running', label: 'RUNNING' },
  { id: 'blocked', label: 'BLOCKED' },
  { id: 'review', label: 'REVIEW' },
  { id: 'done', label: 'DONE' },
]

function eventTone(kind: string): TimelineMarker['tone'] {
  if (kind === 'completed') return 'success'
  if (kind === 'blocked' || kind === 'failed' || kind === 'timeout') return 'danger'
  if (kind === 'claimed' || kind === 'spawned') return 'accent'
  if (kind === 'heartbeat') return 'default'
  return 'warning'
}

export function OrchestrationWorkspace() {
  const { getProfileColor } = useHermesProfiles()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const roleFilterInitialized = useRef(false)
  const previousRoleOptions = useRef<string[]>([])

  const {
    agents,
    tasks,
    selectedEvents,
    connectionState,
    error,
  } = useOrchestrationControl(selectedTaskId)

  const roleOptions = useMemo(() => {
    const names = new Set<string>()
    agents.forEach((agent) => names.add(agent.id || agent.name))
    tasks.forEach((task) => {
      if (task.assignee) names.add(task.assignee)
    })

    const options = [...names].sort((a, b) => a.localeCompare(b))
    if (tasks.some((task) => !task.assignee)) options.push(UNASSIGNED)
    return options
  }, [agents, tasks])

  useEffect(() => {
    if (roleOptions.length === 0) return

    if (!roleFilterInitialized.current) {
      setSelectedRoles(new Set(roleOptions))
      previousRoleOptions.current = roleOptions
      roleFilterInitialized.current = true
      return
    }

    setSelectedRoles((current) => {
      const previous = previousRoleOptions.current
      const previouslySelectedAll = previous.length > 0 && previous.every((role) => current.has(role))
      const available = new Set(roleOptions)
      const next = new Set([...current].filter((role) => available.has(role)))

      if (previouslySelectedAll) roleOptions.forEach((role) => next.add(role))
      return next
    })
    previousRoleOptions.current = roleOptions
  }, [roleOptions])

  const filteredTasks = useMemo(() => {
    if (!roleFilterInitialized.current || selectedRoles.size === 0) return []
    return tasks.filter((task) => selectedRoles.has(task.assignee ?? UNASSIGNED))
  }, [selectedRoles, tasks])

  useEffect(() => {
    if (tasks.length === 0) {
      if (selectedTaskId !== null) setSelectedTaskId(null)
      return
    }

    if (selectedTaskId && tasks.some((task) => task.id === selectedTaskId)) return
    setSelectedTaskId(filteredTasks[0]?.id ?? tasks[0]?.id ?? null)
  }, [filteredTasks, selectedTaskId, tasks])

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  )

  const selectedTaskHiddenByFilter = Boolean(
    selectedTask && !filteredTasks.some((task) => task.id === selectedTask.id),
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

  const unknownStatuses = useMemo(() => {
    const known = new Set(KANBAN_PHASES.map((phase) => phase.id))
    return [...new Set(filteredTasks.map((task) => task.status).filter((status) => !known.has(status)))].sort()
  }, [filteredTasks])

  const boardPhases = useMemo<KanbanPhase[]>(() => [
    ...KANBAN_PHASES,
    ...unknownStatuses.map((status) => ({ id: status, label: status.toUpperCase() })),
  ], [unknownStatuses])

  const toggleRole = (role: string) => {
    setSelectedRoles((current) => {
      const next = new Set(current)
      if (next.has(role)) next.delete(role)
      else next.add(role)
      return next
    })
  }

  return (
    <OperationsSpatialShell
      selectedTask={selectedTask}
      timelineMarkers={timelineMarkers}
      connectionState={connectionState}
      profileCount={agents.length}
      error={error}
      panelCollapsed={panelCollapsed}
      onTogglePanel={() => setPanelCollapsed((value) => !value)}
    >
      <div className="orchestration-spatial-panel__body orchestration-spatial-panel__body--kanban">
        <KanbanBoard
          phases={boardPhases}
          tasks={filteredTasks}
          allTaskCount={tasks.length}
          selectedTaskId={selectedTaskId}
          agents={agents}
          roleOptions={roleOptions}
          selectedRoles={selectedRoles}
          getProfileColor={getProfileColor}
          onSelectTask={setSelectedTaskId}
          onToggleRole={toggleRole}
          onSelectAllRoles={() => setSelectedRoles(new Set(roleOptions))}
          onSelectNoRoles={() => setSelectedRoles(new Set())}
        />
        <TaskInspector
          task={selectedTask}
          events={selectedEvents}
          hiddenByFilter={selectedTaskHiddenByFilter}
        />
      </div>
    </OperationsSpatialShell>
  )
}
