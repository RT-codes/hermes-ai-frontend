import { BrainGraph } from '../../components/BrainGraph/BrainGraph'
import { useSpatialApplicationShell } from './SpatialApplicationShell'
import { OperationsSpatialGraphics } from './OperationsSpatialGraphics'

export type SpatialGraphicsMode = 'memory' | 'operations'

type SpatialGraphicsSlotProps = {
  mode: SpatialGraphicsMode
}

/**
 * Persistent spatial graphics boundary. The Memory ForceGraph remains mounted because
 * it currently owns the canonical camera/control instance, but its rendered payload is
 * treated as one workspace graphics layer rather than as the spatial shell itself.
 * Operations renders through a separate graphics layer in the same shell while the
 * hidden Memory layer continues to provide the shared camera interaction surface.
 */
export function SpatialGraphicsSlot({ mode }: SpatialGraphicsSlotProps) {
  const { reportViewRotation } = useSpatialApplicationShell()

  return (
    <div className="spatial-graphics-slot" data-spatial-graphics={mode}>
      <div className="spatial-graphics-slot__memory" aria-hidden={mode !== 'memory'}>
        <BrainGraph onViewRotationChange={reportViewRotation} />
      </div>
      <div className="spatial-graphics-slot__operations" aria-hidden={mode !== 'operations'}>
        <OperationsSpatialGraphics active={mode === 'operations'} />
      </div>
    </div>
  )
}
