type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  ['BR', 'Brain'],
  ['CH', 'Chat'],
  ['ME', 'Memory'],
  ['SK', 'Skills'],
  ['SY', 'System'],
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__surface" />

      <div className="sidebar__content">
        <div className="sidebar__brand">
          <span className="sidebar__mark">H</span>
          {!collapsed && (
            <div>
              <strong>HERMES</strong>
              <span>HOME AI</span>
            </div>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="Hermes workspace">
          {navItems.map(([code, label], index) => (
            <button className={`sidebar__item ${index === 0 ? 'is-active' : ''}`} type="button" key={label}>
              <span className="sidebar__icon">{code}</span>
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__item" type="button">
            <span className="sidebar__icon">OP</span>
            {!collapsed && <span>Operations</span>}
          </button>
          <button className="sidebar__item" type="button">
            <span className="sidebar__icon">SE</span>
            {!collapsed && <span>Settings</span>}
          </button>

          <button className="sidebar__toggle" type="button" onClick={onToggle}>
            <span>{collapsed ? '›' : '‹'}</span>
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </div>
    </aside>
  )
}
