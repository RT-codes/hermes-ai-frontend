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
import {
  buildBrainLodModel,
  chooseAutomaticLod,
  resolveLodLevel,
} from './brainGraphLod'
import type { BrainCluster, BrainLodLevel, BrainLodMode } from './brainGraphLod'
import { createMockBrainGraph } from './mockBrainGraph'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type Point = { x: number; y: number }
type ViewRotation = { yaw: number; pitch: number }
type LinkEndpoint = string | number | GraphNode | undefined

type BrainGraphProps = {
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
type GraphBbox = { x: [number, number]; y: [number, number]; z: [number, number] }
type LinkForceLike = {
  distance?: (value: number | ((link: GraphLink) => number)) => LinkForceLike
  strength?: (value: number | ((link: GraphLink) => number)) => LinkForceLike
}

type ClusterLabelPoint = {
  id: string
  label: string
  count: number
  prominence: number
  x: number
  y: number
}

const INSPECTOR_ENTRY_DELAY_MS = 170
const MAX_HIGHLIGHT_HOPS = 4
const GRID_Y = -92
const CONNECTOR_MAX_DEPARTURE = 80
const CONNECTOR_MIN_APPROACH = 20
const MEMORY_BODY_GEOMETRY = new SphereGeometry(1, 12, 8)
const MEMORY_HALO_GEOMETRY = new SphereGeometry(1, 8, 5)
const CLUSTER_BODY_GEOMETRY = new SphereGeometry(1, 16, 11)
const CLUSTER_HALO_GEOMETRY = new SphereGeometry(1, 12, 8)

function endpointId(endpoint: LinkEndpoint) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  return endpoint?.id == null ? '' : String(endpoint.id)
}

function isMemoryLink(link: GraphLink) {
  const synthetic = (link as BrainGraphLink).synthetic
  return !synthetic || synthetic === 'memory'
}

function isDirectLink(link: GraphLink, nodeId: string | null) {
  if (!nodeId || !isMemoryLink(link)) return false
  return endpointId(link.source as LinkEndpoint) === nodeId || endpointId(link.target as LinkEndpoint) === nodeId
}

function linkHash(link: GraphLink) {
  const key = `${endpointId(link.source as LinkEndpoint)}>${endpointId(link.target as LinkEndpoint)}`
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return (hash % 997) / 997
}

function createNeuralSphere(node: GraphNode, distance: number | null, selected: boolean, inspecting: boolean) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const baseRadius = 3.8 + Math.max(0, Number(node.val ?? 1)) * 1.45
  const scale = selected ? 0.8 : distance === 1 ? 0.7 : 0.6
  const radius = baseRadius * scale
  const bodyOpacity = selected
    ? 1
    : !inspecting
      ? distance === 0 ? 0.78 : distance === 1 ? 0.54 : 0.34
      : distance === 1 ? 0.54 : distance === 2 ? 0.38 : distance === 3 ? 0.3 : distance === 4 ? 0.25 : 0.2
  const haloOpacity = selected
    ? 0.25
    : distance === 1 ? 0.12 : distance === 2 ? 0.075 : distance === 3 ? 0.052 : distance === 4 ? 0.04 : 0.028
  const group = new Group()
  const phase = Math.random() * Math.PI * 2

  const body = new Mesh(
    MEMORY_BODY_GEOMETRY,
    new MeshBasicMaterial({
      color: accent,
      transparent: !selected,
      opacity: bodyOpacity,
      depthWrite: selected,
    }),
  )
  body.scale.setScalar(radius)

  const halo = new Mesh(
    MEMORY_HALO_GEOMETRY,
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: haloOpacity,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  halo.scale.setScalar(radius * 1.5)

  group.add(halo)
  group.add(body)
  group.onBeforeRender = () => {
    const pulseAmount = selected ? 0.085 : distance === 1 ? 0.055 : 0.035
    const pulse = 1 + Math.sin(performance.now() / 900 + phase) * pulseAmount
    halo.scale.setScalar(radius * 1.5 * pulse)
  }

  return group
}

