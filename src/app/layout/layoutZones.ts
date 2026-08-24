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

const sidebar = 'var(--layout-zone-sidebar-width)'
const gutter = 'var(--layout-zone-page-gutter)'
const workspaceTop = 'var(--layout-zone-workspace-top)'
const workspaceBottom = 'var(--layout-zone-workspace-bottom)'
const hudWidth = 'var(--layout-zone-hud-width)'

/**
 * Shared application layout contracts. Developer tooling visualizes these same zones,
 * while production HUD/workspace surfaces declare which zone they own via
 * `data-layout-zone`. Geometry comes from layout-zones.css so production alignment and
 * the diagnostic overlay cannot silently drift apart.
 */
export const layoutZones: LayoutZone[] = [
  {
    id: 'top-band',
    label: 'TOP BAND',
    description: 'Timeline, global status and compact top-level HUD controls.',
    style: {
      top: 'var(--layout-zone-top)',
      right: gutter,
      bottom: 'var(--layout-zone-top-band-bottom)',
      left: `calc(${sidebar} + ${gutter})`,
    },
  },
  {
    id: 'left-nav',
    label: 'LEFT NAV',
    description: 'Persistent primary navigation ownership.',
    style: {
      top: 'var(--layout-zone-top)',
      right: `calc(100% - ${sidebar})`,
      bottom: 'var(--layout-zone-bottom)',
      left: 'var(--layout-zone-top)',
    },
  },
  {
    id: 'left-hud',
    label: 'LEFT HUD',
    description: 'Contextual controls and secondary inspectors anchored left of stage.',
    style: {
      top: workspaceTop,
      right: `calc(100% - ${sidebar} - ${gutter} - ${hudWidth})`,
      bottom: workspaceBottom,
      left: `calc(${sidebar} + ${gutter})`,
    },
  },
  {
    id: 'center-stage',
    label: 'CENTER STAGE',
    description: 'Primary persistent spatial interaction surface.',
    style: {
      top: workspaceTop,
      right: 'var(--layout-zone-center-right)',
      bottom: workspaceBottom,
      left: 'var(--layout-zone-center-left)',
    },
  },
  {
    id: 'right-hud',
    label: 'RIGHT HUD',
    description: 'Primary inspectors, telemetry and workspace HUD panels.',
    style: {
      top: workspaceTop,
      right: gutter,
      bottom: workspaceBottom,
      left: `calc(100% - ${gutter} - ${hudWidth})`,
    },
  },
  {
    id: 'bottom-band',
    label: 'BOTTOM BAND',
    description: 'Workspace controls, contextual timeline/selection actions and help.',
    style: {
      top: 'var(--layout-zone-bottom-top)',
      right: gutter,
      bottom: 'var(--layout-zone-bottom)',
      left: `calc(${sidebar} + ${gutter})`,
    },
  },
  {
    id: 'floating-layer',
    label: 'FLOATING / MODAL',
    description: 'Temporary panels and dialogs that intentionally sit above zone geometry.',
    style: {
      top: 'var(--layout-zone-floating-top)',
      right: 'var(--layout-zone-floating-inset-x)',
      bottom: 'var(--layout-zone-floating-bottom)',
      left: `calc(${sidebar} + var(--layout-zone-floating-inset-x))`,
    },
  },
]

export function layoutZoneAttributes(zone: LayoutZoneId, owner: string) {
  return {
    'data-layout-zone': zone,
    'data-layout-owner': owner,
  } as const
}
