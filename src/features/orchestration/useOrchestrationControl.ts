import { useCallback, useEffect, useRef, useState } from 'react'
import type { Agent, ConnectionState, Task, TaskEvent } from './types'

const BOARD = 'orchestration-lab'
const API = '/control-api'

export function useOrchestrationControl(selectedTaskId: string | null) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedEvents, setSelectedEvents] = useState<TaskEvent[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const hasSnapshotRef = useRef(false)

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
    hasSnapshotRef.current = true
    setConnectionState('live')
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    refreshSnapshot().catch((reason: unknown) => {
      if (cancelled) return
      setConnectionState('offline')
      setError(reason instanceof Error ? reason.message : 'Control service unavailable')
    })

    return () => {
      cancelled = true
    }
  }, [refreshSnapshot])

  useEffect(() => {
    const source = new EventSource(`${API}/v1/events/stream?board=${BOARD}`)

    source.onopen = () => {
      setConnectionState(hasSnapshotRef.current ? 'live' : 'connecting')
      if (hasSnapshotRef.current) setError(null)
    }

    source.onerror = () => {
      setConnectionState(hasSnapshotRef.current ? 'reconnecting' : 'offline')
    }

    const reconcile = () => {
      void refreshSnapshot().catch((reason: unknown) => {
        setConnectionState(hasSnapshotRef.current ? 'reconnecting' : 'offline')
        setError(reason instanceof Error ? reason.message : 'Snapshot reconciliation failed')
      })
    }

    source.addEventListener('board_snapshot', reconcile)
    source.addEventListener('task_reconcile', reconcile)
    source.addEventListener('task_removed', reconcile)
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
        if (!cancelled) setSelectedEvents(payload.events)
      })
      .catch(() => {
        if (!cancelled) setSelectedEvents([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedTaskId, tasks])

  return {
    agents,
    tasks,
    selectedEvents,
    connectionState,
    error,
    refreshSnapshot,
  }
}
