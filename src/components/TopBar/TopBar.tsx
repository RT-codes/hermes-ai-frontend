import { useRuntimeStatus } from '../../context/RuntimeStatusContext'

export function TopBar() {
  const { hermesOnline, hindsightOnline } = useRuntimeStatus()
  const healthy = hermesOnline && hindsightOnline

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">HERMES HOME</div>
        <h1>Control Center</h1>
      </div>

      <div className={`status-pill ${healthy ? 'is-online' : 'is-degraded'}`}>
        <span className="status-dot" />
        {healthy ? 'System Online' : 'System Degraded'}
      </div>
    </header>
  )
}
