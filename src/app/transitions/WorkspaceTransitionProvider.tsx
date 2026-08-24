import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppearance } from '../../context/AppearanceContext'
import { useWorkspace } from '../workspaces/WorkspaceProvider'
import type { WorkspaceId } from '../workspaces/workspaceModel'

type WorkspaceTransitionPhase = 'idle' | 'exiting' | 'entering'

type WorkspaceTransitionContextValue = {
  requestedWorkspace: WorkspaceId
  displayWorkspace: WorkspaceId
  phase: WorkspaceTransitionPhase
}

const WorkspaceTransitionContext = createContext<WorkspaceTransitionContextValue | null>(null)

/**
 * Owns the visual hand-off between workspaces. Navigation state changes immediately,
 * while rendered workspace content gets a bounded exit -> swap -> enter sequence.
 * Keeping this policy here lets every workspace share timings without owning timers.
 */
export function WorkspaceTransitionProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace()
  const { settings } = useAppearance()
  const [displayWorkspace, setDisplayWorkspace] = useState<WorkspaceId>(activeWorkspace)
  const [phase, setPhase] = useState<WorkspaceTransitionPhase>('idle')
  const displayWorkspaceRef = useRef<WorkspaceId>(activeWorkspace)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    if (activeWorkspace === displayWorkspaceRef.current) return

    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []

    const targetWorkspace = activeWorkspace
    const total = Math.max(160, settings.viewTransitionDurationMs)
    const exitDuration = Math.max(80, Math.round(total * 0.42))

    setPhase('exiting')
    timersRef.current.push(window.setTimeout(() => {
      displayWorkspaceRef.current = targetWorkspace
      setDisplayWorkspace(targetWorkspace)
      setPhase('entering')
    }, exitDuration))
    timersRef.current.push(window.setTimeout(() => {
      setPhase('idle')
    }, total))

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }
  }, [activeWorkspace, settings.viewTransitionDurationMs])

  const value = useMemo(() => ({
    requestedWorkspace: activeWorkspace,
    displayWorkspace,
    phase,
  }), [activeWorkspace, displayWorkspace, phase])

  return (
    <WorkspaceTransitionContext.Provider value={value}>
      {children}
    </WorkspaceTransitionContext.Provider>
  )
}

export function useWorkspaceTransition() {
  const context = useContext(WorkspaceTransitionContext)
  if (!context) throw new Error('useWorkspaceTransition must be used inside WorkspaceTransitionProvider')
  return context
}
