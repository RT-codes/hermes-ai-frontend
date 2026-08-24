import { BrainGraph } from '../../components/BrainGraph/BrainGraph'
import { useSpatialApplicationShell } from './SpatialApplicationShell'
import { OperationsSpatialGraphics } from './OperationsSpatialGraphics'

export type SpatialGraphicsMode = 'memory' | 'operations'

type SpatialGraphicsSlotProps = {
  mode: SpatialGraphicsMode
}

/**
 * Persistent spatial graphics boundary. BrainGraph remains mounted as the single
 * renderer/camera/control owner and keeps the shared Three.js world (including the
 * real ground plane) alive across workspace swaps. Only its Memory payload is toggled.
 * Operations can add workspace-specific graphics beside that shared world without
 * introducing a second camera or changing spatial scale/orientation.
 */
export function SpatialGraphicsSlot({ mode }: SpatialGraphicsSlotProps) {
  const { reportViewRotation } = useSpatialApplicationShell()
  const memoryVisible = mode === 'memory'

  return (
    <div className="spatial-graphics-slot" data-spatial-graphics={mode}>
      <div className="spatial-graphics-slot__memory" aria-hidden={!memoryVisible}>
        <BrainGraph
          memoryGraphicsVisible={memoryVisible}
          onViewRotationChange={reportViewRotation}
        />
      </div>
      <div className="spatial-graphics-slot__operations" aria-hidden={mode !== 'operations'}>
        <OperationsSpatialGraphics active={mode === 'operations'} />
      </div>
    </div>
  )
}
