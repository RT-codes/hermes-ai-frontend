type OperationsSpatialGraphicsProps = {
  active: boolean
}

/**
 * Operations owns a spatial graphics slot, but it deliberately does not own a
 * renderer/camera yet. The persistent Memory ForceGraph remains the sole camera,
 * target and navigation-control authority across Memory <-> Operations, which keeps
 * FOV, distance, pivot and orientation identical during the workspace handoff.
 *
 * Future Operations 3D objects should be attached to that shared renderer/scene
 * contract instead of introducing another camera. Until that extraction lands, the
 * Operations payload stays intentionally empty and the shared stage environment is
 * the only visible spatial reference.
 */
export function OperationsSpatialGraphics({ active }: OperationsSpatialGraphicsProps) {
  return (
    <div
      className="operations-spatial-graphics"
      data-active={active ? 'true' : 'false'}
      aria-hidden={!active}
    />
  )
}
