import { useCallback, useEffect, useState } from 'react'
import { useAppearance } from '../../context/AppearanceContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { BrainGraph } from '../BrainGraph/BrainGraph'
import { SpatialStageBackdrop } from '../SpatialStageBackdrop/SpatialStageBackdrop'
import { TimelineHud } from '../TimelineHud/TimelineHud'

type Axis = 'x' | 'y' | 'z'

type LayerTurn = {
  axis: Axis
  layer: -1 | 0 | 1
  degrees: number
}

type ViewRotation = { yaw: number; pitch: number }

const cubieCoordinates = [-1, 0, 1] as const
const axes: Axis[] = ['x', 'y', 'z']

function coordinateForAxis(axis: Axis, x: number, y: number, z: number) {
  if (axis === 'x') return x
  if (axis === 'y') return y
  return z
}

function turnTransform(turn: LayerTurn | null, layer: number) {
  if (!turn || turn.layer !== layer) return 'none'
  if (turn.axis === 'x') return `rotateX(${turn.degrees}deg)`
  if (turn.axis === 'y') return `rotateY(${turn.degrees}deg)`
  return `rotateZ(${turn.degrees}deg)`
}

export function BrainStage() {
  const { settings } = useAppearance()
  const { sessions } = useChatSessions()
  const [turn, setTurn] = useState<LayerTurn | null>(null)
  const [viewRotation, setViewRotation] = useState<ViewRotation>({ yaw: 0, pitch: 0 })

  const isThinking = sessions.some(
    (session) => session.connectionState === 'connecting' || session.connectionState === 'streaming',
  )

  const handleViewRotationChange = useCallback((rotation: ViewRotation) => {
    setViewRotation((current) => {
      if (Math.abs(current.yaw - rotation.yaw) < 0.35 && Math.abs(current.pitch - rotation.pitch) < 0.35) return current
      return rotation
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    let startTimer = 0
    let finishTimer = 0
    let frameOne = 0
    let frameTwo = 0

    const scheduleTurn = () => {
      const activeSpeed = isThinking ? settings.rubikTurnSpeedMs : settings.rubikTurnSpeedMs * 3
      const pause = isThinking
        ? 360 + Math.random() * 620
        : 1100 + Math.random() * 1700

      startTimer = window.setTimeout(() => {
        if (cancelled) return

        const axis = axes[Math.floor(Math.random() * axes.length)]
        const layer = cubieCoordinates[Math.floor(Math.random() * cubieCoordinates.length)]
        const targetDegrees = Math.random() > 0.5 ? 90 : -90
        const nextTurn: LayerTurn = { axis, layer, degrees: 0 }

        setTurn(nextTurn)
        frameOne = window.requestAnimationFrame(() => {
          frameTwo = window.requestAnimationFrame(() => {
            if (!cancelled) setTurn({ ...nextTurn, degrees: targetDegrees })
          })
        })

        finishTimer = window.setTimeout(() => {
          if (cancelled) return
          setTurn(null)
          scheduleTurn()
        }, activeSpeed + 100)
      }, pause)
    }

    scheduleTurn()

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      window.clearTimeout(finishTimer)
      window.cancelAnimationFrame(frameOne)
      window.cancelAnimationFrame(frameTwo)
    }
  }, [isThinking, settings.rubikTurnSpeedMs])

  const groupingAxis = turn?.axis ?? 'z'
  const activeTurnSpeed = isThinking ? settings.rubikTurnSpeedMs : settings.rubikTurnSpeedMs * 3
  const cubeViewTransform = `rotateX(${-24 - viewRotation.pitch * 0.72}deg) rotateY(${38 + viewRotation.yaw}deg)`

  return (
    <section className="brain-stage brain-stage--3d" aria-label="Interactive 3D Hermes memory graph foundation">
      <SpatialStageBackdrop />
      <BrainGraph onViewRotationChange={handleViewRotationChange} />

      <div className={`brain-scene-core ${isThinking ? 'is-thinking' : 'is-idle'}`} aria-hidden="true">
        <span className={`brain-cube-glow ${isThinking ? 'is-thinking' : 'is-idle'}`} />

        <div className="brain-scene-core__scale">
          <div className={`brain-cube ${isThinking ? 'is-thinking' : 'is-idle'}`} style={{ transform: cubeViewTransform }}>
            {cubieCoordinates.map((layer) => (
              <span
                className="brain-cube-layer"
                key={`${groupingAxis}:${layer}`}
                style={{
                  transform: turnTransform(turn, layer),
                  transitionDuration: `${activeTurnSpeed}ms`,
                }}
              >
                {cubieCoordinates.flatMap((z) =>
                  cubieCoordinates.flatMap((y) =>
                    cubieCoordinates
                      .filter((x) => coordinateForAxis(groupingAxis, x, y, z) === layer)
                      .map((x) => (
                        <span
                          className="brain-cubie"
                          key={`${x}:${y}:${z}`}
                          style={{ transform: `translate3d(${x * 38}px, ${y * 38}px, ${z * 38}px)` }}
                        >
                          <i className="brain-cubie__face brain-cubie__face--front" />
                          <i className="brain-cubie__face brain-cubie__face--back" />
                          <i className="brain-cubie__face brain-cubie__face--right" />
                          <i className="brain-cubie__face brain-cubie__face--left" />
                          <i className="brain-cubie__face brain-cubie__face--top" />
                          <i className="brain-cubie__face brain-cubie__face--bottom" />
                        </span>
                      )),
                  ),
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

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
