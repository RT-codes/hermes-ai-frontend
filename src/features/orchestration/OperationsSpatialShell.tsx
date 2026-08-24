import type { CSSProperties, ReactNode } from 'react'
import { layoutZoneAttributes } from '../../app/layout/layoutZones'
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
 * Operations is a workspace HUD/data layer above the persistent shared 3D camera.
 * Named layout-zone ownership is explicit here so future semantic UI actions target
 * stable regions instead of incidental pixel positions.
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
      <div className="layout-zone-owner--contents" {...layoutZoneAttributes('top-band', 'operations-timeline')}>
        <TimelineHud
          className="brain-timeline-hud orchestration-canonical-timeline layout-zone-align--top-band workspace-transition-item"
          eyebrow={selectedTask ? `TASK TRACE · ${selectedTask.id}` : 'TASK TEMPORAL TRACE'}
          title="OPERATIONS TRACE · LIVE"
          markers={timelineMarkers}
        />
      </div>

      {error && (
        <div
          className="orchestration-banner orchestration-banner--spatial workspace-transition-item"
          style={transitionIndex(1)}
          {...layoutZoneAttributes('floating-layer', 'operations-error-banner')}
        >
          {error}
        </div>
      )}

      <div
        className={`orchestration-spatial-panel-shell workspace-transition-item ${panelCollapsed ? 'is-collapsed' : ''}`}
        style={transitionIndex(2)}
        {...layoutZoneAttributes('center-stage', 'operations-work-panel')}
      >
        <HudPanel title="OPERATIONS" meta={panelMeta} className="orchestration-spatial-panel">
          {children}
        </HudPanel>
      </div>

      <div
        className="orchestration-view-controls layout-zone-align--bottom-band workspace-transition-item"
        style={transitionIndex(3)}
        aria-label="Future Operations 3D view controls"
        {...layoutZoneAttributes('bottom-band', 'operations-view-controls')}
      >
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
        <button type="button" disabled>PLACEHOLDER VIEW BUTTON</button>
      </div>

      <div
        className="brain-scene-help orchestration-scene-help layout-zone-align--bottom-band workspace-transition-item"
        style={transitionIndex(3)}
        {...layoutZoneAttributes('bottom-band', 'operations-scene-help')}
      >
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
      </div>
    </section>
  )
}
