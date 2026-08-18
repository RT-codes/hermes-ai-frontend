import type { GraphData } from 'react-force-graph-3d'

export type BrainGraphNode = {
  id: string
  label: string
  summary: string
  kind: 'core' | 'memory'
  val: number
  factType?: string
  context?: string
  entities?: string
  occurredAt?: string
  fx?: number
  fy?: number
  fz?: number
}

export type BrainGraphLink = {
  source: string
  target: string
  strength?: number
  relationship?: string
  entity?: string
}

const nodes: BrainGraphNode[] = [
  { id: 'core', label: 'Hermes core', summary: 'Visual anchor for the temporary Rubik core.', kind: 'core', val: 0.1, fx: 0, fy: 0, fz: 0 },
  { id: 'identity', label: 'Household identity', summary: 'Shared household context and user-facing defaults.', kind: 'memory', val: 1.35 },
  { id: 'project', label: 'Hermes project', summary: 'Current architecture, priorities, and implementation direction.', kind: 'memory', val: 1.65 },
  { id: 'frontend', label: 'Frontend direction', summary: 'Control Center UI, HUD styling, interactions, and layout choices.', kind: 'memory', val: 1.35 },
  { id: 'memory', label: 'Memory architecture', summary: 'Persistent Hindsight memory and recall design.', kind: 'memory', val: 1.6 },
  { id: 'hindsight', label: 'Hindsight runtime', summary: 'Local retention and recall service configuration.', kind: 'memory', val: 1.25 },
  { id: 'ollama', label: 'Local model runtime', summary: 'Ollama and Qwen local inference configuration.', kind: 'memory', val: 1.2 },
  { id: 'qwen', label: 'Qwen model', summary: 'Current local reasoning model and context configuration.', kind: 'memory', val: 1.1 },
  { id: 'docker', label: 'Container lifecycle', summary: 'Disposable containers with state outside Docker.', kind: 'memory', val: 1.05 },
  { id: 'hermesctl', label: 'hermesctl lifecycle', summary: 'Safe start, stop, status, and restart orchestration.', kind: 'memory', val: 1.25 },
  { id: 'telemetry', label: 'Runtime telemetry', summary: 'Live CPU, RAM, GPU, VRAM, temperature, and model state.', kind: 'memory', val: 1.2 },
  { id: 'chat', label: 'Chat workspace', summary: 'Persistent multi-chat and streaming Hermes responses.', kind: 'memory', val: 1.15 },
  { id: 'skills', label: 'Skills direction', summary: 'Future graph-visible capabilities and skill inspection.', kind: 'memory', val: 1.15 },
  { id: 'tools', label: 'Tool routing', summary: 'Lazy-loaded tools and future MCP visibility.', kind: 'memory', val: 1.15 },
  { id: 'notion', label: 'Notion tracker', summary: 'Project source of truth and Agile Board workflow.', kind: 'memory', val: 1.0 },
  { id: 'lan', label: 'Household LAN access', summary: 'Planned household-facing network access to Hermes Home.', kind: 'memory', val: 1.0 },
  { id: 'security', label: 'Local security boundary', summary: 'Server-side secrets, local API boundaries, and safe proxies.', kind: 'memory', val: 1.05 },
  { id: 'brain', label: '3D Brain graph', summary: 'Interactive graph for memory, skills, tools, and live activity.', kind: 'memory', val: 1.55 },
]

const links: BrainGraphLink[] = [
  { source: 'core', target: 'project' },
  { source: 'core', target: 'memory' },
  { source: 'core', target: 'frontend' },
  { source: 'core', target: 'ollama' },
  { source: 'project', target: 'frontend' },
  { source: 'project', target: 'memory' },
  { source: 'project', target: 'docker' },
  { source: 'project', target: 'notion' },
  { source: 'frontend', target: 'chat' },
  { source: 'frontend', target: 'telemetry' },
  { source: 'frontend', target: 'brain' },
  { source: 'frontend', target: 'lan' },
  { source: 'memory', target: 'hindsight' },
  { source: 'memory', target: 'identity' },
  { source: 'memory', target: 'brain' },
  { source: 'ollama', target: 'qwen' },
  { source: 'ollama', target: 'telemetry' },
  { source: 'docker', target: 'hermesctl' },
  { source: 'docker', target: 'hindsight' },
  { source: 'hermesctl', target: 'telemetry' },
  { source: 'skills', target: 'tools' },
  { source: 'skills', target: 'brain' },
  { source: 'tools', target: 'brain' },
  { source: 'security', target: 'frontend' },
  { source: 'security', target: 'lan' },
  { source: 'notion', target: 'project' },
]

export function createMockBrainGraph(): GraphData<BrainGraphNode, BrainGraphLink> {
  return {
    nodes: nodes.map((node) => ({ ...node })),
    links: links.map((link) => ({ ...link })),
  }
}
