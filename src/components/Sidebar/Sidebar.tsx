import type { WorkspaceView } from '../WorkspaceStage/WorkspaceStage'

type SidebarProps = {
  collapsed: boolean
  activeView: WorkspaceView
  onToggle: () => void
  onViewChange: (view: WorkspaceView) => void
}

const primaryNavItems: Array<{ code: string; label: string; view: WorkspaceView }> = [
  { code: 'BR', label: 'Brain', view: 'brain' },
  { code: 'CH', label: 'Chats', view: 'chat' },
  { code: 'ME', label: 'Memory', view: 'memory' },
  { code: 'SK', label: 'Skills', view: 'skills' },
  { code: 'SY', label: 'System', view: 'system' },
]

const footerNavItems: Array<{ code: string; label: string; view: WorkspaceView }> = [
  { code: 'OP', label: 'Operations', view: 'operations' },
  { code: 'SE', label: 'Settings', view: 'settings' },
]

export function Sidebar({ collapsed, activeView, onToggle, onViewChange }: SidebarProps) {
  function renderNavItem(item: { code: string; label: string; view: WorkspaceView }) {
    return (
      <button
        className={`sidebar__item ${activeView === item.view ? 'is-active' : ''}`}
        type="button"
        key={item.view}
        onClick={() => onViewChange(item.view)}
        title={collapsed ? item.label : undefined}
      >
        <span className="sidebar__icon">{item.code}</span>
        {!collapsed && <span>{item.label}</span>}
      </button>
    )
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__surface" />

      <div className="sidebar__content">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true">H</span>
          {!collapsed && (
            <div className="sidebar__brand-copy">
              <strong>HERMES</strong>
              <span>HOME AI</span>
            </div>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="Hermes workspace">
          {primaryNavItems.map(renderNavItem)}
        </nav>

        <div className="sidebar__footer">
          {footerNavItems.map(renderNavItem)}

          <button className="sidebar__toggle" type="button" onClick={onToggle}>
            <span>{collapsed ? '›' : '‹'}</span>
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </div>
    </aside>
  )
}
