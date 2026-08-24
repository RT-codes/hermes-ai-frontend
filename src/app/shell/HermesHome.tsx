import { useState, type CSSProperties } from 'react'
import { ActivityPanel } from '../../components/ActivityPanel/ActivityPanel'
import { BrainStage } from '../../components/BrainStage/BrainStage'
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
import type { SpatialGraphicsMode } from '../spatial/SpatialGraphicsSlot'
import { useWorkspaceTransition } from '../transitions/WorkspaceTransitionProvider'
import { useWorkspace } from '../workspaces/WorkspaceProvider'

const transitionIndex = (index: number) => ({ '--workspace-transition-index': index } as CSSProperties)

/**
 * Product shell for global chrome and cross-workspace floating surfaces. Requested
 * navigation belongs to WorkspaceProvider; rendered workspace handoff and the
 * persistent spatial camera layer are separate concerns so switching views does not
 * destroy the 3D world underneath the HUDs.
 */
export function HermesHome() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { activeWorkspace, setActiveWorkspace } = useWorkspace()
  const { displayWorkspace, phase } = useWorkspaceTransition()
  const { openTabIds, createSession } = useChatSessions()
  const { settings } = useAppearance()
  const computeAtTop = settings.computeHudPosition === 'top-right'
  const spatialWorkspace = displayWorkspace === 'memory' || displayWorkspace === 'operations'
  const spatialGraphicsMode: SpatialGraphicsMode = displayWorkspace === 'operations' ? 'operations' : 'memory'

  const activityHud = (
    <HudPanel title="HERMES INSIGHT" className="hermes-activity-panel">
      <ActivityPanel />
    </HudPanel>
  )

  const workspaceContent = displayWorkspace === 'memory'
    ? null
    : displayWorkspace === 'operations'
      ? <OrchestrationWorkspace />
      : <WorkspaceStage activeView={displayWorkspace} />

  const transitioningWorkspace = (
    <div
      className={`workspace-transition-frame ${spatialWorkspace ? '' : 'workspace-transition-item'}`.trim()}
      style={spatialWorkspace ? undefined : transitionIndex(0)}
    >
      {workspaceContent}
    </div>
  )

  return (
    <main
      className={`hermes-home ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}
      data-workspace-transition={phase}
      data-active-workspace={activeWorkspace}
      data-display-workspace={displayWorkspace}
      data-spatial-graphics={spatialWorkspace ? spatialGraphicsMode : undefined}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        activeView={activeWorkspace}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onViewChange={setActiveWorkspace}
        onNewChat={createSession}
      />

      <TopBar />
      {spatialWorkspace
        ? (
          <SpatialApplicationShell
            persistentLayer={<BrainStage graphicsMode={spatialGraphicsMode} />}
          >
            {transitioningWorkspace}
          </SpatialApplicationShell>
        )
        : transitioningWorkspace}

      {displayWorkspace === 'memory' && (
        <div className={`brain-hud-lane ${computeAtTop ? 'brain-hud-lane--compute-top' : 'brain-hud-lane--compute-bottom'}`}>
          <div className="brain-hud-lane__compute workspace-transition-item" style={transitionIndex(1)}>
            <HardwareTelemetryHud />
          </div>
          <div className="brain-hud-lane__insight workspace-transition-item" style={transitionIndex(2)}>
            {activityHud}
          </div>
        </div>
      )}

      {openTabIds.length > 0 && (
        <FloatingPanel
          id="chat"
          title="CHAT"
          className="chat-panel"
          sidecar={displayWorkspace === 'memory' ? undefined : activityHud}
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
