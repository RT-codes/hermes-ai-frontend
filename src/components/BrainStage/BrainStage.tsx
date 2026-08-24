import { useCallback, useState } from 'react'
import { BrainGraph } from '../BrainGraph/BrainGraph'
import { SpatialStageEnvironment, type ViewRotation } from '../SpatialStageEnvironment/SpatialStageEnvironment'
import { TimelineHud } from '../TimelineHud/TimelineHud'

export function BrainStage() {
  const [viewRotation, setViewRotation] = useState<ViewRotation>({ yaw: 0, pitch: 0 })

  const handleViewRotationChange = useCallback((rotation: ViewRotation) => {
    setViewRotation((current) => {
      if (Math.abs(current.yaw - rotation.yaw) < 0.35 && Math.abs(current.pitch - rotation.pitch) < 0.35) return current
      return rotation
    })
  }, [])

  return (
    <section className="brain-stage brain-stage--3d" aria-label="Interactive 3D Hermes memory graph foundation">
      <SpatialStageEnvironment viewRotation={viewRotation} />
      <BrainGraph onViewRotationChange={handleViewRotationChange} />

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
