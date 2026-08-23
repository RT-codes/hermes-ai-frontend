export type Agent = {
  id: string
  name: string
  activity_state: 'working' | 'blocked' | 'unknown' | string
  current_task_id: string | null
  task_counts: Record<string, number>
  gateway_running: boolean | null
  description: string | null
}

export type Task = {
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

export type TaskEvent = {
  sequence: number
  kind: string
  created_at_iso: string | null
  run_id: number | null
  payload: unknown
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export type KanbanPhase = {
  id: string
  label: string
}
