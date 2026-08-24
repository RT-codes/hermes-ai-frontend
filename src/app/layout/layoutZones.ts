export type LayoutZoneId =
  | 'top-band'
  | 'left-nav'
  | 'left-hud'
  | 'center-stage'
  | 'right-hud'
  | 'bottom-band'
  | 'floating-layer'

export type LayoutZone = {
  id: LayoutZoneId
  label: string
  description: string
  style: {
    top: string
    right: string
    bottom: string
    left: string
  }
}

/**
 * Shared application layout contracts. Developer tooling visualizes these same zones,
 * while production HUD/workspace surfaces declare which zone they own via
 * `data-layout-zone`. A zone is an ownership/alignment contract, not a rigid tile.
 */
export const layoutZones: LayoutZone[] = [
  {
    id: 'top-band',
    label: 'TOP BAND',
    description: 'Timeline, global status and compact top-level HUD controls.',
    style: { top: '0.75rem', right: '1rem', bottom: 'calc(100% - 6.25rem)', left: 'calc(var(--sidebar-width) + 1rem)' },
  },
  {
    id: 'left-nav',
    label: 'LEFT NAV',
    description: 'Persistent primary navigation ownership.',
    style: { top: '0.75rem', right: 'calc(100% - var(--sidebar-width))', bottom: '0.75rem', left: '0.75rem' },
  },
  {
    id: 'left-hud',
    label: 'LEFT HUD',
    description: 'Contextual controls and secondary inspectors anchored left of stage.',
    style: { top: '6.75rem', right: 'calc(100% - var(--sidebar-width) - 20rem)', bottom: '6.5rem', left: 'calc(var(--sidebar-width) + 1rem)' },
  },
  {
    id: 'center-stage',
    label: 'CENTER STAGE',
    description: 'Primary persistent spatial interaction surface.',
    style: { top: '6.75rem', right: '21rem', bottom: '6.5rem', left: 'calc(var(--sidebar-width) + 21rem)' },
  },
  {
    id: 'right-hud',
    label: 'RIGHT HUD',
    description: 'Primary inspectors, telemetry and workspace HUD panels.',
    style: { top: '6.75rem', right: '1rem', bottom: '6.5rem', left: 'calc(100% - 20rem)' },
  },
  {
    id: 'bottom-band',
    label: 'BOTTOM BAND',
    description: 'Workspace controls, contextual timeline/selection actions and help.',
    style: { top: 'calc(100% - 5.75rem)', right: '1rem', bottom: '0.75rem', left: 'calc(var(--sidebar-width) + 1rem)' },
  },
  {
    id: 'floating-layer',
    label: 'FLOATING / MODAL',
    description: 'Temporary panels and dialogs that intentionally sit above zone geometry.',
    style: { top: '5.75rem', right: '4rem', bottom: '4.75rem', left: 'calc(var(--sidebar-width) + 4rem)' },
  },
]

export function layoutZoneAttributes(zone: LayoutZoneId, owner: string) {
  return {
    'data-layout-zone': zone,
    'data-layout-owner': owner,
  } as const
}
