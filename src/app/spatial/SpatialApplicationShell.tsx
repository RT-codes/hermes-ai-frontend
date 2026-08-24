import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { SpatialStageEnvironment, type ViewRotation } from '../../components/SpatialStageEnvironment/SpatialStageEnvironment'

const DEFAULT_VIEW_ROTATION: ViewRotation = { yaw: 0, pitch: 0 }

type SpatialApplicationShellContextValue = {
  viewRotation: ViewRotation
  reportViewRotation: (rotation: ViewRotation) => void
}

type SpatialApplicationShellProps = {
  children: ReactNode
}

const SpatialApplicationShellContext = createContext<SpatialApplicationShellContextValue | null>(null)

/**
 * Persistent owner for the spatial application's base environment and shared view
 * orientation. Workspace graphics/HUD layers can mount and unmount above this shell
 * without restarting the visual environment that makes the app feel like one place.
 *
 * Camera/interaction ownership is intentionally not faked here: Memory and Operations
 * still have separate WebGL canvases until the next migration slice moves them onto one
 * spatial control contract.
 */
export function SpatialApplicationShell({ children }: SpatialApplicationShellProps) {
  const [viewRotation, setViewRotation] = useState<ViewRotation>(DEFAULT_VIEW_ROTATION)

  const reportViewRotation = useCallback((rotation: ViewRotation) => {
    setViewRotation((current) => {
      if (Math.abs(current.yaw - rotation.yaw) < 0.35 && Math.abs(current.pitch - rotation.pitch) < 0.35) return current
      return rotation
    })
  }, [])

  const value = useMemo(
    () => ({ viewRotation, reportViewRotation }),
    [reportViewRotation, viewRotation],
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

/** Workspace graphics report spatial orientation here instead of owning the base environment. */
export function useSpatialApplicationShell() {
  const context = useContext(SpatialApplicationShellContext)
  if (!context) throw new Error('useSpatialApplicationShell must be used inside SpatialApplicationShell')
  return context
}
