import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods, GraphData, LinkObject, NodeObject } from 'react-force-graph-3d'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { loadHindsightBrainGraph } from './hindsightGraph'
import { createMockBrainGraph } from './mockBrainGraph'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type Point = { x: number; y: number }
type ViewRotation = { yaw: number; pitch: number }
type LinkEndpoint = string | number | GraphNode | undefined

type BrainGraphProps = {
  onCorePointChange: (point: Point) => void
  onViewRotationChange?: (rotation: ViewRotation) => void
}

type GraphNode = NodeObject<BrainGraphNode>
type GraphLink = LinkObject<BrainGraphNode, BrainGraphLink>
type GraphSource = 'loading' | 'hindsight' | 'fallback' | 'error'
type OrbitControlsLike = {
  target?: { x: number; y: number; z: number }
  minPolarAngle?: number
  maxPolarAngle?: number
}
type CameraLike = { position: { x: number; y: number; z: number } }

const AUTO_SYNC_MS = 20_000
const INSPECTOR_ENTRY_DELAY_MS = 170
const MAX_HIGHLIGHT_HOPS = 4
const GRID_Y = -92

function endpointId(endpoint: LinkEndpoint) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  return endpoint?.id == null ? '' : String(endpoint.id)
}

function isDirectLink(link: GraphLink, nodeId: string | null) {
  if (!nodeId) return false
  return endpointId(link.source as LinkEndpoint) === nodeId || endpointId(link.target as LinkEndpoint) === nodeId
}

function linkHash(link: GraphLink) {
  const key = `${endpointId(link.source as LinkEndpoint)}>${endpointId(link.target as LinkEndpoint)}`
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return (hash % 997) / 997
}

function createNeuralSphere(node: GraphNode, intensity: number, selected: boolean, inspecting: boolean) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const baseRadius = 3.8 + Math.max(0, Number(node.val ?? 1)) * 1.45
  const scale = !inspecting || selected ? 1 : 0.9 + intensity * 0.07
  const radius = baseRadius * scale
  const bodyOpacity = selected ? 1 : inspecting ? 0.22 + intensity * 0.56 : 0.34 + intensity * 0.28
  const haloOpacity = selected ? 0.28 : inspecting ? 0.025 + intensity * 0.15 : 0.07 + intensity * 0.1
  const group = new Group()
  const phase = Math.random() * Math.PI * 2

  const body = new Mesh(
    new SphereGeometry(radius, 22, 16),
    new MeshBasicMaterial({
      color: accent,
      transparent: !selected,
      opacity: bodyOpacity,
      depthWrite: selected,
    }),
  )

  const halo = new Mesh(
    new SphereGeometry(radius * 1.5, 18, 12),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: haloOpacity,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )

  group.add(halo)
  group.add(body)
  group.onBeforeRender = () => {
    const pulseAmount = selected ? 0.1 : 0.035 + intensity * 0.04
    const pulse = 1 + Math.sin(performance.now() / 900 + phase) * pulseAmount
    halo.scale.setScalar(pulse)
  }

  return group
}

