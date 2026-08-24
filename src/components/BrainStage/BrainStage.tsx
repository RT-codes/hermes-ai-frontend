import type { CSSProperties } from 'react'
import { layoutZoneAttributes } from '../../app/layout/layoutZones'
import { SpatialGraphicsSlot, type SpatialGraphicsMode } from '../../app/spatial/SpatialGraphicsSlot'
import { TimelineHud } from '../TimelineHud/TimelineHud'

type BrainStageProps = {
  graphicsMode?: SpatialGraphicsMode
}

const transitionIndex = (index: number) => ({ '--workspace-transition-index': index } as CSSProperties)

/**
 * Persistent spatial stage for Memory and Operations. Camera/control ownership stays
 * mounted through SpatialGraphicsSlot while workspace-specific graphics and HUD chrome
 * can swap independently. Memory HUD elements declare their named layout-zone owner so
 * the developer overlay and production composition describe the same screen regions.
 */
export function BrainStage({ graphicsMode = 'memory' }: BrainStageProps) {
  const memoryHudVisible = graphicsMode === 'memory'

  return (
    <section
      className={`brain-stage brain-stage--3d spatial-memory-layer is-${graphicsMode}`}
      aria-label="Interactive 3D Hermes spatial workspace"
    >
      <SpatialGraphicsSlot mode={graphicsMode} />

      {memoryHudVisible && (
        <>
          <div className="layout-zone-owner--contents" {...layoutZoneAttributes('top-band', 'memory-timeline')}>
            <TimelineHud
              className="brain-timeline-hud layout-zone-align--top-band workspace-transition-item"
              eyebrow="TEMPORAL LAYER"
              title="BRAIN TRACE · LIVE"
            />
          </div>

          <div
            className="brain-scene-help layout-zone-align--bottom-band workspace-transition-item"
            style={transitionIndex(3)}
            {...layoutZoneAttributes('bottom-band', 'memory-scene-help')}
          >
            <span>DRAG · ORBIT</span>
            <span>RIGHT DRAG · PAN</span>
            <span>WHEEL · ZOOM</span>
            <span>CLICK NODE · HIGHLIGHT</span>
          </div>
        </>
      )}
    </section>
  )
}
