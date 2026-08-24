import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { normalizeWorkspaceId, type WorkspaceId } from './workspaceModel'

const ACTIVE_WORKSPACE_STORAGE_KEY = 'hermes-active-workspace:v1'

type WorkspaceContextValue = {
  activeWorkspace: WorkspaceId
  setActiveWorkspace: (workspace: WorkspaceId) => void
  openWorkspace: (workspace: WorkspaceId) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/**
 * Reads browser resume state at the application boundary. Historical values are
 * normalized once here so the rest of the frontend only deals in canonical IDs.
 */
function readInitialWorkspace(): WorkspaceId {
  try {
    return normalizeWorkspaceId(window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY))
  } catch {
    return 'memory'
  }
}

/**
 * Owns application-level workspace identity and resume behavior. Workspace-local
 * selection/camera/filter state deliberately remains outside this provider so this
 * controller stays small enough to become the stable semantic navigation boundary.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>(readInitialWorkspace)

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, activeWorkspace)
    } catch {
      // Navigation must remain functional when browser storage is unavailable.
    }
  }, [activeWorkspace])

  const value = useMemo<WorkspaceContextValue>(() => ({
    activeWorkspace,
    setActiveWorkspace,
    openWorkspace: setActiveWorkspace,
  }), [activeWorkspace])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

/** Exposes the canonical workspace controller to shells and future semantic actions. */
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return context
}
