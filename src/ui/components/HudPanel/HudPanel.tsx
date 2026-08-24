import type { ReactNode } from 'react'
import { HudSurface } from '../../cells/HudSurface/HudSurface'

export type HudPanelProps = {
  title: string
  meta?: ReactNode
  className?: string
  children: ReactNode
  ariaLabel?: string
}

/**
 * Neutral HUD panel component shared across spatial workspaces. Legacy Brain class
 * names remain on the DOM during consolidation so existing feature overrides keep
 * working while callers migrate toward the neutral UI layer.
 */
export function HudPanel({ title, meta, className = '', children, ariaLabel }: HudPanelProps) {
  return (
    <section className={`hud-panel brain-hud-panel ${className}`.trim()} aria-label={ariaLabel ?? title}>
      <HudSurface className="hud-panel__surface brain-hud-panel__surface" />
      <header className="hud-panel__header brain-hud-panel__header">
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </header>
      <div className="hud-panel__content brain-hud-panel__content">{children}</div>
    </section>
  )
}
