import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { useAppearance } from '../../context/AppearanceContext'
import { useBrainScene } from '../../context/BrainSceneContext'
import { useChatSessions } from '../../context/ChatSessionsContext'

type Interaction = {
  mode: 'rotate' | 'pan'
  pointerId: number
  x: number
  y: number
}

type Axis = 'x' | 'y' | 'z'

type LayerTurn = {
  axis: Axis
  layer: -1 | 0 | 1
  degrees: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
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
  const stageRef = useRef<HTMLElement | null>(null)
  const interaction = useRef<Interaction | null>(null)
  const { setCenterPoint } = useBrainScene()
  const { settings } = useAppearance()
  const { sessions } = useChatSessions()
  const [rotation, setRotation] = useState({ x: -24, y: 38 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [turn, setTurn] = useState<LayerTurn | null>(null)

  const isThinking = sessions.some(
    (session) => session.connectionState === 'connecting' || session.connectionState === 'streaming',
  )

  const publishCenter = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    setCenterPoint({
      x: rect.left + rect.width / 2 + pan.x,
      y: rect.top + rect.height / 2 + pan.y,
    })
  }, [pan.x, pan.y, setCenterPoint])

  useEffect(() => {
    publishCenter()
    window.addEventListener('resize', publishCenter)
    return () => {
      window.removeEventListener('resize', publishCenter)
      setCenterPoint(null)
    }
  }, [publishCenter, setCenterPoint])

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

        // Two frames ensure the browser paints the 0deg layer before transitioning
        // it to a quarter turn.
        frameOne = window.requestAnimationFrame(() => {
          frameTwo = window.requestAnimationFrame(() => {
            if (!cancelled) setTurn({ ...nextTurn, degrees: targetDegrees })
          })
        })

        finishTimer = window.setTimeout(() => {
          if (cancelled) return
          // The cubies are visually identical wireframes. After a 90-degree turn,
          // returning the layer transform to its canonical grouping is visually
          // continuous while keeping the scaffold state intentionally lightweight.
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

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    const mode = event.shiftKey || event.button === 1 || event.button === 2 ? 'pan' : 'rotate'
    interaction.current = { mode, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const active = interaction.current
    if (!active || active.pointerId !== event.pointerId) return

    const dx = event.clientX - active.x
    const dy = event.clientY - active.y
    active.x = event.clientX
    active.y = event.clientY

    if (active.mode === 'pan') {
      setPan((current) => ({ x: current.x + dx, y: current.y + dy }))
      return
    }

    setRotation((current) => ({
      x: clamp(current.x - dy * 0.35, -80, 80),
      y: current.y + dx * 0.45,
    }))
  }

  function endInteraction(event: PointerEvent<HTMLElement>) {
    if (interaction.current?.pointerId === event.pointerId) interaction.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleWheel(event: WheelEvent<HTMLElement>) {
    event.preventDefault()
    setZoom((current) => clamp(current - event.deltaY * 0.001, 0.65, 1.7))
  }

  function resetView() {
    setRotation({ x: -24, y: 38 })
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  const groupingAxis = turn?.axis ?? 'z'

  return (
    <section
      ref={stageRef}
      className="brain-stage brain-stage--3d"
      aria-label="Interactive 3D brain workspace scaffold"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onWheel={handleWheel}
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={resetView}
    >
      <div className="brain-scene-grid" aria-hidden="true" />

      <div
        className="brain-scene-object"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
        aria-hidden="true"
      >
        <span className={`brain-cube-glow ${isThinking ? 'is-thinking' : ''}`} />

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

      <div className="brain-scene-help">
        <span>DRAG · ROTATE</span>
        <span>SHIFT / RIGHT DRAG · PAN</span>
        <span>WHEEL · ZOOM</span>
        <span>DOUBLE CLICK · RESET</span>
      </div>
    </section>
  )
}
