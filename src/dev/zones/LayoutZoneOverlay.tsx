import {
  isManagedLayoutLane,
  layoutSlotNames,
  layoutZones,
  type LayoutZoneId,
} from './layoutZones'

type LayoutZoneOverlayProps = {
  activeZoneIds: ReadonlySet<LayoutZoneId>
}

/**
 * Visualizes only the diagnostic zones the developer has enabled. Managed workspace
 * lanes include their FCP.6A top/middle/bottom subdivisions so the overlay displays
 * the same semantic placement contract production HUDs declare. The overlay never
 * participates in production layout or pointer handling.
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
            {isManagedLayoutLane(zone.id) && (
              <div className="layout-zone-overlay__slot-grid">
                {layoutSlotNames.map((slot) => (
                  <div
                    className="layout-zone-overlay__slot"
                    data-slot-id={`${zone.id}.${slot}`}
                    key={`${zone.id}.${slot}`}
                  >
                    <small>{zone.id}.{slot}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
