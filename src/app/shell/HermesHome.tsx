import { useEffect, useState } from 'react'
import { ActivityPanel } from '../../components/ActivityPanel/ActivityPanel'
import { ChatPanel } from '../../components/ChatPanel/ChatPanel'
import { FloatingPanel } from '../../components/FloatingPanel/FloatingPanel'
import { HardwareTelemetryHud } from '../../components/HardwareTelemetryHud/HardwareTelemetryHud'
import { Sidebar } from '../../components/Sidebar/Sidebar'
import { TopBar } from '../../components/TopBar/TopBar'
import { WorkspaceStage, type WorkspaceView } from '../../components/WorkspaceStage/WorkspaceStage'
import { useAppearance } from '../../context/AppearanceContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { DeveloperConsole } from '../../dev/console/DeveloperConsole'
import { NewChatProfileDialog } from '../../features/chat/components/NewChatProfileDialog'
import { OrchestrationWorkspace } from '../../features/orchestration/OrchestrationWorkspace'
import { HudPanel } from '../../ui/components/HudPanel/HudPanel'

const ACTIVE_VIEW_STORAGE_KEY = 'hermes-active-workspace:v1'

/**
 * Reads the current compatibility workspace value. FCP.3 will replace the legacy
 * `brain` identity with canonical `memory` ownership; until then this preserves the
 * already-tested browser resume behavior exactly.
 */
function initialWorkspaceView(): WorkspaceView {
  try {
    const stored = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)
    if (stored === 'memory') return 'brain'
    if (stored === 'brain' || stored === 'operations' || stored === 'chat' || stored === 'skills' || stored === 'system' || stored === 'settings') {
      return stored
    }
  } catch {
    // Storage is optional; Memory remains the safe default.
  }
  return 'brain'
}

/**
 * Current product shell and compatibility boundary. It coordinates global chrome,
 * workspace mounting and floating surfaces while FCP progressively extracts stable
 * workspace/navigation ownership from these legacy conditionals.
 */
export function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>(initialWorkspaceView)
  const { openTabIds, createSession } = useChatSessions()
  const { settings } = useAppearance()
  const computeAtTop = settings.computeHudPosition === 'top-right'
  const developerWorkspace = activeView === 'brain' ? 'memory' : activeView

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView)
    } catch {
      // Do not let unavailable browser storage affect navigation.
    }
  }, [activeView])

  const activityHud = (
    <HudPanel title="HERMES INSIGHT" className="hermes-activity-panel">
      <ActivityPanel />
    </HudPanel>
  )

  return (
    <main className={`hermes-home ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        activeView={activeView}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onViewChange={setActiveView}
        onNewChat={createSession}
      />

      <TopBar />
      {activeView === 'operations'
        ? <OrchestrationWorkspace />
        : <WorkspaceStage activeView={activeView} />}

      {activeView === 'brain' && (
        <div className={`brain-hud-lane ${computeAtTop ? 'brain-hud-lane--compute-top' : 'brain-hud-lane--compute-bottom'}`}>
          <div className="brain-hud-lane__compute">
            <HardwareTelemetryHud />
          </div>
          <div className="brain-hud-lane__insight">
            {activityHud}
          </div>
        </div>
      )}

      {openTabIds.length > 0 && (
        <FloatingPanel
          id="chat"
          title="CHAT"
          className="chat-panel"
          sidecar={activeView === 'brain' ? undefined : activityHud}
          defaultRect={{ x: 280, y: 610, width: 560, height: 350 }}
          minWidth={380}
          minHeight={270}
        >
          <ChatPanel />
        </FloatingPanel>
      )}

      <NewChatProfileDialog />
      <DeveloperConsole activeWorkspace={developerWorkspace} />
    </main>
  )
}
