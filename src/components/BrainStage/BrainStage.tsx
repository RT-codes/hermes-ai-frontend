import { BrainGraph } from '../BrainGraph/BrainGraph'
import { TimelineHud } from '../TimelineHud/TimelineHud'
import { useSpatialApplicationShell } from '../../app/spatial/SpatialApplicationShell'

/** Memory contributes its graph, timeline and controls to the persistent spatial shell. */
export function BrainStage() {
  const { reportViewRotation } = useSpatialApplicationShell()

  return (
    <section className="brain-stage brain-stage--3d" aria-label="Interactive 3D Hermes memory graph foundation">
      <BrainGraph onViewRotationChange={reportViewRotation} />

      <TimelineHud
        className="brain-timeline-hud"
        eyebrow="TEMPORAL LAYER"
        title="BRAIN TRACE · LIVE"
      />

      <div className="brain-scene-help">
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
        <span>CLICK NODE · HIGHLIGHT</span>
      </div>
    </section>
  )
}
