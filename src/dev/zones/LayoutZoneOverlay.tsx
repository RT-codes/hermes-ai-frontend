import { layoutZones, type LayoutZoneId } from './layoutZones'

type LayoutZoneOverlayProps = {
  activeZoneIds: ReadonlySet<LayoutZoneId>
}

/**
 * Visualizes only the diagnostic zones the developer has enabled. The overlay
 * never participates in production layout or pointer handling, so individual
 * zones can be isolated while debugging overlaps without affecting the app.
 */
export function LayoutZoneOverlay({ activeZoneIds }: LayoutZoneOverlayProps) {
  if (activeZoneIds.size === 0) return null

  return (
    <div className="layout-zone-overlay" aria-hidden="true">
      {layoutZones
        .filter((zone) => activeZoneIds.has(zone.id))
        .map((zone) => (
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
