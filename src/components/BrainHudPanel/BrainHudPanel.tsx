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

export function BrainHudPanel({ title, meta, className = '', children, ariaLabel }: BrainHudPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const { centerPoint } = useBrainScene()
  const [startPoint, setStartPoint] = useState<Point | null>(null)

  const measure = () => {
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    setStartPoint({ x: rect.left, y: rect.top + rect.height * 0.5 })
  }

  useLayoutEffect(() => {
    measure()
  }, [centerPoint])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <>
      {startPoint && centerPoint && (
        <svg className="brain-hud-connector" aria-hidden="true">
          <line x1={startPoint.x} y1={startPoint.y} x2={centerPoint.x} y2={centerPoint.y} />
          <circle cx={centerPoint.x} cy={centerPoint.y} r="4" />
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
