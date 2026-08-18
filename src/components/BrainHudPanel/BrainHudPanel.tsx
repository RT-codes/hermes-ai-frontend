import type { ReactNode } from 'react'

type BrainHudPanelProps = {
  title: string
  meta?: ReactNode
  className?: string
  children: ReactNode
  ariaLabel?: string
}

export function BrainHudPanel({ title, meta, className = '', children, ariaLabel }: BrainHudPanelProps) {
  return (
    <section className={`brain-hud-panel ${className}`.trim()} aria-label={ariaLabel ?? title}>
      <div className="brain-hud-panel__surface" />
      <header className="brain-hud-panel__header">
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </header>
      <div className="brain-hud-panel__content">{children}</div>
    </section>
  )
}
