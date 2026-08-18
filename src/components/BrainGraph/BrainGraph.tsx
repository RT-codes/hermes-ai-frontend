import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods, GraphData, LinkObject, NodeObject } from 'react-force-graph-3d'
import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import { loadHindsightBrainGraph } from './hindsightGraph'
import { createMockBrainGraph } from './mockBrainGraph'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type Point = { x: number; y: number }
type LinkEndpoint = string | number | GraphNode | undefined

type BrainGraphProps = {
  onCorePointChange: (point: Point) => void
}

type GraphNode = NodeObject<BrainGraphNode>
type GraphLink = LinkObject<BrainGraphNode, BrainGraphLink>
type GraphSource = 'loading' | 'hindsight' | 'fallback' | 'error'
type StrengthForce = { strength: (value: number) => unknown }
type DistanceForce = { distance: (value: number) => unknown }

const AUTO_SYNC_MS = 20_000
const INSPECTOR_ENTRY_DELAY_MS = 170

function endpointId(endpoint: LinkEndpoint) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  return endpoint?.id == null ? '' : String(endpoint.id)
}

function isDirectLink(link: GraphLink, nodeId: string | null) {
  if (!nodeId) return false
  return endpointId(link.source as LinkEndpoint) === nodeId || endpointId(link.target as LinkEndpoint) === nodeId
}

function createNeuralSphere(
  node: GraphNode,
  emphasized: boolean,
  faded: boolean,
  selected: boolean,
  inspecting: boolean,
) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  // Keep Phase 1's visual scale almost intact. The previous Phase 2 tuning made
  // both the nodes and layout too extreme, which could push the graph out of a
  // useful visible range after zoom-to-fit.
  const baseRadius = 3.55 + Math.max(0, Number(node.val ?? 1)) * 1.32
  const inspectionScale = !inspecting || selected ? 1 : emphasized ? 0.92 : 0.84
  const radius = baseRadius * inspectionScale
  const group = new Group()
  const phase = Math.random() * Math.PI * 2

  const body = new Mesh(
    new SphereGeometry(radius, 22, 16),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: faded ? 0.08 : emphasized ? 0.72 : 0.34,
      depthWrite: false,
    }),
  )

  const halo = new Mesh(
    new SphereGeometry(radius * 1.5, 18, 12),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: faded ? 0.015 : emphasized ? 0.2 : 0.07,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )

  group.add(halo)
  group.add(body)
  group.onBeforeRender = () => {
    const pulse = 1 + Math.sin(performance.now() / 820 + phase) * (emphasized ? 0.1 : 0.055)
    halo.scale.setScalar(pulse)
  }

  return group
}

