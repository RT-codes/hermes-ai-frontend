import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { useBrainScene } from '../../context/BrainSceneContext'

type Interaction = {
  mode: 'rotate' | 'pan'
  pointerId: number
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function BrainStage() {
  const stageRef = useRef<HTMLElement | null>(null)
  const interaction = useRef<Interaction | null>(null)
  const { setCenterPoint } = useBrainScene()
  const [rotation, setRotation] = useState({ x: -18, y: 32 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

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
    setRotation({ x: -18, y: 32 })
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

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
        <div className="brain-cube">
          <span className="brain-cube__face brain-cube__face--front" />
          <span className="brain-cube__face brain-cube__face--back" />
          <span className="brain-cube__face brain-cube__face--right" />
          <span className="brain-cube__face brain-cube__face--left" />
          <span className="brain-cube__face brain-cube__face--top" />
          <span className="brain-cube__face brain-cube__face--bottom" />
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
