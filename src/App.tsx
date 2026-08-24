import { useEffect, useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { FloatingPanel } from './components/FloatingPanel/FloatingPanel'
import { HardwareTelemetryHud } from './components/HardwareTelemetryHud/HardwareTelemetryHud'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TopBar } from './components/TopBar/TopBar'
import { WorkspaceStage, type WorkspaceView } from './components/WorkspaceStage/WorkspaceStage'
import { AppearanceProvider, useAppearance } from './context/AppearanceContext'
import { BrainSceneProvider } from './context/BrainSceneContext'
import { ChatSessionsProvider, useChatSessions } from './context/ChatSessionsContext'
import { ConnectionSettingsProvider } from './context/ConnectionSettingsContext'
import { HermesProfileProvider } from './context/HermesProfileContext'
import { HouseholdProvider } from './context/HouseholdContext'
import { InsightSelectionProvider } from './context/InsightSelectionContext'
import { RuntimeStatusProvider } from './context/RuntimeStatusContext'
import { SystemTelemetryProvider } from './context/SystemTelemetryContext'
import { DeveloperConsole } from './dev/console/DeveloperConsole'
import { NewChatProfileDialog } from './features/chat/components/NewChatProfileDialog'
import { OrchestrationWorkspace } from './features/orchestration/OrchestrationWorkspace'
import { HudPanel } from './ui/components/HudPanel/HudPanel'
import './styles/layout.css'
import './styles/chat.css'
import './styles/chat-v2.css'
import './styles/profile-chat.css'
import './styles/workspace.css'
import './styles/settings-v2.css'
import './styles/telemetry.css'
import './styles/activity-dock.css'
import './styles/insight.css'
import './styles/trace-selection.css'
import './styles/system-flyout.css'
import './styles/primitives.css'
import './styles/brain.css'
import './styles/brain-phase2.css'
import './styles/brain-final-polish.css'
import './styles/typography-v2.css'
import './styles/orchestration.css'
import './styles/timeline-hud.css'
import './styles/spatial-stage.css'
import './styles/brain-wrap-polish.css'
import './styles/orchestration-spatial.css'
import './styles/orchestration-final-polish.css'
import './styles/orchestration-kanban.css'
import './styles/dev-tools.css'

const ACTIVE_VIEW_STORAGE_KEY = 'hermes-active-workspace:v1'

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
 * The current app shell remains the compatibility owner until FCP.3 moves
 * workspace identity/navigation into its dedicated controller.
 */
function HermesHome() {
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

/** Root provider composition stays intentionally boring while FCP extracts shell ownership. */
function App() {
  return (
    <HouseholdProvider>
      <AppearanceProvider>
        <ConnectionSettingsProvider>
          <HermesProfileProvider>
            <ChatSessionsProvider>
              <InsightSelectionProvider>
                <RuntimeStatusProvider>
                  <SystemTelemetryProvider>
                    <BrainSceneProvider>
                      <HermesHome />
                    </BrainSceneProvider>
                  </SystemTelemetryProvider>
                </RuntimeStatusProvider>
              </InsightSelectionProvider>
            </ChatSessionsProvider>
          </HermesProfileProvider>
        </ConnectionSettingsProvider>
      </AppearanceProvider>
    </HouseholdProvider>
  )
}

export default App
