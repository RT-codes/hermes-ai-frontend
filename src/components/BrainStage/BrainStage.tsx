import type { CSSProperties } from 'react'
import { BrainGraph } from '../BrainGraph/BrainGraph'
import { TimelineHud } from '../TimelineHud/TimelineHud'
import { useSpatialApplicationShell } from '../../app/spatial/SpatialApplicationShell'

type BrainStageProps = {
  graphicsVisible?: boolean
}

const transitionIndex = (index: number) => ({ '--workspace-transition-index': index } as CSSProperties)

/**
 * Persistent Memory graphics/camera layer. Graph, timeline and scene help remain
 * mounted across spatial workspace swaps so they can animate out without destroying
 * the ForceGraph camera/control instance. Camera-only mode disables Memory UI while
 * leaving the shared interaction surface alive for the next workspace.
 */
export function BrainStage({ graphicsVisible = true }: BrainStageProps) {
  const { reportViewRotation } = useSpatialApplicationShell()

  return (
    <section
      className={`brain-stage brain-stage--3d spatial-memory-layer ${graphicsVisible ? 'is-visible' : 'is-camera-only'}`}
      aria-label="Interactive 3D Hermes memory graph foundation"
      aria-hidden={!graphicsVisible}
    >
      <div className="spatial-memory-layer__graph workspace-transition-item" style={transitionIndex(0)}>
        <BrainGraph onViewRotationChange={reportViewRotation} />
      </div>

      <TimelineHud
        className="brain-timeline-hud workspace-transition-item"
        eyebrow="TEMPORAL LAYER"
        title="BRAIN TRACE · LIVE"
      />

      <div className="brain-scene-help workspace-transition-item" style={transitionIndex(3)}>
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
        <span>CLICK NODE · HIGHLIGHT</span>
      </div>
    </section>
  )
}