function createClusterSphere(node: GraphNode, hovered: boolean, lodLevel: BrainLodLevel) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const prominence = Math.max(0.08, Number(node.prominence ?? 0.2))
  const count = Math.max(1, Number(node.memberCount ?? 1))
  const radius = 4.4 + Math.log2(count + 1) * 0.9 + prominence * 5.8
  const haloRadius = radius * (1.85 + prominence * 2.45)
  const bodyOpacity = Math.min(0.96, 0.46 + prominence * 0.38 + (hovered ? 0.12 : 0))
  const haloOpacity = Math.min(0.31, 0.055 + prominence * 0.19 + (hovered ? 0.07 : 0))
  const group = new Group()
  const phase = (Number.parseInt(String(node.id).slice(-4), 36) || count) % 13

  const body = new Mesh(
    CLUSTER_BODY_GEOMETRY,
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: bodyOpacity,
      depthWrite: false,
    }),
  )
  body.scale.setScalar(radius)

  const halo = new Mesh(
    CLUSTER_HALO_GEOMETRY,
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: haloOpacity,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  halo.scale.setScalar(haloRadius)

  group.add(halo)
  group.add(body)
  group.onBeforeRender = () => {
    const speed = lodLevel === 'overview' ? 1500 : 1850
    const pulse = 1 + Math.sin(performance.now() / speed + phase) * (0.035 + prominence * 0.035)
    halo.scale.setScalar(haloRadius * pulse)
  }

  return group
}

