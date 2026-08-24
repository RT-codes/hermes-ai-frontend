import { useState } from 'react'
import { ActivityPanel } from '../../components/ActivityPanel/ActivityPanel'
import { ChatPanel } from '../../components/ChatPanel/ChatPanel'
import { FloatingPanel } from '../../components/FloatingPanel/FloatingPanel'
import { HardwareTelemetryHud } from '../../components/HardwareTelemetryHud/HardwareTelemetryHud'
import { Sidebar } from '../../components/Sidebar/Sidebar'
import { TopBar } from '../../components/TopBar/TopBar'
import { WorkspaceStage } from '../../components/WorkspaceStage/WorkspaceStage'
import { useAppearance } from '../../context/AppearanceContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { DeveloperConsole } from '../../dev/console/DeveloperConsole'
import { NewChatProfileDialog } from '../../features/chat/components/NewChatProfileDialog'
import { OrchestrationWorkspace } from '../../features/orchestration/OrchestrationWorkspace'
import { HudPanel } from '../../ui/components/HudPanel/HudPanel'
import { SpatialApplicationShell } from '../spatial/SpatialApplicationShell'
import { useWorkspace } from '../workspaces/WorkspaceProvider'

/**
 * Product shell for global chrome and cross-workspace floating surfaces. Workspace
 * identity/persistence belongs to WorkspaceProvider; spatial workspaces additionally
 * share one persistent application environment instead of recreating it per view.
 */
export function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { activeWorkspace, setActiveWorkspace } = useWorkspace()
  const { openTabIds, createSession } = useChatSessions()
  const { settings } = useAppearance()
  const computeAtTop = settings.computeHudPosition === 'top-right'
  const spatialWorkspace = activeWorkspace === 'memory' || activeWorkspace === 'operations'

  const activityHud = (
    <HudPanel title="HERMES INSIGHT" className="hermes-activity-panel">
      <ActivityPanel />
    </HudPanel>
  )

  const workspaceContent = activeWorkspace === 'operations'
    ? <OrchestrationWorkspace />
    : <WorkspaceStage activeView={activeWorkspace} />

  return (
    <main className={`hermes-home ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        activeView={activeWorkspace}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onViewChange={setActiveWorkspace}
        onNewChat={createSession}
      />

      <TopBar />
      {spatialWorkspace
        ? <SpatialApplicationShell>{workspaceContent}</SpatialApplicationShell>
        : workspaceContent}

      {activeWorkspace === 'memory' && (
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
          sidecar={activeWorkspace === 'memory' ? undefined : activityHud}
          defaultRect={{ x: 280, y: 610, width: 560, height: 350 }}
          minWidth={380}
          minHeight={270}
        >
          <ChatPanel />
        </FloatingPanel>
      )}

      <NewChatProfileDialog />
      <DeveloperConsole activeWorkspace={activeWorkspace} />
    </main>
  )
}
