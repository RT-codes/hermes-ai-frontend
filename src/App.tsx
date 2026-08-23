import { useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel'
import { BrainHudPanel } from './components/BrainHudPanel/BrainHudPanel'
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
import { NewChatProfileDialog } from './features/chat/components/NewChatProfileDialog'
import { OrchestrationWorkspace } from './features/orchestration/OrchestrationWorkspace'
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
import './styles/brain.css'
import './styles/brain-phase2.css'
import './styles/brain-final-polish.css'
import './styles/typography-v2.css'
import './styles/orchestration.css'
import './styles/timeline-hud.css'
import './styles/spatial-stage.css'
import './styles/brain-wrap-polish.css'
import './styles/orchestration-spatial.css'

function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('brain')
  const { openTabIds, createSession } = useChatSessions()
  const { settings } = useAppearance()
  const computeAtTop = settings.computeHudPosition === 'top-right'

  const activityHud = (
    <BrainHudPanel title="HERMES INSIGHT" className="hermes-activity-panel">
      <ActivityPanel />
    </BrainHudPanel>
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
    </main>
  )
}

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
