import { useAppearance } from '../../context/AppearanceContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { BrainStage } from '../BrainStage/BrainStage'

export type WorkspaceView =
  | 'brain'
  | 'chat'
  | 'memory'
  | 'skills'
  | 'system'
  | 'operations'
  | 'settings'

type WorkspaceStageProps = {
  activeView: WorkspaceView
}

const viewCopy: Record<Exclude<WorkspaceView, 'brain' | 'chat' | 'settings'>, { eyebrow: string; title: string; description: string }> = {
  memory: {
    eyebrow: 'Hindsight + Hermes',
    title: 'Memory',
    description: 'Memory inspection, recall history, and graph exploration will live in this workspace.',
  },
  skills: {
    eyebrow: 'Capabilities',
    title: 'Skills',
    description: 'Installed skills, discovery state, and future capability routing will live here.',
  },
  system: {
    eyebrow: 'Runtime telemetry',
    title: 'System',
    description: 'Ollama, Qwen, Hermes, Hindsight, Docker, GPU, and service health will be surfaced here.',
  },
  operations: {
    eyebrow: 'Household automation',
    title: 'Operations',
    description: 'Scheduled jobs, background tasks, runs, and larger household workflows will live here.',
  },
}

function ChatsWorkspace() {
  const { sessions, openTabIds, createSession, openSession, closeTab, deleteSession } = useChatSessions()

  return (
    <section className="workspace-stage workspace-stage--interactive" aria-label="Chats workspace">
      <div className="workspace-card workspace-card--wide">
        <div className="workspace-card__heading">
          <div>
            <span className="workspace-placeholder__eyebrow">Conversation workspace</span>
            <h2>Chats</h2>
            <p>Persistent Hermes conversations. Open chats appear as tabs in the floating chat console.</p>
          </div>
          <button className="workspace-action" type="button" onClick={createSession}>+ NEW CHAT</button>
        </div>

        <div className="chat-session-list">
          {sessions.length === 0 && (
            <div className="chat-session-empty">
              No saved chats. Start a new conversation when you need Hermes.
            </div>
          )}

          {sessions.map((session) => {
            const isOpen = openTabIds.includes(session.id)
            const isBusy = session.connectionState === 'connecting' || session.connectionState === 'streaming'

            return (
              <article className="chat-session-card" key={session.id}>
                <button className="chat-session-card__open" type="button" onClick={() => openSession(session.id)}>
                  <span className={`chat-session-card__state chat-session-card__state--${session.connectionState}`} />
                  <span className="chat-session-card__copy">
                    <strong>{session.title}</strong>
                    <span>{session.messages.length > 1 ? `${session.messages.length - 1} messages` : 'No messages yet'}</span>
                  </span>
                  <span className="chat-session-card__meta">
                    {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <small>{isOpen ? 'OPEN TAB' : 'SAVED'}</small>
                  </span>
                </button>

                <div className="chat-session-card__actions">
                  {isOpen ? (
                    <button type="button" onClick={() => closeTab(session.id)}>CLOSE</button>
                  ) : (
                    <button type="button" onClick={() => openSession(session.id)}>OPEN</button>
                  )}
                  <button
                    className="chat-session-card__delete"
                    type="button"
                    disabled={isBusy}
                    title={isBusy ? 'Wait for the current Hermes response to finish before deleting this chat.' : 'Delete saved chat'}
                    onClick={() => deleteSession(session.id)}
                  >
                    DELETE
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SettingsWorkspace() {
  const { settings, updateSetting, resetAppearance } = useAppearance()

  return (
    <section className="workspace-stage workspace-stage--interactive" aria-label="Settings workspace">
      <div className="workspace-card workspace-card--settings">
        <div className="workspace-card__heading">
          <div>
            <span className="workspace-placeholder__eyebrow">Appearance control plane</span>
            <h2>Appearance</h2>
            <p>These preferences update the control center live and stay saved in this browser.</p>
          </div>
          <button className="workspace-action workspace-action--quiet" type="button" onClick={resetAppearance}>RESET</button>
        </div>

        <div className="appearance-grid">
          <label className="appearance-control appearance-control--color">
            <span>Accent color</span>
            <input type="color" value={settings.accentColor} onChange={(event) => updateSetting('accentColor', event.target.value)} />
            <output>{settings.accentColor.toUpperCase()}</output>
          </label>

          <label className="appearance-control appearance-control--color">
            <span>Background</span>
            <input type="color" value={settings.backgroundColor} onChange={(event) => updateSetting('backgroundColor', event.target.value)} />
            <output>{settings.backgroundColor.toUpperCase()}</output>
          </label>

          <label className="appearance-control appearance-control--color">
            <span>Panel color</span>
            <input type="color" value={settings.panelColor} onChange={(event) => updateSetting('panelColor', event.target.value)} />
            <output>{settings.panelColor.toUpperCase()}</output>
          </label>

          <label className="appearance-control">
            <span>Panel opacity</span>
            <input type="range" min="0.2" max="0.92" step="0.01" value={settings.panelOpacity} onChange={(event) => updateSetting('panelOpacity', Number(event.target.value))} />
            <output>{Math.round(settings.panelOpacity * 100)}%</output>
          </label>

          <label className="appearance-control">
            <span>Panel blur</span>
            <input type="range" min="0" max="42" step="1" value={settings.panelBlur} onChange={(event) => updateSetting('panelBlur', Number(event.target.value))} />
            <output>{settings.panelBlur}px</output>
          </label>

          <label className="appearance-control">
            <span>Workspace margin</span>
            <input type="range" min="8" max="48" step="1" value={settings.workspaceMargin} onChange={(event) => updateSetting('workspaceMargin', Number(event.target.value))} />
            <output>{settings.workspaceMargin}px</output>
          </label>

          <label className="appearance-control">
            <span>HUD corner cut</span>
            <input type="range" min="6" max="36" step="1" value={settings.cornerCut} onChange={(event) => updateSetting('cornerCut', Number(event.target.value))} />
            <output>{settings.cornerCut}px</output>
          </label>

          <label className="appearance-control">
            <span>Local compute position</span>
            <select
              value={settings.computeHudPosition}
              onChange={(event) => updateSetting('computeHudPosition', event.target.value as 'top-right' | 'bottom-right')}
            >
              <option value="bottom-right">Bottom right</option>
              <option value="top-right">Top right</option>
            </select>
            <output>{settings.computeHudPosition === 'top-right' ? 'TOP' : 'BOTTOM'}</output>
          </label>
        </div>
      </div>
    </section>
  )
}

export function WorkspaceStage({ activeView }: WorkspaceStageProps) {
  if (activeView === 'brain') return <BrainStage />
  if (activeView === 'chat') return <ChatsWorkspace />
  if (activeView === 'settings') return <SettingsWorkspace />

  const copy = viewCopy[activeView]

  return (
    <section className="workspace-stage" aria-label={`${copy.title} workspace`}>
      <div className="workspace-placeholder">
        <span className="workspace-placeholder__eyebrow">{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
        <span className="workspace-placeholder__status">VIEW SCAFFOLD READY</span>
      </div>
    </section>
  )
}
