import { useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel'
import { BrainHudPanel } from './components/BrainHudPanel/BrainHudPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { FloatingPanel } from './components/FloatingPanel/FloatingPanel'
import { HardwareTelemetryHud } from './components/HardwareTelemetryHud/HardwareTelemetryHud'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SystemPanel } from './components/SystemPanel/SystemPanel'
import { TopBar } from './components/TopBar/TopBar'
import { WorkspaceStage, type WorkspaceView } from './components/WorkspaceStage/WorkspaceStage'
import { AppearanceProvider, useAppearance } from './context/AppearanceContext'
import { BrainSceneProvider } from './context/BrainSceneContext'
import { ChatSessionsProvider, useChatSessions } from './context/ChatSessionsContext'
import { HouseholdProvider } from './context/HouseholdContext'
import { RuntimeStatusProvider } from './context/RuntimeStatusContext'
import { SystemTelemetryProvider } from './context/SystemTelemetryContext'
import './styles/layout.css'
import './styles/chat.css'
import './styles/workspace.css'
import './styles/telemetry.css'
import './styles/brain.css'
import './styles/brain-phase2.css'
import './styles/brain-final-polish.css'

function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('brain')
  const { openTabIds, createSession } = useChatSessions()
  const { settings } = useAppearance()
  const computeAtTop = settings.computeHudPosition === 'top-right'

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
      <WorkspaceStage activeView={activeView} />

      {activeView === 'brain' && (
        <>
          <div className={`brain-hud-stack ${computeAtTop ? 'brain-hud-stack--top' : 'brain-hud-stack--bottom'}`}>
            <HardwareTelemetryHud />
          </div>

          <div className={`brain-hud-stack ${computeAtTop ? 'brain-hud-stack--bottom' : 'brain-hud-stack--top'}`}>
            <BrainHudPanel title="ACTIVITY">
              <ActivityPanel />
            </BrainHudPanel>
            <BrainHudPanel title="SYSTEM">
              <SystemPanel />
            </BrainHudPanel>
          </div>
        </>
      )}

      {openTabIds.length > 0 && (
        <FloatingPanel
          id="chat"
          title="CHAT"
          className="chat-panel"
          defaultRect={{ x: 280, y: 610, width: 560, height: 350 }}
          minWidth={380}
          minHeight={270}
        >
          <ChatPanel />
        </FloatingPanel>
      )}
    </main>
  )
}

function App() {
  return (
    <HouseholdProvider>
      <AppearanceProvider>
        <ChatSessionsProvider>
          <RuntimeStatusProvider>
            <SystemTelemetryProvider>
              <BrainSceneProvider>
                <HermesHome />
              </BrainSceneProvider>
            </SystemTelemetryProvider>
          </RuntimeStatusProvider>
        </ChatSessionsProvider>
      </AppearanceProvider>
    </HouseholdProvider>
  )
}

export default App
