import { type CSSProperties, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

type PanelRect = {
  x: number
  y: number
  width: number
  height: number
}

type FloatingPanelProps = {
  id: string
  title: string
  children: ReactNode
  defaultRect: PanelRect
  minWidth?: number
  minHeight?: number
  className?: string
}

const STORAGE_PREFIX = 'hermes-panel:'

export function FloatingPanel({
  id,
  title,
  children,
  defaultRect,
  minWidth = 220,
  minHeight = 150,
  className = '',
}: FloatingPanelProps) {
  const [rect, setRect] = useState<PanelRect>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${id}`)
    if (!saved) return defaultRect

    try {
      return { ...defaultRect, ...JSON.parse(saved) }
    } catch {
      return defaultRect
    }
  })
  const [zIndex, setZIndex] = useState(10)
  const operation = useRef<{
    type: 'drag' | 'resize'
    startX: number
    startY: number
    startRect: PanelRect
  } | null>(null)

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(rect))
  }, [id, rect])

  useEffect(() => {
    const handleMove = (event: globalThis.PointerEvent) => {
      const active = operation.current
      if (!active) return

      const deltaX = event.clientX - active.startX
      const deltaY = event.clientY - active.startY

      if (active.type === 'drag') {
        const maxX = Math.max(0, window.innerWidth - active.startRect.width)
        const maxY = Math.max(0, window.innerHeight - active.startRect.height)
        setRect((current) => ({
          ...current,
          x: Math.min(maxX, Math.max(0, active.startRect.x + deltaX)),
          y: Math.min(maxY, Math.max(0, active.startRect.y + deltaY)),
        }))
        return
      }

      setRect((current) => ({
        ...current,
        width: Math.max(minWidth, active.startRect.width + deltaX),
        height: Math.max(minHeight, active.startRect.height + deltaY),
      }))
    }

    const handleUp = () => {
      operation.current = null
      document.body.classList.remove('panel-interacting')
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [minHeight, minWidth])

  const startOperation = (event: PointerEvent, type: 'drag' | 'resize') => {
    event.preventDefault()
    event.stopPropagation()
    setZIndex(20)
    operation.current = {
      type,
      startX: event.clientX,
      startY: event.clientY,
      startRect: rect,
    }
    document.body.classList.add('panel-interacting')
  }

  const style = {
    '--panel-x': `${rect.x}px`,
    '--panel-y': `${rect.y}px`,
    '--panel-width': `${rect.width}px`,
    '--panel-height': `${rect.height}px`,
    zIndex,
  } as CSSProperties

  return (
    <section
      className={`floating-panel ${className}`}
      style={style}
      onPointerDown={() => setZIndex(20)}
      onPointerLeave={() => setZIndex(10)}
    >
      <div className="floating-panel__surface" />
      <header className="floating-panel__header" onPointerDown={(event) => startOperation(event, 'drag')}>
        <span className="panel-label">{title}</span>
        <span className="floating-panel__drag-hint">MOVE</span>
      </header>
      <div className="floating-panel__content">{children}</div>
      <button
        className="floating-panel__resize"
        type="button"
        aria-label={`Resize ${title} panel`}
        onPointerDown={(event) => startOperation(event, 'resize')}
      />
    </section>
  )
}
