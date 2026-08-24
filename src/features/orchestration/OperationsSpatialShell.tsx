import type { ReactNode } from 'react'
import { SpatialInteractionCanvas } from '../../components/SpatialInteractionCanvas/SpatialInteractionCanvas'
import { TimelineHud, type TimelineMarker } from '../../components/TimelineHud/TimelineHud'
import { HudPanel } from '../../ui/components/HudPanel/HudPanel'
import type { ConnectionState, Task } from './types'

type OperationsSpatialShellProps = {
  selectedTask: Task | null
  timelineMarkers: TimelineMarker[]
  connectionState: ConnectionState
  profileCount: number
  error: string | null
  panelCollapsed: boolean
  onTogglePanel: () => void
  children: ReactNode
}

/**
 * Operations contributes its interaction/data/HUD layers above the persistent
 * application environment. FCP.5 will replace the remaining Operations-specific
 * WebGL camera with the shared spatial control contract.
 */
export function OperationsSpatialShell({
  selectedTask,
  timelineMarkers,
  connectionState,
  profileCount,
  error,
  panelCollapsed,
  onTogglePanel,
  children,
}: OperationsSpatialShellProps) {
  const panelMeta = (
    <span className="orchestration-panel-meta">
      <span className={`orchestration-connection orchestration-connection--${connectionState}`}>
        <span aria-hidden="true" />
        {connectionState.toUpperCase()} · {profileCount} PROFILES
      </span>
      <button
        type="button"
        className="orchestration-panel-toggle"
        onClick={onTogglePanel}
        aria-expanded={!panelCollapsed}
      >
        {panelCollapsed ? 'EXPAND' : 'COLLAPSE'}
      </button>
    </span>
  )

  return (
    <section className="workspace-stage workspace-stage--interactive orchestration-stage orchestration-stage--spatial" aria-label="Orchestration workspace">
      <SpatialInteractionCanvas />

      <TimelineHud
        className="brain-timeline-hud orchestration-canonical-timeline"
        eyebrow={selectedTask ? `TASK TRACE · ${selectedTask.id}` : 'TASK TEMPORAL TRACE'}
        title="OPERATIONS TRACE · LIVE"
        markers={timelineMarkers}
      />

      {error && <div className="orchestration-banner orchestration-banner--spatial">{error}</div>}

      <div className={`orchestration-spatial-panel-shell ${panelCollapsed ? 'is-collapsed' : ''}`}>
        <HudPanel title="OPERATIONS" meta={panelMeta} className="orchestration-spatial-panel">
          {children}
        </HudPanel>
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
