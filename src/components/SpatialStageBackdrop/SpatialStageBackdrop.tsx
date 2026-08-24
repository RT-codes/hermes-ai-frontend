type SpatialStageBackdropProps = {
  className?: string
}

export function SpatialStageBackdrop({ className = '' }: SpatialStageBackdropProps) {
  return (
    <div className={`spatial-stage-backdrop ${className}`} aria-hidden="true">
      <span className="spatial-stage-backdrop__haze" />
      <span className="spatial-stage-backdrop__grid" />
      <span className="spatial-stage-backdrop__floor" />
    </div>
  )
}
