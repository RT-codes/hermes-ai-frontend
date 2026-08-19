import type { GraphData } from 'react-force-graph-3d'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

export type BrainLodLevel = 'overview' | 'cluster' | 'detail'
export type BrainLodMode = 'auto' | 'overview' | 'detail'

export type BrainCluster = {
  id: string
  label: string
  memberIds: string[]
  memberCount: number
  prominence: number
  anchor: { x: number; y: number; z: number }
}

export type BrainLodModel = {
  data: GraphData<BrainGraphNode, BrainGraphLink>
  clusters: BrainCluster[]
  clusterByNodeId: Map<string, string>
  representativeNodeIds: Set<string>
}

function normalizeLabel(value: string) {
  return value
    .replace(/[\[\]{}"']/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.length <= 3 ? word.toUpperCase() : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ')
}

function parseEntityCandidates(value?: string | string[]) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(normalizeLabel).filter(Boolean)

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => typeof entry === 'string' ? normalizeLabel(entry) : '')
        .filter(Boolean)
    }
  } catch {
    // Hindsight installations have returned both plain strings and serialized arrays.
  }

  return trimmed
    .split(/[,;|]/g)
    .map(normalizeLabel)
    .filter(Boolean)
}

function rawClusterLabel(node: BrainGraphNode) {
  const entity = parseEntityCandidates(node.entities)[0]
  if (entity) return titleCase(entity)

  const context = normalizeLabel(node.context ?? '')
  if (context && context.length <= 44) return titleCase(context)

  const factType = normalizeLabel(node.factType ?? '')
  if (factType) return titleCase(factType)

  return 'Other Memories'
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function fibonacciAnchor(index: number, total: number, radius: number, label: string) {
  if (total <= 1) return { x: 0, y: 0, z: 0 }
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const jitter = (stableHash(label) % 997) / 997
  const y = 1 - (index / Math.max(1, total - 1)) * 2
  const radial = Math.sqrt(Math.max(0, 1 - y * y))
  const angle = goldenAngle * (index + jitter * 0.35)
  return {
    x: Math.cos(angle) * radial * radius,
    y: y * radius * 0.64,
    z: Math.sin(angle) * radial * radius,
  }
}

function memberAnchor(
  nodeId: string,
  memberIndex: number,
  memberCount: number,
  clusterAnchor: { x: number; y: number; z: number },
  layoutRadius: number,
  relativeMass: number,
) {
  if (memberCount <= 1) return { ...clusterAnchor }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  const hash = stableHash(nodeId)
  const jitter = (hash % 1009) / 1009
  const normalizedIndex = (memberIndex + 0.5) / memberCount
  const y = 1 - normalizedIndex * 2
  const radial = Math.sqrt(Math.max(0, 1 - y * y))
  const angle = goldenAngle * (memberIndex + jitter * 0.7)

  // Scale the local cloud from the actual overview layout and cluster mass.
  // This keeps a growing bank proportional instead of relying on one fixed
  // world-space radius that only happens to look right at today's graph size.
  const cloudRadius = Math.max(12, layoutRadius * 0.075)
    * (0.72 + Math.sqrt(Math.max(0.04, relativeMass)) * 0.88)
  const shell = cloudRadius * (0.52 + Math.pow(normalizedIndex, 0.72) * 0.62)

  return {
    x: clusterAnchor.x + Math.cos(angle) * radial * shell,
    y: clusterAnchor.y + y * shell * 0.7,
    z: clusterAnchor.z + Math.sin(angle) * radial * shell,
  }
}

function endpointId(value: BrainGraphLink['source'] | BrainGraphLink['target']) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return String(value.id)
  return ''
}

