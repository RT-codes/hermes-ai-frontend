import { layoutZones } from './layoutZones'

type LayoutZoneOverlayProps = {
  visible: boolean
}

/**
 * Visualizes zone contracts without participating in layout or pointer handling.
 * Production components stay untouched until a later ticket deliberately adopts
 * a zone, keeping FCP.2 diagnostic rather than destructive.
 */
export function LayoutZoneOverlay({ visible }: LayoutZoneOverlayProps) {
  if (!visible) return null

  return (
    <div className="layout-zone-overlay" aria-hidden="true">
      {layoutZones.map((zone) => (
        <div
          key={zone.id}
          className={`layout-zone-overlay__zone layout-zone-overlay__zone--${zone.id}`}
          style={zone.style}
          data-zone-id={zone.id}
        >
          <span>{zone.label}</span>
        </div>
      ))}
    </div>
  )
}