function formatDate(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function buildHopDistances(links: GraphData<BrainGraphNode, BrainGraphLink>['links'], focusNodeId: string | null) {
  const distances = new Map<string, number>()
  if (!focusNodeId) return distances

  const adjacency = new Map<string, Set<string>>()
  links.forEach((rawLink) => {
    const link = rawLink as GraphLink
    if (!isMemoryLink(link)) return
    const source = endpointId(link.source as LinkEndpoint)
    const target = endpointId(link.target as LinkEndpoint)
    if (!source || !target || source === 'core' || target === 'core') return
    if (!adjacency.has(source)) adjacency.set(source, new Set())
    if (!adjacency.has(target)) adjacency.set(target, new Set())
    adjacency.get(source)?.add(target)
    adjacency.get(target)?.add(source)
  })

  distances.set(focusNodeId, 0)
  let frontier = [focusNodeId]
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

function graphExtent(bbox: GraphBbox | null | undefined) {
  if (!bbox) return 1
  return Math.max(1, Math.hypot(
    bbox.x[1] - bbox.x[0],
    bbox.y[1] - bbox.y[0],
    bbox.z[1] - bbox.z[0],
  ))
}

function cameraDistance(camera: CameraLike, controls: OrbitControlsLike) {
  const target = controls.target ?? { x: 0, y: 0, z: 0 }
  return Math.hypot(
    camera.position.x - target.x,
    camera.position.y - target.y,
    camera.position.z - target.z,
  )
}

function nearestCluster(clusters: BrainCluster[], target: { x: number; y: number; z: number }) {
  let closest: BrainCluster | undefined
  let closestDistance = Number.POSITIVE_INFINITY
  clusters.forEach((cluster) => {
    const distance = Math.hypot(
      cluster.anchor.x - target.x,
      cluster.anchor.y - target.y,
      cluster.anchor.z - target.z,
    )
    if (distance < closestDistance) {
      closest = cluster
      closestDistance = distance
    }
  })
  return closest
}

export function BrainGraph({ onViewRotationChange }: BrainGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<BrainGraphNode, BrainGraphLink> | undefined>(undefined)
  const inspectorRef = useRef<HTMLElement | null>(null)
  const inspectorAnchorRef = useRef<HTMLParagraphElement | null>(null)
  const selectedConnectorPathRef = useRef<SVGPathElement | null>(null)
  const selectedConnectorDotRef = useRef<SVGCircleElement | null>(null)
  const initialFitDone = useRef(false)
  const automaticLodRef = useRef<BrainLodLevel>('overview')
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [rawGraphData, setRawGraphData] = useState<GraphData<BrainGraphNode, BrainGraphLink>>(() => createMockBrainGraph())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const [pointerPoint, setPointerPoint] = useState<Point | null>(null)
  const [source, setSource] = useState<GraphSource>('loading')
  const [bankId, setBankId] = useState<string>('—')
  const [totalUnits, setTotalUnits] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [inspectorVisible, setInspectorVisible] = useState(false)
  const [lodMode, setLodMode] = useState<BrainLodMode>('auto')
  const [automaticLod, setAutomaticLod] = useState<BrainLodLevel>('overview')
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null)
  const [clusterLabelPoints, setClusterLabelPoints] = useState<ClusterLabelPoint[]>([])

  const lodModel = useMemo(() => buildBrainLodModel(rawGraphData), [rawGraphData])
  const graphData = lodModel.data
  const lodLevel = resolveLodLevel(lodMode, automaticLod)

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
        setRawGraphData(loaded.data)
        setBankId(loaded.bankId)
        setTotalUnits(loaded.totalUnits)
        setSelectedNodeId(null)
        setPreviewNodeId(null)
        setHoveredNodeId(null)
        setSource('hindsight')
        setAutomaticLod('overview')
        automaticLodRef.current = 'overview'
        setActiveClusterId(null)
        initialFitDone.current = false
        window.setTimeout(() => graphRef.current?.d3ReheatSimulation(), 0)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setRawGraphData(createMockBrainGraph())
        setBankId('mock fallback')
        setTotalUnits(0)
        setLoadError(error instanceof Error ? error.message : 'Unable to load Hindsight graph.')
        setSource('fallback')
        setAutomaticLod('overview')
        automaticLodRef.current = 'overview'
        setActiveClusterId(null)
        initialFitDone.current = false
      })

    return () => controller.abort()
  }, [refreshToken])

  useEffect(() => {
    let timer: number | undefined
    if (selectedNodeId) {
      document.documentElement.classList.add('brain-is-inspecting')
      timer = window.setTimeout(() => setInspectorVisible(true), INSPECTOR_ENTRY_DELAY_MS)
    } else {
      setInspectorVisible(false)
      setPreviewNodeId(null)
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
          gl_FragColor = vec4(gridColor, line * fade * 0.162);
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

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const linkForce = graph.d3Force('link') as LinkForceLike | undefined
    if (!linkForce) return

    const clusterSizeById = new Map(lodModel.clusters.map((cluster) => [cluster.id, cluster.memberCount]))
    linkForce.distance?.((link) => {
      const typed = link as BrainGraphLink
      if (typed.synthetic === 'membership') {
        const clusterId = endpointId(typed.source as LinkEndpoint).startsWith('cluster:')
          ? endpointId(typed.source as LinkEndpoint)
          : endpointId(typed.target as LinkEndpoint)
        const count = clusterSizeById.get(clusterId) ?? 1
        return 18 + Math.sqrt(count) * 2.4
      }
      if (typed.synthetic === 'aggregate') return 48
      return 30
    })
    linkForce.strength?.((link) => {
      const typed = link as BrainGraphLink
      if (typed.synthetic === 'membership') return 0.24
      if (typed.synthetic === 'aggregate') return 0.015
      return 0.32
    })
    graph.d3ReheatSimulation()
  }, [lodModel])

  const hoveredNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === hoveredNodeId) as GraphNode | undefined,
    [graphData.nodes, hoveredNodeId],
  )

  const publishViewState = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return

    if (hoveredNode && Number.isFinite(hoveredNode.x) && Number.isFinite(hoveredNode.y) && Number.isFinite(hoveredNode.z)) {
      const projected = graph.graph2ScreenCoords(hoveredNode.x as number, hoveredNode.y as number, hoveredNode.z as number)
      if (Number.isFinite(projected.x) && Number.isFinite(projected.y)) setHoverPoint(projected)
    } else {
      setHoverPoint((current) => current ? null : current)
    }

    const camera = graph.camera() as CameraLike
    const controls = graph.controls() as OrbitControlsLike
    const target = controls.target ?? { x: 0, y: 0, z: 0 }
    const bbox = graph.getGraphBbox?.((node) => node.kind === 'memory') as GraphBbox | null | undefined
    const extent = graphExtent(bbox)
    const distance = cameraDistance(camera, controls)

    const nextAutomatic = chooseAutomaticLod(automaticLodRef.current, distance, extent)
    if (nextAutomatic !== automaticLodRef.current) {
      automaticLodRef.current = nextAutomatic
      setAutomaticLod(nextAutomatic)
    }

    const closest = nearestCluster(lodModel.clusters, target)
    if (closest) setActiveClusterId((current) => current === closest.id ? current : closest.id)

    const effectiveLevel = resolveLodLevel(lodMode, nextAutomatic)
    const labelBudget = Math.max(2, Math.min(lodModel.clusters.length, Math.floor(size.width / 300)))
    const orderedLabels = [...lodModel.clusters]
      .sort((a, b) => b.prominence - a.prominence)
      .filter((cluster, index) => effectiveLevel === 'overview'
        ? index < labelBudget
        : cluster.id === closest?.id || (effectiveLevel === 'cluster' && index < Math.max(2, Math.ceil(labelBudget * 0.45))))

    const points = orderedLabels.flatMap((cluster) => {
      const node = graphData.nodes.find((candidate) => String(candidate.id) === cluster.id) as GraphNode | undefined
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) return []
      const projected = graph.graph2ScreenCoords(node.x as number, node.y as number, node.z as number)
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return []
      return [{
        id: cluster.id,
        label: cluster.label,
        count: cluster.memberCount,
        prominence: cluster.prominence,
        x: projected.x,
        y: projected.y,
      }]
    })
    setClusterLabelPoints(points)

    if (onViewRotationChange) {
      const dx = camera.position.x - target.x
      const dy = camera.position.y - target.y
      const dz = camera.position.z - target.z
      const horizontal = Math.max(0.0001, Math.hypot(dx, dz))
      onViewRotationChange({
        yaw: Math.atan2(dx, dz) * 180 / Math.PI,
        pitch: Math.atan2(dy, horizontal) * 180 / Math.PI,
      })
    }
  }, [graphData.nodes, hoveredNode, lodMode, lodModel.clusters, onViewRotationChange, size.width])

  useEffect(() => {
    const timer = window.setInterval(publishViewState, 90)
    return () => window.clearInterval(timer)
  }, [publishViewState])

  useEffect(() => {
    if (!selectedNodeId || !inspectorVisible) return

    let frame = 0
    const updateConnector = () => {
      frame = window.requestAnimationFrame(updateConnector)

      const graph = graphRef.current
      const host = hostRef.current
      const inspector = inspectorRef.current
      const anchor = inspectorAnchorRef.current
      const path = selectedConnectorPathRef.current
      const dot = selectedConnectorDotRef.current
      const selectedGraphNode = graphData.nodes.find((node) => String(node.id) === selectedNodeId) as GraphNode | undefined

      if (!graph || !host || !inspector || !anchor || !path || !dot || !selectedGraphNode) return
      if (!Number.isFinite(selectedGraphNode.x) || !Number.isFinite(selectedGraphNode.y) || !Number.isFinite(selectedGraphNode.z)) return

      const projected = graph.graph2ScreenCoords(
        selectedGraphNode.x as number,
        selectedGraphNode.y as number,
        selectedGraphNode.z as number,
      )
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return

      const hostRect = host.getBoundingClientRect()
      const inspectorRect = inspector.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      const startX = projected.x
      const startY = projected.y
      const targetX = inspectorRect.left - hostRect.left
      const targetY = anchorRect.top - hostRect.top + Math.min(18, Math.max(10, anchorRect.height * 0.32))
      const direction = targetX >= startX ? 1 : -1
      const horizontalGap = Math.abs(targetX - startX)
      const departure = Math.min(CONNECTOR_MAX_DEPARTURE, Math.max(0, horizontalGap - CONNECTOR_MIN_APPROACH))
      const bendX = startX + direction * departure

      path.setAttribute('d', `M ${startX.toFixed(2)} ${startY.toFixed(2)} H ${bendX.toFixed(2)} V ${targetY.toFixed(2)} H ${targetX.toFixed(2)}`)
      path.style.opacity = '1'
      dot.setAttribute('cx', targetX.toFixed(2))
      dot.setAttribute('cy', targetY.toFixed(2))
      dot.style.opacity = '1'
    }

    frame = window.requestAnimationFrame(updateConnector)
    return () => {
      window.cancelAnimationFrame(frame)
      if (selectedConnectorPathRef.current) selectedConnectorPathRef.current.style.opacity = '0'
      if (selectedConnectorDotRef.current) selectedConnectorDotRef.current.style.opacity = '0'
    }
  }, [graphData.nodes, inspectorVisible, selectedNodeId])

  const focusNodeId = previewNodeId ?? selectedNodeId
  const hopDistances = useMemo(
    () => buildHopDistances(graphData.links, focusNodeId),
    [focusNodeId, graphData.links],
  )

  const hoverNeighbourIds = useMemo(() => {
    const ids = new Set<string>()
    if (!hoveredNodeId || selectedNodeId) return ids
    const hovered = graphData.nodes.find((node) => String(node.id) === hoveredNodeId)
    if (hovered?.kind === 'cluster') return ids
    ids.add(hoveredNodeId)
    graphData.links.forEach((rawLink) => {
      const link = rawLink as GraphLink
      if (!isMemoryLink(link)) return
      const sourceId = endpointId(link.source as LinkEndpoint)
      const targetId = endpointId(link.target as LinkEndpoint)
      if (sourceId === hoveredNodeId) ids.add(targetId)
      if (targetId === hoveredNodeId) ids.add(sourceId)
    })
    return ids
  }, [graphData.links, graphData.nodes, hoveredNodeId, selectedNodeId])

  const createNodeObject = useCallback((node: GraphNode) => {
    const id = String(node.id)
    if (node.kind === 'cluster') return createClusterSphere(node, id === hoveredNodeId, lodLevel)
    const distance = hopDistances.get(id) ?? null
    const selected = Boolean(focusNodeId) && distance === 0
    const hoverDistance = !focusNodeId && hoverNeighbourIds.has(id) ? (id === hoveredNodeId ? 0 : 1) : null
    return createNeuralSphere(node, focusNodeId ? distance : hoverDistance, selected, Boolean(focusNodeId))
  }, [focusNodeId, hopDistances, hoverNeighbourIds, hoveredNodeId, lodLevel])

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === selectedNodeId && node.kind === 'memory') as BrainGraphNode | undefined,
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
        const neighbour = graphData.nodes.find((node) => String(node.id) === neighbourId && node.kind === 'memory') as BrainGraphNode | undefined
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
    if (!isMemoryLink(link)) return null
    if (!focusNodeId) return isDirectLink(link, hoveredNodeId) ? 0 : null
    const sourceDepth = hopDistances.get(endpointId(link.source as LinkEndpoint))
    const targetDepth = hopDistances.get(endpointId(link.target as LinkEndpoint))
    if (sourceDepth == null && targetDepth == null) return null
    return Math.min(sourceDepth ?? MAX_HIGHLIGHT_HOPS + 1, targetDepth ?? MAX_HIGHLIGHT_HOPS + 1)
  }, [focusNodeId, hopDistances, hoveredNodeId])

  const nodeIsVisible = useCallback((node: BrainGraphNode) => {
    if (node.kind === 'core') return false
    if (focusNodeId) {
      if (node.kind === 'cluster') return false
      const distance = hopDistances.get(node.id)
      return distance != null && distance <= 3
    }
    if (node.kind === 'cluster') return lodLevel !== 'detail' || node.id === activeClusterId
    if (lodLevel === 'overview') return false
    if (lodLevel === 'cluster') return lodModel.representativeNodeIds.has(node.id)
    return node.clusterId === activeClusterId
  }, [activeClusterId, focusNodeId, hopDistances, lodLevel, lodModel.representativeNodeIds])

  const linkIsVisible = useCallback((rawLink: BrainGraphLink) => {
    const link = rawLink as GraphLink
    const typed = rawLink as BrainGraphLink
    if (typed.synthetic === 'membership') return false
    if (typed.synthetic === 'aggregate') return !focusNodeId && lodLevel !== 'detail'
    if (!isMemoryLink(link)) return false

    const sourceId = endpointId(link.source as LinkEndpoint)
    const targetId = endpointId(link.target as LinkEndpoint)
    const sourceNode = graphData.nodes.find((node) => String(node.id) === sourceId)
    const targetNode = graphData.nodes.find((node) => String(node.id) === targetId)
    if (!sourceNode || !targetNode || !nodeIsVisible(sourceNode) || !nodeIsVisible(targetNode)) return false

    if (focusNodeId) {
      const depth = linkDepth(link)
      return depth != null && depth <= 2
    }
    if (lodLevel === 'overview') return false
    if (lodLevel === 'cluster') return sourceNode.clusterId === targetNode.clusterId
    return sourceNode.clusterId === activeClusterId && targetNode.clusterId === activeClusterId
  }, [activeClusterId, focusNodeId, graphData.nodes, linkDepth, lodLevel, nodeIsVisible])

  function fitGraph() {
    graphRef.current?.zoomToFit(420, 120, (node) => node.kind !== 'core')
  }

  function resetView() {
    setSelectedNodeId(null)
    setPreviewNodeId(null)
    setLodMode('auto')
    fitGraph()
  }

  function refreshGraph() {
    if (source !== 'loading') setRefreshToken((value) => value + 1)
  }

  function selectConnectedMemory(nodeId: string) {
    setHoveredNodeId(null)
    setPreviewNodeId(null)
    setSelectedNodeId(nodeId)
  }

  function focusCluster(node: GraphNode) {
    const graph = graphRef.current
    if (!graph || node.kind !== 'cluster') return
    setActiveClusterId(String(node.id))
    setSelectedNodeId(null)
    setPreviewNodeId(null)
    if (lodMode === 'overview') setLodMode('auto')
    automaticLodRef.current = 'cluster'
    setAutomaticLod('cluster')

    const bbox = graph.getGraphBbox?.((candidate) => candidate.kind === 'memory') as GraphBbox | null | undefined
    const extent = graphExtent(bbox)
    const target = { x: Number(node.x ?? node.fx ?? 0), y: Number(node.y ?? node.fy ?? 0), z: Number(node.z ?? node.fz ?? 0) }
    const camera = graph.camera() as CameraLike
    const dx = camera.position.x - target.x
    const dy = camera.position.y - target.y
    const dz = camera.position.z - target.z
    const length = Math.max(0.0001, Math.hypot(dx, dy, dz))
    const desiredDistance = extent * 0.92
    graph.cameraPosition({
      x: target.x + dx / length * desiredDistance,
      y: target.y + dy / length * desiredDistance,
      z: target.z + dz / length * desiredDistance,
    }, target, 520)
  }

  function cycleLodMode() {
    setSelectedNodeId(null)
    setPreviewNodeId(null)
    setLodMode((current) => current === 'auto' ? 'overview' : current === 'overview' ? 'detail' : 'auto')
  }

  const memoryCount = rawGraphData.nodes.filter((node) => node.kind === 'memory').length
  const hoverOverlayPoint = hoverPoint ? { x: hoverPoint.x, y: Math.max(86, hoverPoint.y - 44) } : null
  const maxAggregateCount = Math.max(1, ...graphData.links.map((link) => Number((link as BrainGraphLink).aggregateCount ?? 0)))

  return (
    <div
      className="brain-graph"
      ref={hostRef}
      data-lod={lodLevel}
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
        nodeVisibility={nodeIsVisible}
        nodeLabel={() => ''}
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}
        linkVisibility={linkIsVisible}
        linkResolution={3}
        linkColor={(rawLink) => {
          const typed = rawLink as BrainGraphLink
          if (typed.synthetic === 'aggregate') {
            const normalized = Math.sqrt(Math.max(1, typed.aggregateCount ?? 1) / maxAggregateCount)
            return `rgba(53,217,255,${0.12 + normalized * 0.22})`
          }
          const depth = linkDepth(rawLink as GraphLink)
          if (depth == null) return focusNodeId ? 'rgba(53,217,255,0.16)' : 'rgba(53,217,255,0.2)'
          const alpha = depth === 0 ? 0.5 : depth === 1 ? 0.25 : depth === 2 ? 0.21 : 0.2
          return `rgba(53,217,255,${alpha})`
        }}
        linkOpacity={0.5}
        linkWidth={(rawLink) => {
          const typed = rawLink as BrainGraphLink
          if (typed.synthetic === 'aggregate') {
            const normalized = Math.sqrt(Math.max(1, typed.aggregateCount ?? 1) / maxAggregateCount)
            return 0.08 + normalized * 0.16
          }
          const depth = linkDepth(rawLink as GraphLink)
          if (depth == null) return 0.14
          return depth === 0 ? 0.38 : depth === 1 ? 0.19 : depth === 2 ? 0.15 : 0.14
        }}
        linkDirectionalParticles={(rawLink) => focusNodeId && isMemoryLink(rawLink as GraphLink) && linkDepth(rawLink as GraphLink) === 0 ? 2 : 0}
        linkDirectionalParticleColor={() => '#72e7ff'}
        linkDirectionalParticleWidth={1.25}
        linkDirectionalParticleResolution={2}
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
        onEngineStop={() => {
          publishViewState()
          if (!initialFitDone.current) {
            initialFitDone.current = true
            graphRef.current?.zoomToFit(700, 190, (node) => node.kind !== 'core')
          }
        }}
        onNodeHover={(node) => setHoveredNodeId(node?.id == null ? null : String(node.id))}
        onNodeClick={(node) => {
          if (node.kind === 'cluster') {
            focusCluster(node as GraphNode)
            return
          }
          setPreviewNodeId(null)
          setSelectedNodeId((current) => current === String(node.id) ? null : String(node.id))
        }}
        onBackgroundClick={() => {
          setPreviewNodeId(null)
          setSelectedNodeId(null)
        }}
        enablePointerInteraction
        enableNodeDrag={lodLevel !== 'overview'}
        enableNavigationControls
      />

      <div className="brain-cluster-labels" aria-hidden="true">
        {clusterLabelPoints.map((cluster) => (
          <div
            className="brain-cluster-label"
            key={cluster.id}
            style={{
              left: cluster.x,
              top: cluster.y,
              '--cluster-prominence': cluster.prominence,
            } as React.CSSProperties}
          >
            <span>{cluster.label}</span>
            <small>{cluster.count}</small>
          </div>
        ))}
      </div>

      <div className="brain-graph__controls">
        <div className={`brain-graph__phase-label is-${source}`}>
          <span>{source === 'hindsight' ? `HINDSIGHT · ${bankId}` : source === 'loading' ? 'HINDSIGHT · LOADING' : 'MOCK FALLBACK'}</span>
          <strong>{memoryCount} / {totalUnits || memoryCount} NODES · {lodModel.clusters.length} CLUSTERS · {lodLevel.toUpperCase()}</strong>
        </div>
        <button
          className="brain-graph__lod"
          type="button"
          onClick={cycleLodMode}
          title="Cycle adaptive detail mode: Auto, Overview, Detail."
        >
          DETAIL · {lodMode.toUpperCase()}
        </button>
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
          title="Fit all currently loaded memory and cluster nodes into the camera view."
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
          <div className={`brain-node-hover ${hoveredNode.kind === 'cluster' ? 'is-cluster' : ''}`} style={{ left: hoverOverlayPoint.x, top: hoverOverlayPoint.y }}>
            <div className="brain-node-hover__surface" />
            <span>{hoveredNode.kind === 'cluster' ? 'MEMORY CLUSTER' : 'MEMORY'}</span>
            <strong>{hoveredNode.label}</strong>
            <p>{hoveredNode.kind === 'cluster' ? `${hoveredNode.memberCount ?? 0} grouped memories · click to explore` : hoveredNode.summary}</p>
          </div>
        </>
      )}

      {selectedNode && inspectorVisible && (
        <>
          <svg className="brain-selected-connector" aria-hidden="true">
            <path ref={selectedConnectorPathRef} />
            <circle ref={selectedConnectorDotRef} r="4.2" />
          </svg>

          <aside ref={inspectorRef} className="brain-memory-inspector" aria-label="Selected memory">
            <div className="brain-memory-inspector__surface" />
            <header className="brain-memory-inspector__header">
              <div>
                <span>MEMORY INSPECTOR</span>
                <strong>{selectedNode.factType || 'memory'}</strong>
              </div>
              <button type="button" onClick={() => setSelectedNodeId(null)} aria-label="Close memory inspector">×</button>
            </header>
            <div className="brain-memory-inspector__content">
              <p ref={inspectorAnchorRef} className="brain-memory-inspector__memory">{selectedNode.summary}</p>
              <dl>
                <div><dt>BANK</dt><dd>{bankId}</dd></div>
                <div><dt>MEMORY ID</dt><dd>{selectedNode.id}</dd></div>
                <div><dt>LINKS</dt><dd>{selectedConnections.length} direct</dd></div>
                <div><dt>WHEN</dt><dd>{formatDate(selectedNode.occurredAt)}</dd></div>
                {selectedNode.context && <div><dt>CONTEXT</dt><dd>{selectedNode.context}</dd></div>}
                {selectedNode.entities && <div><dt>ENTITIES</dt><dd>{Array.isArray(selectedNode.entities) ? selectedNode.entities.join(', ') : selectedNode.entities}</dd></div>}
              </dl>

              {selectedConnections.length > 0 && (
                <section className="brain-memory-inspector__connections" aria-label="Connected memories">
                  <span>CONNECTED MEMORIES</span>
                  <ul>
                    {selectedConnections.slice(0, 8).map((connection) => (
                      <li key={`${connection.id}-${connection.relationship}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setPreviewNodeId(connection.id)}
                          onMouseLeave={() => setPreviewNodeId(null)}
                          onFocus={() => setPreviewNodeId(connection.id)}
                          onBlur={() => setPreviewNodeId(null)}
                          onClick={() => selectConnectedMemory(connection.id)}
                        >
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
        </>
      )}

      {loadError && <div className="brain-graph__load-error">READ-ONLY FALLBACK · {loadError}</div>}
    </div>
  )
}
