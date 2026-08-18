import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBrainScene } from '../../context/BrainSceneContext'

type Point = { x: number; y: number }

type BrainHudPanelProps = {
  title: string
  meta?: ReactNode
  className?: string
  children: ReactNode
  ariaLabel?: string
}

const MAX_CONNECTOR_LENGTH = 150

export function BrainHudPanel({ title, meta, className = '', children, ariaLabel }: BrainHudPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const { centerPoint } = useBrainScene()
  const [startPoint, setStartPoint] = useState<Point | null>(null)

  const measure = () => {
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    const panelCenterX = rect.left + rect.width * 0.5
    const next = {
      x: centerPoint && centerPoint.x > panelCenterX ? rect.right : rect.left,
      y: rect.top + rect.height * 0.5,
    }

    setStartPoint((current) => {
      if (current && Math.abs(current.x - next.x) < 0.5 && Math.abs(current.y - next.y) < 0.5) return current
      return next
    })
  }

  useLayoutEffect(() => {
    measure()
  })

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    const timer = window.setInterval(measure, 90)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.clearInterval(timer)
    }
  }, [centerPoint])

  let connectorEnd: Point | null = null
  if (startPoint && centerPoint) {
    const dx = centerPoint.x - startPoint.x
    const dy = centerPoint.y - startPoint.y
    const distance = Math.hypot(dx, dy)
    if (distance > 0.001) {
      const length = Math.min(distance, MAX_CONNECTOR_LENGTH)
      connectorEnd = {
        x: startPoint.x + dx / distance * length,
        y: startPoint.y + dy / distance * length,
      }
    }
  }

  return (
    <>
      {startPoint && connectorEnd && (
        <svg className="brain-hud-connector" aria-hidden="true">
          <line x1={startPoint.x} y1={startPoint.y} x2={connectorEnd.x} y2={connectorEnd.y} />
          <circle cx={connectorEnd.x} cy={connectorEnd.y} r="3" />
        </svg>
      )}

      <section ref={panelRef} className={`brain-hud-panel ${className}`.trim()} aria-label={ariaLabel ?? title}>
        <div className="brain-hud-panel__surface" />
        <header className="brain-hud-panel__header">
          <span>{title}</span>
          {meta && <small>{meta}</small>}
        </header>
        <div className="brain-hud-panel__content">{children}</div>
      </section>
    </>
  )
}