function formatDate(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function buildHopDistances(links: GraphData<BrainGraphNode, BrainGraphLink>['links'], selectedNodeId: string | null) {
  const distances = new Map<string, number>()
  if (!selectedNodeId) return distances

  const adjacency = new Map<string, Set<string>>()
  links.forEach((rawLink) => {
    const link = rawLink as GraphLink
    const source = endpointId(link.source as LinkEndpoint)
    const target = endpointId(link.target as LinkEndpoint)
    if (!source || !target || source === 'core' || target === 'core') return
    if (!adjacency.has(source)) adjacency.set(source, new Set())
    if (!adjacency.has(target)) adjacency.set(target, new Set())
    adjacency.get(source)?.add(target)
    adjacency.get(target)?.add(source)
  })

  distances.set(selectedNodeId, 0)
  let frontier = [selectedNodeId]
  for (let depth = 1; depth <= MAX_HIGHLIGHT_HOPS && frontier.length > 0; depth += 1) {
    const next: string[] = []
    frontier.forEach((nodeId) => {
      adjacency.get(nodeId)?.forEach((neighbourId) => {
        if (distances.has(neighbourId)) return
        distances.set(neighbourId, depth)
        next.push(neighbourId)
      })
    })
    frontier = next
  }

  return distances
}

export function BrainGraph({ onCorePointChange, onViewRotationChange }: BrainGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<BrainGraphNode, BrainGraphLink> | undefined>(undefined)
  const initialFitDone = useRef(false)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [graphData, setGraphData] = useState<GraphData<BrainGraphNode, BrainGraphLink>>(() => createMockBrainGraph())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const [pointerPoint, setPointerPoint] = useState<Point | null>(null)
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
    if (selectedNodeId) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRefreshToken((value) => value + 1)
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

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    const scene = graph.scene()
    const controls = graph.controls() as OrbitControlsLike
    controls.minPolarAngle = 0.16
    controls.maxPolarAngle = Math.PI / 2 - 0.07

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
    const gridMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { gridColor: { value: new Color(accent) } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 gridColor;
        varying vec2 vUv;
        void main() {
          vec2 scaled = vUv * 46.0;
          vec2 grid = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), vec2(0.0001));
          float line = 1.0 - min(min(grid.x, grid.y), 1.0);
          float radial = distance(vUv, vec2(0.5));
          float fade = 1.0 - smoothstep(0.08, 0.7, radial);
          gl_FragColor = vec4(gridColor, line * fade * 0.18);
        }
      `,
    })
    const gridGeometry = new PlaneGeometry(1500, 1500)
    const gridPlane = new Mesh(gridGeometry, gridMaterial)
    gridPlane.name = 'hermes-brain-ground-grid'
    gridPlane.rotation.x = -Math.PI / 2
    gridPlane.position.y = GRID_Y
    gridPlane.renderOrder = -2
    scene.add(gridPlane)

    return () => {
      scene.remove(gridPlane)
      gridGeometry.dispose()
      gridMaterial.dispose()
    }
  }, [size.width, size.height])

  const hoveredNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === hoveredNodeId) as GraphNode | undefined,
    [graphData.nodes, hoveredNodeId],
  )

  const publishViewState = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return

    const point = graph.graph2ScreenCoords(0, 0, 0)
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) onCorePointChange({ x: point.x, y: point.y })

    if (hoveredNode && Number.isFinite(hoveredNode.x) && Number.isFinite(hoveredNode.y) && Number.isFinite(hoveredNode.z)) {
      const projected = graph.graph2ScreenCoords(hoveredNode.x as number, hoveredNode.y as number, hoveredNode.z as number)
      if (Number.isFinite(projected.x) && Number.isFinite(projected.y)) setHoverPoint(projected)
    } else if (hoverPoint) {
      setHoverPoint(null)
    }

    if (onViewRotationChange) {
      const camera = graph.camera() as CameraLike
      const controls = graph.controls() as OrbitControlsLike
      const target = controls.target ?? { x: 0, y: 0, z: 0 }
      const dx = camera.position.x - target.x
      const dy = camera.position.y - target.y
      const dz = camera.position.z - target.z
      const horizontal = Math.max(0.0001, Math.hypot(dx, dz))
      onViewRotationChange({
        yaw: Math.atan2(dx, dz) * 180 / Math.PI,
        pitch: Math.atan2(dy, horizontal) * 180 / Math.PI,
      })
    }
  }, [hoverPoint, hoveredNode, onCorePointChange, onViewRotationChange])

  useEffect(() => {
    const timer = window.setInterval(publishViewState, 80)
    return () => window.clearInterval(timer)
  }, [publishViewState])

  const hopDistances = useMemo(
    () => buildHopDistances(graphData.links, selectedNodeId),
    [graphData.links, selectedNodeId],
  )

  const hoverNeighbourIds = useMemo(() => {
    const ids = new Set<string>()
    if (!hoveredNodeId || selectedNodeId) return ids
    ids.add(hoveredNodeId)
    graphData.links.forEach((rawLink) => {
      const link = rawLink as GraphLink
      const sourceId = endpointId(link.source as LinkEndpoint)
      const targetId = endpointId(link.target as LinkEndpoint)
      if (sourceId === hoveredNodeId) ids.add(targetId)
      if (targetId === hoveredNodeId) ids.add(sourceId)
    })
    return ids
  }, [graphData.links, hoveredNodeId, selectedNodeId])

  const createNodeObject = useCallback((node: GraphNode) => {
    const id = String(node.id)
    const distance = hopDistances.get(id)
    const selected = distance === 0
    const intensity = selectedNodeId
      ? distance == null ? 0 : Math.max(0, 1 - distance / (MAX_HIGHLIGHT_HOPS + 1))
      : hoverNeighbourIds.has(id) ? (id === hoveredNodeId ? 1 : 0.62) : 0
    return createNeuralSphere(node, intensity, selected, Boolean(selectedNodeId))
  }, [hopDistances, hoverNeighbourIds, hoveredNodeId, selectedNodeId])

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === selectedNodeId) as BrainGraphNode | undefined,
    [graphData.nodes, selectedNodeId],
  )

  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) return []

    return graphData.links
      .map((link) => link as GraphLink)
      .filter((link) => isDirectLink(link, selectedNodeId))
      .map((link) => {
        const sourceId = endpointId(link.source as LinkEndpoint)
        const targetId = endpointId(link.target as LinkEndpoint)
        const neighbourId = sourceId === selectedNodeId ? targetId : sourceId
        const neighbour = graphData.nodes.find((node) => String(node.id) === neighbourId) as BrainGraphNode | undefined
        const relationship = (link as BrainGraphLink).relationship || (link as BrainGraphLink).entity || 'related'
        return {
          id: neighbourId,
          label: neighbour?.label || neighbour?.summary || neighbourId,
          relationship,
        }
      })
      .filter((connection) => connection.id && connection.id !== 'core')
  }, [graphData.links, graphData.nodes, selectedNodeId])

  const linkDepth = useCallback((link: GraphLink) => {
    if (!selectedNodeId) return isDirectLink(link, hoveredNodeId) ? 0 : null
    const sourceDepth = hopDistances.get(endpointId(link.source as LinkEndpoint))
    const targetDepth = hopDistances.get(endpointId(link.target as LinkEndpoint))
    if (sourceDepth == null && targetDepth == null) return null
    return Math.min(sourceDepth ?? MAX_HIGHLIGHT_HOPS + 1, targetDepth ?? MAX_HIGHLIGHT_HOPS + 1)
  }, [hopDistances, hoveredNodeId, selectedNodeId])

  function fitGraph() {
    graphRef.current?.zoomToFit(420, 120, (node) => node.kind !== 'core')
  }

  function resetView() {
    setSelectedNodeId(null)
    fitGraph()
  }

  function refreshGraph() {
    if (source !== 'loading') setRefreshToken((value) => value + 1)
  }

  function selectConnectedMemory(nodeId: string) {
    setHoveredNodeId(null)
    setSelectedNodeId(nodeId)
  }

  const memoryCount = graphData.nodes.filter((node) => node.kind !== 'core').length
  const hoverOverlayPoint = hoverPoint ? { x: hoverPoint.x, y: Math.max(86, hoverPoint.y - 44) } : null

  return (
    <div
      className="brain-graph"
      ref={hostRef}
      onDoubleClick={resetView}
      onPointerMove={(event) => {
        const rect = hostRef.current?.getBoundingClientRect()
        if (!rect) return
        setPointerPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      }}
    >
      <ForceGraph3D<BrainGraphNode, BrainGraphLink>
        ref={graphRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        controlType="orbit"
        showNavInfo={false}
        nodeVisibility={(node) => node.kind !== 'core'}
        nodeLabel={() => ''}
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}
        linkColor={(rawLink) => {
          const depth = linkDepth(rawLink as GraphLink)
          if (depth == null) return selectedNodeId ? 'rgba(53,217,255,0.04)' : 'rgba(53,217,255,0.2)'
          const alpha = depth === 0 ? 0.68 : depth === 1 ? 0.44 : depth === 2 ? 0.28 : depth === 3 ? 0.17 : 0.1
          return `rgba(53,217,255,${alpha})`
        }}
        linkOpacity={0.5}
        linkWidth={(rawLink) => {
          const depth = linkDepth(rawLink as GraphLink)
          if (depth == null) return 0.14
          return depth === 0 ? 0.72 : depth === 1 ? 0.48 : depth === 2 ? 0.34 : depth === 3 ? 0.24 : 0.17
        }}
        linkDirectionalParticles={(rawLink) => selectedNodeId && linkDepth(rawLink as GraphLink) === 0 ? 2 : 0}
        linkDirectionalParticleColor={() => '#72e7ff'}
        linkDirectionalParticleWidth={1.25}
        linkDirectionalParticleOffset={(rawLink) => linkHash(rawLink as GraphLink)}
        linkDirectionalParticleSpeed={(rawLink) => {
          const phase = linkHash(rawLink as GraphLink)
          const cycle = (performance.now() / 7000 + phase) % 1
          const lerp = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2
          return 0.00145 + lerp * 0.0019
        }}
        d3AlphaDecay={0.022}
        d3VelocityDecay={0.42}
        cooldownTicks={180}
        warmupTicks={70}
        onEngineTick={publishViewState}
        onEngineStop={() => {
          publishViewState()
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

      <div className="brain-graph__controls">
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
        <button
          className="brain-graph__fit"
          type="button"
          onClick={fitGraph}
          title="Fit all currently loaded memory nodes into the camera view."
        >
          ◎ FIT GRAPH
        </button>
      </div>

      {hoveredNode && hoverOverlayPoint && pointerPoint && (
        <>
          <svg className="brain-node-hover__connector" aria-hidden="true">
            <line x1={hoverOverlayPoint.x} y1={hoverOverlayPoint.y} x2={pointerPoint.x} y2={pointerPoint.y} />
            <circle cx={pointerPoint.x} cy={pointerPoint.y} r="3" />
          </svg>
          <div className="brain-node-hover" style={{ left: hoverOverlayPoint.x, top: hoverOverlayPoint.y }}>
            <div className="brain-node-hover__surface" />
            <span>MEMORY</span>
            <strong>{hoveredNode.label}</strong>
            <p>{hoveredNode.summary}</p>
          </div>
        </>
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
              <div><dt>LINKS</dt><dd>{selectedConnections.length} direct</dd></div>
              <div><dt>WHEN</dt><dd>{formatDate(selectedNode.occurredAt)}</dd></div>
              {selectedNode.context && <div><dt>CONTEXT</dt><dd>{selectedNode.context}</dd></div>}
              {selectedNode.entities && <div><dt>ENTITIES</dt><dd>{selectedNode.entities}</dd></div>}
            </dl>

            {selectedConnections.length > 0 && (
              <section className="brain-memory-inspector__connections" aria-label="Connected memories">
                <span>CONNECTED MEMORIES</span>
                <ul>
                  {selectedConnections.slice(0, 8).map((connection) => (
                    <li key={`${connection.id}-${connection.relationship}`}>
                      <button type="button" onClick={() => selectConnectedMemory(connection.id)}>
                        <strong>{connection.label}</strong>
                        <small>{connection.relationship}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                {selectedConnections.length > 8 && <small>+ {selectedConnections.length - 8} more direct links</small>}
              </section>
            )}

            <div className="brain-memory-inspector__hint">Read-only inspection · no memory is written or changed from this view.</div>
          </div>
        </aside>
      )}
    </div>
  )
}
