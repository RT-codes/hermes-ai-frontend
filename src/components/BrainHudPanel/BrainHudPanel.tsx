import type { ReactNode } from 'react'
import { HudSurface } from '../../ui/cells/HudSurface/HudSurface'

type BrainHudPanelProps = {
  title: string
  meta?: ReactNode
  className?: string
  children: ReactNode
  ariaLabel?: string
}

/**
 * Product-level HUD panel used by Memory and other spatial overlays. Structural
 * content stays here while the reusable glass/cut-corner backing belongs to the
 * lower-level HudSurface cell.
 */
export function BrainHudPanel({ title, meta, className = '', children, ariaLabel }: BrainHudPanelProps) {
  return (
    <section className={`brain-hud-panel ${className}`.trim()} aria-label={ariaLabel ?? title}>
      <HudSurface className="brain-hud-panel__surface" />
      <header className="brain-hud-panel__header">
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </header>
      <div className="brain-hud-panel__content">{children}</div>
    </section>
  )
}
