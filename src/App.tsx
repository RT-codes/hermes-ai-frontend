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
import './styles/chat-v2.css'
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
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      <TopBar />
      <WorkspaceStage activeView={activeView} onViewChange={setActiveView} />
      <BrainHudPanel />
      <HardwareTelemetryHud position={computeAtTop ? 'top' : 'bottom'} />

      {openTabIds.length > 0 && (
        <FloatingPanel
          id="chat-panel"
          title="Hermes Chat"
          className="chat-panel"
          defaultPosition={{ x: 460, y: 130 }}
          defaultSize={{ width: 460, height: 580 }}
          minSize={{ width: 320, height: 360 }}
        >
          <ChatPanel />
        </FloatingPanel>
      )}

      <button className="quick-new-chat" type="button" onClick={createSession} aria-label="New Hermes chat">
        +
      </button>

      <ActivityPanel />
      <SystemPanel />
    </div>
  )
}

export default function App() {
  return (
    <AppearanceProvider>
      <HouseholdProvider>
        <RuntimeStatusProvider>
          <SystemTelemetryProvider>
            <ChatSessionsProvider>
              <BrainSceneProvider>
                <HermesHome />
              </BrainSceneProvider>
            </ChatSessionsProvider>
          </SystemTelemetryProvider>
        </RuntimeStatusProvider>
      </HouseholdProvider>
    </AppearanceProvider>
  )
}
