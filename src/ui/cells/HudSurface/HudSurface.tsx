type HudSurfaceProps = {
  className?: string
}

/**
 * Shared visual backing for cut-corner HUD surfaces. This cell owns only the
 * reusable glass/border treatment; higher layers remain responsible for layout,
 * content, interaction and semantic meaning.
 */
export function HudSurface({ className = '' }: HudSurfaceProps) {
  return <div className={`hud-surface ${className}`.trim()} aria-hidden="true" />
}
