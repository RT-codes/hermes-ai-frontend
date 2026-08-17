import { useState } from 'react'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { FloatingPanel } from './components/FloatingPanel/FloatingPanel'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TopBar } from './components/TopBar/TopBar'
import { WorkspaceStage, type WorkspaceView } from './components/WorkspaceStage/WorkspaceStage'
import { HouseholdProvider } from './context/HouseholdContext'
import './styles/layout.css'
import './styles/chat.css'
import './styles/workspace.css'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('brain')

  return (
    <HouseholdProvider>
      <main className={`hermes-home ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <Sidebar
          collapsed={sidebarCollapsed}
          activeView={activeView}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onViewChange={setActiveView}
        />
        <TopBar />
        <WorkspaceStage activeView={activeView} />

        <FloatingPanel
          id="chat"
          title="CHAT"
          className="chat-panel"
          defaultRect={{ x: 280, y: 610, width: 520, height: 320 }}
          minWidth={340}
          minHeight={240}
        >
          <ChatPanel />
        </FloatingPanel>

        <FloatingPanel
          id="activity"
          title="ACTIVITY"
          className="activity-panel"
          defaultRect={{ x: 1020, y: 120, width: 300, height: 230 }}
          minWidth={240}
          minHeight={180}
        >
          <ul>
            <li><span className="activity-dot active" /> Hermes ready</li>
            <li><span className="activity-dot" /> Memory idle</li>
            <li><span className="activity-dot" /> Tools idle</li>
          </ul>
        </FloatingPanel>

        <FloatingPanel
          id="system"
          title="SYSTEM"
          className="system-panel"
          defaultRect={{ x: 1020, y: 690, width: 300, height: 190 }}
          minWidth={230}
          minHeight={160}
        >
          <div className="system-list">
            <span>Qwen</span>
            <span>Hindsight</span>
            <span>Ollama</span>
          </div>
        </FloatingPanel>
      </main>
    </HouseholdProvider>
  )
}

export default App
