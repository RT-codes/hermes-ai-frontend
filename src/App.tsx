import { useState } from 'react'
import { ActivityPanel } from './components/ActivityPanel/ActivityPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { FloatingPanel } from './components/FloatingPanel/FloatingPanel'
import { HardwareTelemetryHud } from './components/HardwareTelemetryHud/HardwareTelemetryHud'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SystemPanel } from './components/SystemPanel/SystemPanel'
import { TopBar } from './components/TopBar/TopBar'
import { WorkspaceStage, type WorkspaceView } from './components/WorkspaceStage/WorkspaceStage'
import { AppearanceProvider } from './context/AppearanceContext'
import { ChatSessionsProvider, useChatSessions } from './context/ChatSessionsContext'
import { HouseholdProvider } from './context/HouseholdContext'
import { RuntimeStatusProvider } from './context/RuntimeStatusContext'
import { SystemTelemetryProvider } from './context/SystemTelemetryContext'
import './styles/layout.css'
import './styles/chat.css'
import './styles/workspace.css'
import './styles/telemetry.css'

function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('brain')
  const { openTabIds, createSession } = useChatSessions()

  return (
    <main className={`hermes-home ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        activeView={activeView}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onViewChange={setActiveView}
      />

      <button
        className="quick-new-chat"
        type="button"
        onClick={createSession}
        aria-label="Start a new Hermes chat"
        title="New Hermes chat"
      >
        <span>+</span>
      </button>

      <TopBar />
      <WorkspaceStage activeView={activeView} />

      {activeView === 'brain' && <HardwareTelemetryHud />}

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

      <FloatingPanel
        id="activity"
        title="ACTIVITY"
        className="activity-panel"
        defaultRect={{ x: 1020, y: 120, width: 300, height: 230 }}
        minWidth={240}
        minHeight={180}
      >
        <ActivityPanel />
      </FloatingPanel>

      <FloatingPanel
        id="system"
        title="SYSTEM"
        className="system-panel"
        defaultRect={{ x: 1020, y: 690, width: 300, height: 190 }}
        minWidth={250}
        minHeight={180}
      >
        <SystemPanel />
      </FloatingPanel>
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
              <HermesHome />
            </SystemTelemetryProvider>
          </RuntimeStatusProvider>
        </ChatSessionsProvider>
      </AppearanceProvider>
    </HouseholdProvider>
  )
}

export default App