export function buildBrainLodModel(rawData: GraphData<BrainGraphNode, BrainGraphLink>): BrainLodModel {
  const memoryNodes = rawData.nodes.filter((node) => node.kind === 'memory')
  const desiredClusterCount = Math.max(4, Math.min(18, Math.round(Math.sqrt(Math.max(1, memoryNodes.length)))))

  const rawGroups = new Map<string, BrainGraphNode[]>()
  memoryNodes.forEach((node) => {
    const label = rawClusterLabel(node)
    const key = label.toLocaleLowerCase()
    const bucket = rawGroups.get(key) ?? []
    bucket.push(node)
    rawGroups.set(key, bucket)
  })

  const orderedGroups = [...rawGroups.entries()]
    .map(([key, nodes]) => ({ key, label: rawClusterLabel(nodes[0]), nodes }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.label.localeCompare(b.label))

  const kept = orderedGroups.slice(0, Math.max(1, desiredClusterCount - 1))
  const overflow = orderedGroups.slice(Math.max(1, desiredClusterCount - 1)).flatMap((group) => group.nodes)
  if (overflow.length) kept.push({ key: '__other__', label: 'Other Memories', nodes: overflow })

  const maxCount = Math.max(1, ...kept.map((group) => group.nodes.length))
  const layoutRadius = Math.max(105, Math.cbrt(Math.max(8, memoryNodes.length)) * 58)
    * (1 + Math.log2(Math.max(2, kept.length)) * 0.055)

  const clusters: BrainCluster[] = kept.map((group, index) => {
    const prominence = Math.sqrt(group.nodes.length / maxCount)
    const id = `cluster:${group.key}`
    return {
      id,
      label: group.label,
      memberIds: group.nodes.map((node) => node.id),
      memberCount: group.nodes.length,
      prominence,
      anchor: fibonacciAnchor(index, kept.length, layoutRadius, group.label),
    }
  })

  const clusterByNodeId = new Map<string, string>()
  clusters.forEach((cluster) => cluster.memberIds.forEach((nodeId) => clusterByNodeId.set(nodeId, cluster.id)))

  const degree = new Map<string, number>()
  rawData.links.forEach((link) => {
    const source = endpointId(link.source)
    const target = endpointId(link.target)
    degree.set(source, (degree.get(source) ?? 0) + 1)
    degree.set(target, (degree.get(target) ?? 0) + 1)
  })

  const representativeNodeIds = new Set<string>()
  clusters.forEach((cluster) => {
    const adaptiveCount = Math.max(3, Math.min(cluster.memberCount, Math.round(3 + Math.sqrt(cluster.memberCount) * 1.7)))
    cluster.memberIds
      .map((id) => memoryNodes.find((node) => node.id === id))
      .filter((node): node is BrainGraphNode => Boolean(node))
      .sort((a, b) => {
        const degreeDelta = (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)
        if (degreeDelta) return degreeDelta
        return String(b.occurredAt ?? '').localeCompare(String(a.occurredAt ?? ''))
      })
      .slice(0, adaptiveCount)
      .forEach((node) => representativeNodeIds.add(node.id))
  })

  const clusterNodes: BrainGraphNode[] = clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    summary: `${cluster.memberCount} memories grouped around ${cluster.label}.`,
    kind: 'cluster',
    val: 1 + cluster.prominence * 4.5,
    clusterId: cluster.id,
    memberCount: cluster.memberCount,
    prominence: cluster.prominence,
    fx: cluster.anchor.x,
    fy: cluster.anchor.y,
    fz: cluster.anchor.z,
  }))

  const aggregateMap = new Map<string, { source: string; target: string; count: number }>()
  rawData.links.forEach((link) => {
    const source = endpointId(link.source)
    const target = endpointId(link.target)
    const sourceCluster = clusterByNodeId.get(source)
    const targetCluster = clusterByNodeId.get(target)
    if (!sourceCluster || !targetCluster || sourceCluster === targetCluster) return
    const [a, b] = sourceCluster < targetCluster ? [sourceCluster, targetCluster] : [targetCluster, sourceCluster]
    const key = `${a}>${b}`
    const current = aggregateMap.get(key) ?? { source: a, target: b, count: 0 }
    current.count += 1
    aggregateMap.set(key, current)
  })

  const aggregateLinks: BrainGraphLink[] = [...aggregateMap.values()].map((entry) => ({
    source: entry.source,
    target: entry.target,
    synthetic: 'aggregate',
    aggregateCount: entry.count,
    strength: entry.count,
  }))

  const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]))
  const clusterMemberIndex = new Map<string, number>()
  clusters.forEach((cluster) => cluster.memberIds.forEach((nodeId, index) => clusterMemberIndex.set(nodeId, index)))

  const decoratedMemoryNodes = memoryNodes.map((node) => {
    const clusterId = clusterByNodeId.get(node.id)
    const cluster = clusterId ? clusterById.get(clusterId) : undefined
    if (!cluster) return { ...node }

    const anchor = memberAnchor(
      node.id,
      clusterMemberIndex.get(node.id) ?? 0,
      cluster.memberCount,
      cluster.anchor,
      layoutRadius,
      cluster.memberCount / maxCount,
    )

    return {
      ...node,
      clusterId,
      fx: anchor.x,
      fy: anchor.y,
      fz: anchor.z,
    }
  })

  const otherNodes = rawData.nodes.filter((node) => node.kind !== 'memory')
  const rawLinks = rawData.links.map((link) => ({ ...link, synthetic: link.synthetic ?? 'memory' as const }))

  return {
    data: {
      nodes: [...otherNodes, ...decoratedMemoryNodes, ...clusterNodes],
      // Membership is represented by deterministic spatial placement rather
      // than another force link. This avoids fighting Hindsight's real memory
      // relationships and keeps overview/detail locations coherent.
      links: [...rawLinks, ...aggregateLinks],
    },
    clusters,
    clusterByNodeId,
    representativeNodeIds,
  }
}

export function chooseAutomaticLod(current: BrainLodLevel, _cameraDistance: number, _graphExtent: number) {
  // Automatic zoom-driven switching is intentionally paused while the LOD
  // model is being validated against real growing banks. Camera movement must
  // not change representation underneath the user during this test pass.
  return current
}

export function resolveLodLevel(mode: BrainLodMode, automatic: BrainLodLevel): BrainLodLevel {
  // Reuse the existing three button states as explicit manual views for now:
  // AUTO state = overview, OVERVIEW state = cluster, DETAIL state = detail.
  // The button label itself displays the resolved view via data-lod styling.
  if (mode === 'overview') return 'cluster'
  if (mode === 'detail') return 'detail'
  return automatic
}
