import type { CSSProperties } from 'react'
import type { Agent } from './types'

export const UNASSIGNED = '__unassigned__'

type RoleFilterProps = {
  agents: Agent[]
  roleOptions: string[]
  selectedRoles: Set<string>
  getProfileColor: (profileId: string) => string
  onToggleRole: (role: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
}

export function RoleFilter({
  agents,
  roleOptions,
  selectedRoles,
  getProfileColor,
  onToggleRole,
  onSelectAll,
  onSelectNone,
}: RoleFilterProps) {
  const roleLabel = (role: string) => {
    if (role === UNASSIGNED) return 'Unassigned'
    return agents.find((agent) => agent.id === role)?.name || role
  }

  return (
    <details className="orchestration-role-filter">
      <summary>
        ROLES
        <span>{selectedRoles.size}/{roleOptions.length}</span>
      </summary>
      <div className="orchestration-role-filter__menu">
        <div className="orchestration-role-filter__actions">
          <button type="button" onClick={onSelectAll}>ALL</button>
          <button type="button" onClick={onSelectNone}>NONE</button>
        </div>
        {roleOptions.map((role) => (
          <label
            key={role}
            style={{ '--profile-color': getProfileColor(role === UNASSIGNED ? 'default' : role) } as CSSProperties}
          >
            <input
              type="checkbox"
              checked={selectedRoles.has(role)}
              onChange={() => onToggleRole(role)}
            />
            <span className="orchestration-role-filter__dot" aria-hidden="true" />
            <span>{roleLabel(role)}</span>
          </label>
        ))}
      </div>
    </details>
  )
}
