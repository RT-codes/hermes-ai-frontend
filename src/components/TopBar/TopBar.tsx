import { useHousehold } from '../../context/HouseholdContext'

export function TopBar() {
  const { currentUser } = useHousehold()

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">HERMES HOME · {currentUser.displayName}</div>
        <h1>Control Center</h1>
      </div>

      <div className="status-pill">
        <span className="status-dot" />
        System Online
      </div>
    </header>
  )
}
