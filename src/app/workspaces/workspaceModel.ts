export const workspaceIds = [
  'memory',
  'operations',
  'chat',
  'skills',
  'system',
  'settings',
] as const

export type WorkspaceId = typeof workspaceIds[number]

const workspaceIdSet = new Set<string>(workspaceIds)

/**
 * Converts persisted historical workspace values into the canonical product model.
 * `brain` is intentionally accepted only at this boundary so legacy browser state
 * can migrate forward without leaking the retired identity back into application code.
 */
export function normalizeWorkspaceId(value: string | null | undefined): WorkspaceId {
  if (value === 'brain') return 'memory'
  if (value && workspaceIdSet.has(value)) return value as WorkspaceId
  return 'memory'
}
