import { useRuntimeStatus } from '../../context/RuntimeStatusContext'
import { HudPanel } from '../../ui/components/HudPanel/HudPanel'
import { SystemPanel } from '../SystemPanel/SystemPanel'

export function TopBar() {
  const { hermesOnline, hindsightOnline } = useRuntimeStatus()
  const healthy = hermesOnline && hindsightOnline

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">HERMES HOME</div>
        <h1>Control Center</h1>
      </div>

      <div className="system-status-menu">
        <button
          className={`status-pill ${healthy ? 'is-online' : 'is-degraded'}`}
          type="button"
          aria-label="Show system status details"
        >
          <span className="status-dot" />
          {healthy ? 'System Online' : 'System Degraded'}
        </button>

        <div className="system-status-flyout" role="status" aria-label="System status details">
          <HudPanel title="SYSTEM">
            <SystemPanel />
          </HudPanel>
        </div>
      </div>
    </header>
  )
}