function formatDate(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function BrainGraph({ onCorePointChange }: BrainGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<BrainGraphNode, BrainGraphLink> | undefined>(undefined)
  const initialFitDone = useRef(false)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [graphData, setGraphData] = useState<GraphData<BrainGraphNode, BrainGraphLink>>(() => createMockBrainGraph())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [source, setSource] = useState<GraphSource>('loading')
  const [bankId, setBankId] = useState<string>('—')
  const [totalUnits, setTotalUnits] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [inspectorVisible, setInspectorVisible] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const measure = () => {
      const rect = host.getBoundingClientRect()
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setSource('loading')
    setLoadError(null)

    loadHindsightBrainGraph(controller.signal)
      .then((loaded) => {
        setGraphData(loaded.data)
        setBankId(loaded.bankId)
        setTotalUnits(loaded.totalUnits)
        setSelectedNodeId(null)
        setHoveredNodeId(null)
        setSource('hindsight')
        initialFitDone.current = false
        window.setTimeout(() => graphRef.current?.d3ReheatSimulation(), 0)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setGraphData(createMockBrainGraph())
        setBankId('mock fallback')
        setTotalUnits(0)
        setLoadError(error instanceof Error ? error.message : 'Unable to load Hindsight graph.')
        setSource('fallback')
        initialFitDone.current = false
      })

    return () => controller.abort()
  }, [refreshToken])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    // Only a mild nudge away from the Phase 1 defaults. Enough to loosen dense
    // clusters without exploding the graph's bounding box.
    const charge = graph.d3Force('charge') as StrengthForce | undefined
    const link = graph.d3Force('link') as DistanceForce | undefined
    charge?.strength(-55)
    link?.distance(38)
    graph.d3ReheatSimulation()
  }, [graphData])

  useEffect(() => {
    if (selectedNodeId) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRefreshToken((value) => value + 1)
      }
    }, AUTO_SYNC_MS)
    return () => window.clearInterval(timer)
  }, [selectedNodeId])

  useEffect(() => {
    let timer: number | undefined
    if (selectedNodeId) {
      document.documentElement.classList.add('brain-is-inspecting')
      timer = window.setTimeout(() => setInspectorVisible(true), INSPECTOR_ENTRY_DELAY_MS)
    } else {
      setInspectorVisible(false)
      document.documentElement.classList.remove('brain-is-inspecting')
    }

    return () => {
      if (timer) window.clearTimeout(timer)
      if (!selectedNodeId) document.documentElement.classList.remove('brain-is-inspecting')
    }
  }, [selectedNodeId])

  useEffect(() => () => document.documentElement.classList.remove('brain-is-inspecting'), [])

  const publishCorePoint = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const point = graph.graph2ScreenCoords(0, 0, 0)
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      onCorePointChange({ x: point.x, y: point.y })
    }
  }, [onCorePointChange])

  useEffect(() => {
    const timer = window.setInterval(publishCorePoint, 80)
    return () => window.clearInterval(timer)
  }, [publishCorePoint])

  const highlightedNodeIds = useMemo(() => {
    const activeId = selectedNodeId ?? hoveredNodeId
    const highlighted = new Set<string>()
    if (!activeId) return highlighted

    highlighted.add(activeId)
    graphData.links.forEach((link) => {
      const typedLink = link as GraphLink
      const sourceId = endpointId(typedLink.source as LinkEndpoint)
      const targetId = endpointId(typedLink.target as LinkEndpoint)
      if (sourceId === activeId) highlighted.add(targetId)
      if (targetId === activeId) highlighted.add(sourceId)
    })
    return highlighted
  }, [graphData.links, hoveredNodeId, selectedNodeId])

  const createNodeObject = useCallback((node: GraphNode) => {
    const id = String(node.id)
    const emphasized = highlightedNodeIds.has(id)
    const faded = Boolean(selectedNodeId) && !emphasized
    const selected = id === selectedNodeId
    return createNeuralSphere(node, emphasized, faded, selected, Boolean(selectedNodeId))
  }, [highlightedNodeIds, selectedNodeId])

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === selectedNodeId) as BrainGraphNode | undefined,
    [graphData.nodes, selectedNodeId],
  )

  function resetView() {
    setSelectedNodeId(null)
    graphRef.current?.zoomToFit(520, 190, (node) => node.kind !== 'core')
  }

  function refreshGraph() {
    if (source !== 'loading') setRefreshToken((value) => value + 1)
  }

  const activeNodeId = selectedNodeId ?? hoveredNodeId
  const memoryCount = graphData.nodes.filter((node) => node.kind !== 'core').length

  return (
    <div className="brain-graph" ref={hostRef} onDoubleClick={resetView}>
      <ForceGraph3D<BrainGraphNode, BrainGraphLink>
        ref={graphRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        controlType="orbit"
        showNavInfo={false}
        nodeVisibility={(node) => node.kind !== 'core'}
        nodeLabel={(node) => `<strong>${node.label}</strong><br/><span>${node.summary}</span>`}
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}
        linkColor={(link) => {
          if (selectedNodeId && !isDirectLink(link as GraphLink, selectedNodeId)) return 'rgba(53,217,255,0.045)'
          return isDirectLink(link as GraphLink, activeNodeId) ? 'rgba(53,217,255,0.9)' : 'rgba(53,217,255,0.22)'
        }}
        linkOpacity={0.5}
        linkWidth={(link) => isDirectLink(link as GraphLink, activeNodeId) ? 1.25 : 0.22}
        linkDirectionalParticles={(link) => isDirectLink(link as GraphLink, selectedNodeId) ? 2 : 0}
        linkDirectionalParticleColor={() => '#72e7ff'}
        linkDirectionalParticleWidth={1.25}
        linkDirectionalParticleSpeed={0.0045}
        d3AlphaDecay={0.022}
        d3VelocityDecay={0.42}
        cooldownTicks={180}
        warmupTicks={70}
        onEngineTick={publishCorePoint}
        onEngineStop={() => {
          publishCorePoint()
          if (!initialFitDone.current) {
            initialFitDone.current = true
            graphRef.current?.zoomToFit(700, 190, (node) => node.kind !== 'core')
          }
        }}
        onNodeHover={(node) => setHoveredNodeId(node?.id == null ? null : String(node.id))}
        onNodeClick={(node) => setSelectedNodeId((current) => current === String(node.id) ? null : String(node.id))}
        onBackgroundClick={() => setSelectedNodeId(null)}
        enableNodeDrag
        enableNavigationControls
      />

      <div className={`brain-graph__phase-label is-${source}`}>
        <span>{source === 'hindsight' ? `HINDSIGHT · ${bankId}` : source === 'loading' ? 'HINDSIGHT · LOADING' : 'MOCK FALLBACK'}</span>
        <strong>{memoryCount} / {totalUnits || memoryCount} NODES</strong>
      </div>

      <button
        className="brain-graph__test-add"
        type="button"
        onClick={refreshGraph}
        disabled={source === 'loading'}
        title="Reload the current Hindsight graph snapshot. Read-only; this does not change memory."
      >
        {source === 'loading' ? 'SYNCING…' : '↻ SYNC GRAPH'}
      </button>

      {activeNodeId && (
        <div className="brain-graph__selection-label">
          {selectedNodeId ? 'SELECTED' : 'HOVER'} · {graphData.nodes.find((node) => String(node.id) === activeNodeId)?.label}
        </div>
      )}

      {loadError && <div className="brain-graph__load-error">READ-ONLY FALLBACK · {loadError}</div>}

      {selectedNode && inspectorVisible && (
        <aside className="brain-memory-inspector" aria-label="Selected memory">
          <div className="brain-memory-inspector__surface" />
          <header className="brain-memory-inspector__header">
            <div>
              <span>MEMORY INSPECTOR</span>
              <strong>{selectedNode.factType || 'memory'}</strong>
            </div>
            <button type="button" onClick={() => setSelectedNodeId(null)} aria-label="Close memory inspector">×</button>
          </header>
          <div className="brain-memory-inspector__content">
            <p className="brain-memory-inspector__memory">{selectedNode.summary}</p>
            <dl>
              <div><dt>BANK</dt><dd>{bankId}</dd></div>
              <div><dt>MEMORY ID</dt><dd>{selectedNode.id}</dd></div>
              <div><dt>WHEN</dt><dd>{formatDate(selectedNode.occurredAt)}</dd></div>
              {selectedNode.context && <div><dt>CONTEXT</dt><dd>{selectedNode.context}</dd></div>}
              {selectedNode.entities && <div><dt>ENTITIES</dt><dd>{selectedNode.entities}</dd></div>}
            </dl>
            <div className="brain-memory-inspector__hint">Read-only inspection · no memory is written or changed from this view.</div>
          </div>
        </aside>
      )}
    </div>
  )
}
