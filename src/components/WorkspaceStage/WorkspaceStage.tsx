import { useState, type CSSProperties } from 'react'
import { useAppearance } from '../../context/AppearanceContext'
import { useChatSessions } from '../../context/ChatSessionsContext'
import { useConnectionSettings } from '../../context/ConnectionSettingsContext'
import { useHermesProfiles } from '../../context/HermesProfileContext'
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

type SettingsTab = 'appearance' | 'graphics' | 'profiles' | 'connection'

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
  const { getProfile, getProfileColor } = useHermesProfiles()

  return (
    <section className="workspace-stage workspace-stage--interactive" aria-label="Chats workspace">
      <div className="workspace-card workspace-card--wide">
        <div className="workspace-card__heading">
          <div>
            <span className="workspace-placeholder__eyebrow">Conversation workspace</span>
            <h2>Chats</h2>
            <p>Persistent profile-bound Hermes conversations. Open chats appear as tabs in the floating chat console.</p>
          </div>
          <button className="workspace-action" type="button" onClick={() => createSession()}>+ NEW CHAT</button>
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
            const profile = getProfile(session.profileId)
            const profileName = profile?.displayName ?? session.profileId
            const profileColor = getProfileColor(session.profileId)

            return (
              <article className="chat-session-card" key={session.id} style={{ '--profile-color': profileColor } as CSSProperties}>
                <button className="chat-session-card__open" type="button" onClick={() => openSession(session.id)}>
                  <span className={`chat-session-card__state chat-session-card__state--${session.connectionState}`} />
                  <span className="chat-session-card__copy">
                    <span className="chat-session-card__profile" title={`Hermes profile: ${session.profileId}`}>
                      <span className="chat-profile-dot" aria-hidden="true" />
                      <strong>{profileName}</strong>
                      <code>{session.profileId}</code>
                    </span>
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

function AppearanceSettings() {
  const { settings, updateSetting } = useAppearance()
  return (
    <div className="appearance-grid">
      <label className="appearance-control">
        <span>Interface scale</span>
        <input type="range" min="0.85" max="1.4" step="0.05" value={settings.interfaceScale} onChange={(event) => updateSetting('interfaceScale', Number(event.target.value))} />
        <output>{Math.round(settings.interfaceScale * 100)}%</output>
      </label>
      <label className="appearance-control">
        <span>Interface font</span>
        <select value={settings.interfaceFont} onChange={(event) => updateSetting('interfaceFont', event.target.value as typeof settings.interfaceFont)}>
          <option value="modern">Modern sans</option>
          <option value="humanist">Humanist</option>
          <option value="technical">Technical</option>
          <option value="mono">Monospace</option>
        </select>
        <output>{settings.interfaceFont.toUpperCase()}</output>
      </label>
      <label className="appearance-control">
        <span>HUD / data font</span>
        <select value={settings.hudFont} onChange={(event) => updateSetting('hudFont', event.target.value as typeof settings.hudFont)}>
          <option value="technical">Technical</option>
          <option value="mono">Monospace</option>
          <option value="modern">Modern sans</option>
        </select>
        <output>{settings.hudFont.toUpperCase()}</output>
      </label>
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
      <label className="appearance-control appearance-control--color">
        <span>Brain HUD color</span>
        <input type="color" value={settings.brainHudColor} onChange={(event) => updateSetting('brainHudColor', event.target.value)} />
        <output>{settings.brainHudColor.toUpperCase()}</output>
      </label>
      <label className="appearance-control">
        <span>Brain HUD opacity</span>
        <input type="range" min="0.25" max="0.96" step="0.01" value={settings.brainHudOpacity} onChange={(event) => updateSetting('brainHudOpacity', Number(event.target.value))} />
        <output>{Math.round(settings.brainHudOpacity * 100)}%</output>
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
        <select value={settings.computeHudPosition} onChange={(event) => updateSetting('computeHudPosition', event.target.value as 'top-right' | 'bottom-right')}>
          <option value="bottom-right">Bottom right</option>
          <option value="top-right">Top right</option>
        </select>
        <output>{settings.computeHudPosition === 'top-right' ? 'TOP' : 'BOTTOM'}</output>
      </label>
    </div>
  )
}

function GraphicsSettings() {
  const { settings, updateSetting } = useAppearance()
  return (
    <div className="appearance-grid">
      <label className="appearance-control">
        <span>Rubik thinking speed</span>
        <input type="range" min="220" max="1800" step="20" value={settings.rubikTurnSpeedMs} onChange={(event) => updateSetting('rubikTurnSpeedMs', Number(event.target.value))} />
        <output>{settings.rubikTurnSpeedMs}ms</output>
      </label>
      <div className="settings-note">
        <strong>Graphics controls</strong>
        <p>Future 3D Brain quality, FPS, effects, and GPU-budget controls belong here. Existing rendering behavior is unchanged.</p>
      </div>
    </div>
  )
}

function ProfilesSettings() {
  const {
    profiles,
    status,
    warning,
    refreshProfiles,
    getProfileColor,
    setProfileColor,
  } = useHermesProfiles()

  return (
    <div className="profiles-settings">
      <div className={`profile-discovery-banner profile-discovery-banner--${status}`}>
        <div>
          <span className="profile-discovery-banner__eyebrow">Hermes profile discovery</span>
          <strong>{status === 'loading' ? 'SCANNING' : status === 'ready' ? 'CONNECTED' : 'DEGRADED'}</strong>
          <p>{warning ?? `${profiles.length} Hermes profile${profiles.length === 1 ? '' : 's'} detected and available to the frontend registry.`}</p>
        </div>
        <button type="button" className="workspace-action workspace-action--quiet" disabled={status === 'loading'} onClick={() => void refreshProfiles()}>
          {status === 'loading' ? 'SCANNING…' : 'REFRESH'}
        </button>
      </div>

      <div className="profiles-grid">
        {profiles.map((profile) => {
          const color = getProfileColor(profile.id)
          return (
            <article className={`profile-settings-card ${profile.available ? '' : 'profile-settings-card--unavailable'}`} key={profile.id} style={{ '--profile-color': color } as React.CSSProperties}>
              <div className="profile-settings-card__identity">
                <span className="profile-settings-card__swatch" aria-hidden="true" />
                <div>
                  <strong>{profile.displayName}</strong>
                  <code>{profile.id}</code>
                </div>
              </div>
              <div className="profile-settings-card__flags">
                {profile.isDefault && <span>DEFAULT</span>}
                <span className={profile.available ? 'is-available' : 'is-unavailable'}>{profile.available ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
              </div>
              <label className="profile-color-control">
                <span>Profile color</span>
                <input type="color" value={color} onChange={(event) => setProfileColor(profile.id, event.target.value)} />
                <output>{color}</output>
              </label>
              <p className="profile-settings-card__note">Shared identity color for chat, Hermes Insight, Brain filters, skills and future control-center surfaces.</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function ConnectionSettings() {
  const { settings, updateSetting } = useConnectionSettings()
  return (
    <div className="connection-grid">
      <label className="connection-control">
        <span>Hermes API base path</span>
        <input value={settings.apiBasePath} onChange={(event) => updateSetting('apiBasePath', event.target.value)} spellCheck={false} />
        <small>Default: /hermes-api</small>
      </label>
      <label className="connection-control">
        <span>API model</span>
        <input value={settings.model} onChange={(event) => updateSetting('model', event.target.value)} spellCheck={false} />
        <small>Logical model name sent to the Hermes gateway.</small>
      </label>
      <label className="connection-control">
        <span>Request timeout</span>
        <input type="number" min="10" max="1800" step="10" value={Math.round(settings.requestTimeoutMs / 1000)} onChange={(event) => updateSetting('requestTimeoutMs', Number(event.target.value) * 1000)} />
        <small>{Math.round(settings.requestTimeoutMs / 1000)} seconds</small>
      </label>
      <div className="settings-note settings-note--wide">
        <strong>Connection boundary</strong>
        <p>Chat and runtime health checks consume this shared configuration instead of hardcoded component values. Sensitive credentials are intentionally not exposed here.</p>
      </div>
    </div>
  )
}

function SettingsWorkspace() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const { resetAppearance } = useAppearance()
  const { resetConnection } = useConnectionSettings()
  const { resetProfileColors } = useHermesProfiles()

  const resetActiveSettings = () => {
    if (activeTab === 'connection') resetConnection()
    else if (activeTab === 'profiles') resetProfileColors()
    else resetAppearance()
  }

  return (
    <section className="workspace-stage workspace-stage--interactive" aria-label="Settings workspace">
      <div className="workspace-card workspace-card--settings">
        <div className="workspace-card__heading">
          <div>
            <span className="workspace-placeholder__eyebrow">Control center settings</span>
            <h2>Settings</h2>
            <p>Appearance, rendering behavior, Hermes profiles, and the frontend connection boundary are configured here.</p>
          </div>
          <button className="workspace-action workspace-action--quiet" type="button" onClick={resetActiveSettings}>RESET</button>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {(['appearance', 'graphics', 'profiles', 'connection'] as SettingsTab[]).map((tab) => (
            <button className={activeTab === tab ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)}>
              {tab === 'connection' ? 'CONNECTION DETAILS' : tab.toUpperCase()}
            </button>
          ))}
        </div>

        {activeTab === 'appearance' && <AppearanceSettings />}
        {activeTab === 'graphics' && <GraphicsSettings />}
        {activeTab === 'profiles' && <ProfilesSettings />}
        {activeTab === 'connection' && <ConnectionSettings />}
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
