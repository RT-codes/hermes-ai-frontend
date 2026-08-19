import type { GraphData } from 'react-force-graph-3d'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type HindsightNode = {
  data?: { id?: string; label?: string; color?: string }
}

type HindsightEdge = {
  data?: {
    source?: string
    target?: string
    linkType?: string
    entityName?: string
    weight?: number
    similarity?: number
  }
}

type HindsightTableRow = {
  id?: string
  text?: string
  entities?: unknown
  context?: string
  fact_type?: string
  occurred_at?: string
  mentioned_at?: string
  created_at?: string
  [key: string]: unknown
}

type HindsightGraphResponse = {
  nodes?: HindsightNode[]
  edges?: HindsightEdge[]
  table_rows?: HindsightTableRow[]
  total_units?: number
  limit?: number
}

type HindsightBank = {
  bank_id?: string
  id?: string
  name?: string
}

type HindsightBankList = {
  banks?: HindsightBank[]
  items?: HindsightBank[]
}

export type LoadedBrainGraph = {
  bankId: string
  totalUnits: number
  data: GraphData<BrainGraphNode, BrainGraphLink>
}

function compactLabel(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 52) return normalized
  return `${normalized.slice(0, 49)}…`
}

function bankIdentifier(bank: HindsightBank) {
  return bank.bank_id || bank.id || bank.name || ''
}

function normalizeEntities(value: unknown): string | string[] | undefined {
  if (Array.isArray(value)) {
    const entities = value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    return entities.length ? entities : undefined
  }
  if (typeof value !== 'string' || !value.trim()) return undefined

  const trimmed = value.trim()
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      const entities = parsed.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
      if (entities.length) return entities
    }
  } catch {
    // Plain strings are valid in older/local Hindsight graph payloads.
  }
  return trimmed
}

async function discoverBankId(signal?: AbortSignal) {
  const response = await fetch('/hindsight-api/v1/default/banks', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) throw new Error(`Unable to list Hindsight banks (${response.status})`)

  const payload = await response.json() as HindsightBankList
  const banks = payload.banks ?? payload.items ?? []
  if (!banks.length) throw new Error('Hindsight is running, but no memory bank was found.')

  const saved = window.localStorage.getItem('hermes-hindsight-bank')
  const selected = banks.find((bank) => bankIdentifier(bank) === saved)
    ?? banks.find((bank) => /household|hermes|home/i.test(`${bankIdentifier(bank)} ${bank.name ?? ''}`))
    ?? banks[0]

  const id = bankIdentifier(selected)
  if (!id) throw new Error('Hindsight returned a memory bank without an id.')
  window.localStorage.setItem('hermes-hindsight-bank', id)
  return id
}

export async function loadHindsightBrainGraph(signal?: AbortSignal): Promise<LoadedBrainGraph> {
  const bankId = await discoverBankId(signal)
  const response = await fetch(`/hindsight-api/v1/default/banks/${encodeURIComponent(bankId)}/graph?limit=300`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Hindsight graph request failed (${response.status})`)
  }

  const payload = await response.json() as HindsightGraphResponse
  const tableRows = new Map(
    (payload.table_rows ?? [])
      .filter((row): row is HindsightTableRow & { id: string } => typeof row.id === 'string')
      .map((row) => [row.id, row]),
  )

  const memoryNodes: BrainGraphNode[] = (payload.nodes ?? []).flatMap((entry) => {
    const id = entry.data?.id
    if (!id) return []

    const row = tableRows.get(id)
    const text = typeof row?.text === 'string' && row.text.trim() ? row.text.trim() : ''
    const label = text ? compactLabel(text) : (entry.data?.label?.trim() || id.slice(0, 8))

    return [{
      id,
      label,
      summary: text || entry.data?.label || 'Hindsight memory',
      kind: 'memory' as const,
      val: 1.05,
      factType: typeof row?.fact_type === 'string' ? row.fact_type : undefined,
      context: typeof row?.context === 'string' ? row.context : undefined,
      entities: normalizeEntities(row?.entities),
      occurredAt: typeof row?.occurred_at === 'string'
        ? row.occurred_at
        : typeof row?.mentioned_at === 'string'
          ? row.mentioned_at
          : typeof row?.created_at === 'string'
            ? row.created_at
            : undefined,
    }]
  })

  const knownNodeIds = new Set(memoryNodes.map((node) => node.id))
  const links: BrainGraphLink[] = (payload.edges ?? []).flatMap((entry) => {
    const source = entry.data?.source
    const target = entry.data?.target
    if (!source || !target || !knownNodeIds.has(source) || !knownNodeIds.has(target)) return []

    return [{
      source,
      target,
      strength: entry.data?.weight ?? entry.data?.similarity,
      relationship: entry.data?.linkType,
      entity: entry.data?.entityName,
      synthetic: 'memory' as const,
    }]
  })

  const core: BrainGraphNode = {
    id: 'core', label: 'Hermes core', summary: 'Visual anchor for the Hermes thinking core.',
    kind: 'core', val: 0.1, fx: 0, fy: 0, fz: 0,
  }

  return {
    bankId,
    totalUnits: payload.total_units ?? memoryNodes.length,
    data: { nodes: [core, ...memoryNodes], links },
  }
}
