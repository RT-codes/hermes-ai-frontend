import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { SpatialStageEnvironment, type ViewRotation } from '../../components/SpatialStageEnvironment/SpatialStageEnvironment'
import type { WorkspaceId } from '../workspaces/workspaceModel'

const DEFAULT_VIEW_ROTATION: ViewRotation = { yaw: 0, pitch: 0 }

type SpatialVector = { x: number; y: number; z: number }
export type SpatialCameraPose = {
  position: SpatialVector
  target: SpatialVector
}

type SpatialApplicationShellContextValue = {
  viewRotation: ViewRotation
  reportViewRotation: (rotation: ViewRotation) => void
  saveCameraPose: (workspace: WorkspaceId, pose: SpatialCameraPose) => void
  getCameraPose: (workspace: WorkspaceId) => SpatialCameraPose | null
}

type SpatialApplicationShellProps = {
  children: ReactNode
}

const SpatialApplicationShellContext = createContext<SpatialApplicationShellContextValue | null>(null)

/**
 * Persistent owner for the spatial application's base environment, shared view
 * orientation and named workspace camera poses. Camera implementations may still be
 * separate during migration, but they exchange pose state through this stable contract
 * so the later single-camera shell can adopt the same API without changing workspaces.
 */
export function SpatialApplicationShell({ children }: SpatialApplicationShellProps) {
  const [viewRotation, setViewRotation] = useState<ViewRotation>(DEFAULT_VIEW_ROTATION)
  const cameraPosesRef = useRef<Partial<Record<WorkspaceId, SpatialCameraPose>>>({})

  const reportViewRotation = useCallback((rotation: ViewRotation) => {
    setViewRotation((current) => {
      if (Math.abs(current.yaw - rotation.yaw) < 0.35 && Math.abs(current.pitch - rotation.pitch) < 0.35) return current
      return rotation
    })
  }, [])

  const saveCameraPose = useCallback((workspace: WorkspaceId, pose: SpatialCameraPose) => {
    cameraPosesRef.current[workspace] = {
      position: { ...pose.position },
      target: { ...pose.target },
    }
  }, [])

  const getCameraPose = useCallback((workspace: WorkspaceId) => {
    const pose = cameraPosesRef.current[workspace]
    return pose
      ? { position: { ...pose.position }, target: { ...pose.target } }
      : null
  }, [])

  const value = useMemo(
    () => ({ viewRotation, reportViewRotation, saveCameraPose, getCameraPose }),
    [getCameraPose, reportViewRotation, saveCameraPose, viewRotation],
  )

  return (
    <SpatialApplicationShellContext.Provider value={value}>
      <div className="spatial-application-shell">
        <SpatialStageEnvironment viewRotation={viewRotation} className="spatial-application-shell__environment" />
        <div className="spatial-application-shell__workspace">
          {children}
        </div>
      </div>
    </SpatialApplicationShellContext.Provider>
  )
}

/** Workspace graphics report orientation and camera pose without owning shell state. */
export function useSpatialApplicationShell() {
  const context = useContext(SpatialApplicationShellContext)
  if (!context) throw new Error('useSpatialApplicationShell must be used inside SpatialApplicationShell')
  return context
}
