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

const viewCopy: Record<Exclude<WorkspaceView, 'brain'>, { eyebrow: string; title: string; description: string }> = {
  chat: {
    eyebrow: 'Conversation workspace',
    title: 'Chat',
    description: 'The floating chat console is live. A dedicated conversation layout can grow here later.',
  },
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
  settings: {
    eyebrow: 'Control plane',
    title: 'Settings',
    description: 'Frontend preferences, connection settings, and safe system configuration will live here.',
  },
}

export function WorkspaceStage({ activeView }: WorkspaceStageProps) {
  if (activeView === 'brain') return <BrainStage />

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
