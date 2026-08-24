import type { CSSProperties, ReactNode } from 'react'
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

const transitionIndex = (index: number) => ({ '--workspace-transition-index': index } as CSSProperties)

/**
 * Operations is now a HUD/data layer above the persistent spatial camera owned by
 * Memory's ForceGraph during this migration step. No second WebGL camera is mounted;
 * uncovered background interaction falls through to the shared camera surface.
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
      <TimelineHud
        className="brain-timeline-hud orchestration-canonical-timeline workspace-transition-item"
        eyebrow={selectedTask ? `TASK TRACE · ${selectedTask.id}` : 'TASK TEMPORAL TRACE'}
        title="OPERATIONS TRACE · LIVE"
        markers={timelineMarkers}
      />

      {error && (
        <div className="orchestration-banner orchestration-banner--spatial workspace-transition-item" style={transitionIndex(1)}>
          {error}
        </div>
      )}

      <div
        className={`orchestration-spatial-panel-shell workspace-transition-item ${panelCollapsed ? 'is-collapsed' : ''}`}
        style={transitionIndex(2)}
      >
        <HudPanel title="OPERATIONS" meta={panelMeta} className="orchestration-spatial-panel">
          {children}
        </HudPanel>
      </div>

      <div className="orchestration-view-controls workspace-transition-item" style={transitionIndex(3)} aria-label="Future Operations 3D view controls">
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
      </div>

      <div className="brain-scene-help orchestration-scene-help workspace-transition-item" style={transitionIndex(3)}>
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
      </div>
    </section>
  )
}
