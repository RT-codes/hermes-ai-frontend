import { useCallback, useEffect, useState } from 'react'
import { useAppearance } from '../../context/AppearanceContext'
import { useBrainScene } from '../../context/BrainSceneContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { BrainGraph } from '../BrainGraph/BrainGraph'

type Axis = 'x' | 'y' | 'z'

type LayerTurn = {
  axis: Axis
  layer: -1 | 0 | 1
  degrees: number
}

type Point = { x: number; y: number }

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
  const { setCenterPoint } = useBrainScene()
  const { settings } = useAppearance()
  const { sessions } = useChatSessions()
  const [turn, setTurn] = useState<LayerTurn | null>(null)
  const [corePoint, setCorePoint] = useState<Point | null>(null)

  const isThinking = sessions.some(
    (session) => session.connectionState === 'connecting' || session.connectionState === 'streaming',
  )

  const handleCorePointChange = useCallback((point: Point) => {
    setCorePoint((current) => {
      if (current && Math.abs(current.x - point.x) < 0.5 && Math.abs(current.y - point.y) < 0.5) return current
      return point
    })

    const stage = document.querySelector<HTMLElement>('.brain-stage--3d')
    const rect = stage?.getBoundingClientRect()
    if (!rect) return
    setCenterPoint({ x: rect.left + point.x, y: rect.top + point.y })
  }, [setCenterPoint])

  useEffect(() => () => setCenterPoint(null), [setCenterPoint])

  useEffect(() => {
    if (!isThinking) {
      setTurn(null)
      return
    }

    let cancelled = false
    let startTimer = 0
    let finishTimer = 0
    let frameOne = 0
    let frameTwo = 0

    const scheduleTurn = () => {
      const pause = 420 + Math.random() * 760

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
        }, settings.rubikTurnSpeedMs + 90)
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

  return (
    <section className="brain-stage brain-stage--3d" aria-label="Interactive 3D Hermes memory graph foundation">
      <div className="brain-scene-grid" aria-hidden="true" />
      <BrainGraph onCorePointChange={handleCorePointChange} />

      <div
        className={`brain-scene-core ${isThinking ? 'is-thinking' : ''}`}
        style={corePoint ? { left: `${corePoint.x}px`, top: `${corePoint.y}px` } : undefined}
        aria-hidden="true"
      >
        <span className={`brain-cube-glow ${isThinking ? 'is-thinking' : ''}`} />

        <div className="brain-scene-core__scale">
          <div className={`brain-cube ${isThinking ? 'is-thinking' : ''}`}>
            {cubieCoordinates.map((layer) => (
              <span
                className="brain-cube-layer"
                key={`${groupingAxis}:${layer}`}
                style={{
                  transform: turnTransform(turn, layer),
                  transitionDuration: `${settings.rubikTurnSpeedMs}ms`,
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

      <div className="brain-scene-help">
        <span>DRAG · ORBIT</span>
        <span>RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
        <span>CLICK NODE · HIGHLIGHT</span>
      </div>
    </section>
  )
}
