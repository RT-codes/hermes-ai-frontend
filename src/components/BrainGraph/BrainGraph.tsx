import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods, GraphData, LinkObject, NodeObject } from 'react-force-graph-3d'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { BrainHudPanel } from '../BrainHudPanel/BrainHudPanel'
import { loadHindsightBrainGraph } from './hindsightGraph'
import { buildBrainLodModel, resolveLodLevel } from './brainGraphLod'
import type { BrainLodLevel, BrainLodMode } from './brainGraphLod'
import { createMockBrainGraph } from './mockBrainGraph'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type Point = { x: number; y: number }
type ViewRotation = { yaw: number; pitch: number }
type LinkEndpoint = string | number | GraphNode | undefined

type BrainGraphProps = {
  memoryGraphicsVisible?: boolean
  onViewRotationChange?: (rotation: ViewRotation) => void
}
type GraphNode = NodeObject<BrainGraphNode>
type GraphLink = LinkObject<BrainGraphNode, BrainGraphLink>
type GraphSource = 'loading' | 'hindsight' | 'fallback' | 'error'
type OrbitControlsLike = { target?: { x: number; y: number; z: number }; minPolarAngle?: number; maxPolarAngle?: number }
type CameraLike = { position: { x: number; y: number; z: number } }
type ClusterLabelPoint = {
  id: string
  label: string
  count: number
  prominence: number
  x: number
  y: number
  scale: number
  pinLength: number
}
type FocusNeighborhood = { distances: Map<string, number>; linkKeys: Set<string> }
type CameraSnapshot = { x: number; y: number; z: number; tx: number; ty: number; tz: number }
type LodTransitionPhase = 'out' | 'in' | null

const INSPECTOR_ENTRY_DELAY_MS = 170
const CONNECTOR_MAX_DEPARTURE = 80
const CONNECTOR_MIN_APPROACH = 20
const FOCUS_LINK_LIMIT = 12
const CAMERA_LABEL_SAMPLE_MS = 28
const CAMERA_STILL_DELAY_MS = 150
const CLUSTER_FOCUS_MS = 980
const PREVIEW_FOCUS_MS = 920

function endpointId(endpoint: LinkEndpoint) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  return endpoint?.id == null ? '' : String(endpoint.id)
}

function canonicalLinkKey(source: string, target: string) {
  return source < target ? `${source}>${target}` : `${target}>${source}`
}

function graphLinkKey(link: GraphLink) {
  return canonicalLinkKey(endpointId(link.source as LinkEndpoint), endpointId(link.target as LinkEndpoint))
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

function stableVisualHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function floatParameters(id: string, amplitude: number) {
  const hash = stableVisualHash(id)
  return {
    phaseX: ((hash & 0xff) / 255) * Math.PI * 2,
    phaseY: (((hash >> 8) & 0xff) / 255) * Math.PI * 2,
    phaseZ: (((hash >> 16) & 0xff) / 255) * Math.PI * 2,
    speed: 0.00015 + ((hash % 101) / 100) * 0.00009,
    amplitude,
  }
}

function memoryFloatAmplitude(node: GraphNode) {
  const baseRadius = 3.8 + Math.max(0, Number(node.val ?? 1)) * 1.45
  return Math.min(2.75, baseRadius * 0.6 * 0.33)
}

function memoryVisualOffset(node: GraphNode, time: number) {
  const float = floatParameters(String(node.id), memoryFloatAmplitude(node))
  return {
    x: Math.sin(time * float.speed + float.phaseX) * float.amplitude,
    y: Math.sin(time * float.speed * 0.77 + float.phaseY) * float.amplitude * 0.72,
    z: Math.sin(time * float.speed * 0.93 + float.phaseZ) * float.amplitude,
  }
}

function clusterFloatAmplitude(cluster: ReturnType<typeof buildBrainLodModel>['clusters'][number]) {
  const overviewRadius = 4.4 + Math.log2(cluster.memberCount + 1) * 0.9 + cluster.prominence * 5.8
  return Math.min(5.2, overviewRadius * 0.31)
}

function clusterVisualOffset(cluster: ReturnType<typeof buildBrainLodModel>['clusters'][number], time: number) {
  const float = floatParameters(cluster.id, clusterFloatAmplitude(cluster))
  return {
    x: Math.sin(time * float.speed + float.phaseX) * float.amplitude,
    y: Math.sin(time * float.speed * 0.71 + float.phaseY) * float.amplitude * 0.68,
    z: Math.sin(time * float.speed * 0.89 + float.phaseZ) * float.amplitude,
  }
}

function createNeuralSphere(
  node: GraphNode,
  distance: number | null,
  selected: boolean,
  emphasis: 'normal' | 'hover' | 'selection' | 'preview-base',
  freezePosition = false,
) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const baseRadius = 3.8 + Math.max(0, Number(node.val ?? 1)) * 1.45
  const scale = selected ? 0.8 : distance === 1 ? 0.7 : 0.6
  const radius = baseRadius * scale

  const bodyOpacity = selected
    ? 1
    : emphasis === 'preview-base'
      ? distance == null ? 0.12 : distance === 0 ? 0.52 : 0.34
      : emphasis === 'selection'
        ? distance === 1 ? 0.58 : 0.18
        : emphasis === 'hover'
          ? distance === 0 ? 0.84 : distance === 1 ? 0.58 : 0.16
          : distance === 0 ? 0.78 : distance === 1 ? 0.54 : 0.34

  const haloOpacity = selected
    ? 0.24
    : emphasis === 'preview-base'
      ? distance == null ? 0.008 : distance === 0 ? 0.09 : 0.055
      : emphasis === 'hover'
        ? distance === 0 ? 0.18 : distance === 1 ? 0.1 : 0.018
        : emphasis === 'selection'
          ? distance === 1 ? 0.095 : 0.018
          : distance === 1 ? 0.1 : 0.026

  const outer = new Group()
  const floating = new Group()
  const body = new Mesh(
    new SphereGeometry(radius, 12, 8),
    new MeshBasicMaterial({ color: accent, transparent: !selected, opacity: bodyOpacity, depthWrite: selected }),
  )
  const halo = new Mesh(
    new SphereGeometry(radius * 1.5, 8, 5),
    new MeshBasicMaterial({ color: accent, transparent: true, opacity: haloOpacity, depthWrite: false, blending: AdditiveBlending }),
  )

  const float = floatParameters(String(node.id), Math.min(2.75, radius * 0.33))
  floating.onBeforeRender = () => {
    const time = performance.now()
    if (freezePosition) {
      floating.position.set(0, 0, 0)
    } else {
      floating.position.set(
        Math.sin(time * float.speed + float.phaseX) * float.amplitude,
        Math.sin(time * float.speed * 0.77 + float.phaseY) * float.amplitude * 0.72,
        Math.sin(time * float.speed * 0.93 + float.phaseZ) * float.amplitude,
      )
    }

    const pulseAmount = selected ? 0.08 : distance === 1 ? 0.04 : 0.022
    halo.scale.setScalar(1 + Math.sin(time / 950 + float.phaseY) * pulseAmount)
  }

  floating.add(halo)
  floating.add(body)
  outer.add(floating)
  return outer
}

function createClusterSphere(node: GraphNode, hovered: boolean, lodLevel: BrainLodLevel) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const prominence = Math.max(0.08, Number(node.prominence ?? 0.2))
  const count = Math.max(1, Number(node.memberCount ?? 1))
  const overviewRadius = 4.4 + Math.log2(count + 1) * 0.9 + prominence * 5.8
  const radius = lodLevel === 'overview' ? overviewRadius : 3.6 + prominence * 1.55
  const overviewShellRadius = overviewRadius * (1.85 + prominence * 2.45)
  const outer = new Group()
  const floating = new Group()
  const createdAt = performance.now()
  const targetScale = hovered ? 1.12 : 1
  const float = floatParameters(String(node.id), Math.min(5.2, overviewRadius * 0.31))
  const visualHash = stableVisualHash(String(node.id))
  const direction = visualHash % 2 === 0 ? 1 : -1
  const axisBias = 0.23 + ((visualHash >> 6) % 32) / 100
  const spinSpeed = (0.0001 + ((visualHash >> 12) % 55) / 1_000_000) * direction
  const axisSpeed = 0.000085 + ((visualHash >> 18) % 45) / 1_000_000
  const hitRadius = lodLevel === 'overview' ? overviewShellRadius : Math.max(radius * 2.5, overviewRadius * 0.72)

  floating.add(new Mesh(
    new SphereGeometry(hitRadius, 8, 5),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  ))

  let shellGroup: Group | null = null
  if (lodLevel === 'overview') {
    shellGroup = new Group()
    const shellGeometry = new IcosahedronGeometry(overviewShellRadius, 1)
    const shellFill = new Mesh(
      shellGeometry,
      new MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: Math.min(0.17, 0.055 + prominence * 0.065 + (hovered ? 0.035 : 0)),
        depthWrite: false,
      }),
    )
    const shellWire = new Mesh(
      shellGeometry,
      new MeshBasicMaterial({
        color: '#f0fbff',
        wireframe: true,
        transparent: true,
        opacity: Math.min(0.22, 0.105 + prominence * 0.075 + (hovered ? 0.035 : 0)),
        depthWrite: false,
      }),
    )
    shellGroup.add(shellFill)
    shellGroup.add(shellWire)
    floating.add(shellGroup)
  }

  const body = new Mesh(
    new SphereGeometry(radius, lodLevel === 'overview' ? 15 : 11, lodLevel === 'overview' ? 10 : 7),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: lodLevel === 'overview'
        ? Math.min(0.94, 0.4 + prominence * 0.34 + (hovered ? 0.17 : 0))
        : Math.min(0.88, 0.5 + prominence * 0.2 + (hovered ? 0.16 : 0)),
      depthWrite: false,
    }),
  )
  floating.add(body)

  floating.onBeforeRender = () => {
    const time = performance.now()
    floating.position.set(
      Math.sin(time * float.speed + float.phaseX) * float.amplitude,
      Math.sin(time * float.speed * 0.71 + float.phaseY) * float.amplitude * 0.68,
      Math.sin(time * float.speed * 0.89 + float.phaseZ) * float.amplitude,
    )

    const progress = Math.min(1, (time - createdAt) / 210)
    const eased = 1 - Math.pow(1 - progress, 3)
    const visualScale = 1 + (targetScale - 1) * eased
    body.scale.setScalar(visualScale)

    if (shellGroup) {
      shellGroup.scale.setScalar(visualScale)
      shellGroup.rotation.y = time * spinSpeed
      shellGroup.rotation.x = Math.sin(time * axisSpeed + float.phaseX) * axisBias
      shellGroup.rotation.z = Math.sin(time * axisSpeed * 0.73 + float.phaseZ) * axisBias * 0.48
    }
  }

  outer.add(floating)
  return outer
}

function formatDate(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function buildFocusNeighborhood(
  links: GraphData<BrainGraphNode, BrainGraphLink>['links'],
  focusNodeId: string | null,
  nodeById: Map<string, BrainGraphNode>,
): FocusNeighborhood {
  const distances = new Map<string, number>()
  const linkKeys = new Set<string>()
  if (!focusNodeId) return { distances, linkKeys }

  const focusNode = nodeById.get(focusNodeId)
  distances.set(focusNodeId, 0)

  const direct = links
    .map((rawLink) => rawLink as GraphLink)
    .filter((link) => isDirectLink(link, focusNodeId))
    .map((link) => {
      const source = endpointId(link.source as LinkEndpoint)
      const target = endpointId(link.target as LinkEndpoint)
      const neighbourId = source === focusNodeId ? target : source
      const neighbour = nodeById.get(neighbourId)
      return {
        link,
        neighbourId,
        sameCluster: Boolean(focusNode?.clusterId && neighbour?.clusterId === focusNode.clusterId),
        strength: Number.isFinite(Number((link as BrainGraphLink).strength)) ? Number((link as BrainGraphLink).strength) : 0,
        tie: linkHash(link),
      }
    })
    .filter((entry) => entry.neighbourId && entry.neighbourId !== 'core')
    .sort((a, b) => Number(b.sameCluster) - Number(a.sameCluster) || b.strength - a.strength || a.tie - b.tie)

  const adaptiveLimit = Math.max(5, Math.min(FOCUS_LINK_LIMIT, Math.round(4 + Math.sqrt(direct.length) * 0.6)))
  direct.slice(0, adaptiveLimit).forEach((entry) => {
    distances.set(entry.neighbourId, 1)
    linkKeys.add(graphLinkKey(entry.link))
  })

  return { distances, linkKeys }
}

function clusterBounds(clusters: ReturnType<typeof buildBrainLodModel>['clusters']) {
  if (!clusters.length) return { centerX: 0, centerZ: 0, minY: -40, extent: 360 }

  const xs = clusters.map((cluster) => cluster.anchor.x)
  const ys = clusters.map((cluster) => cluster.anchor.y)
  const zs = clusters.map((cluster) => cluster.anchor.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    minY,
    extent: Math.max(120, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ)),
  }
}

function cameraSnapshot(camera: CameraLike, controls: OrbitControlsLike): CameraSnapshot {
  const target = controls.target ?? { x: 0, y: 0, z: 0 }
  return {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    tx: target.x,
    ty: target.y,
    tz: target.z,
  }
}

function snapshotDelta(a: CameraSnapshot, b: CameraSnapshot) {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
    Math.abs(a.tx - b.tx),
    Math.abs(a.ty - b.ty),
    Math.abs(a.tz - b.tz),
  )
}

export function BrainGraph({ memoryGraphicsVisible = true, onViewRotationChange }: BrainGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<BrainGraphNode, BrainGraphLink> | undefined>(undefined)
  const inspectorRef = useRef<HTMLElement | null>(null)
  const inspectorAnchorRef = useRef<HTMLParagraphElement | null>(null)
  const selectedConnectorPathRef = useRef<SVGPathElement | null>(null)
  const selectedConnectorDotRef = useRef<SVGCircleElement | null>(null)
  const initialFitDone = useRef(false)
  const lastClusterFocusRef = useRef<{ id: string; at: number } | null>(null)
  const cameraRef = useRef<CameraSnapshot | null>(null)
  const cameraMotionAtRef = useRef(0)
  const cameraMovingRef = useRef(false)
  const nearestClusterRef = useRef<string | null>(null)
  const nearClusterSignatureRef = useRef('')
  const previewCameraRef = useRef<CameraSnapshot | null>(null)
  const lodTransitionTimersRef = useRef<number[]>([])

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
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null)
  const [clusterLabelPoints, setClusterLabelPoints] = useState<ClusterLabelPoint[]>([])
  const [cameraMoving, setCameraMoving] = useState(false)
  const [lodTransitionPhase, setLodTransitionPhase] = useState<LodTransitionPhase>(null)
  const [nearClusterIds, setNearClusterIds] = useState<string[]>([])

  const lodModel = useMemo(() => buildBrainLodModel(rawGraphData), [rawGraphData])
  const graphData = lodModel.data
  const lodLevel = resolveLodLevel(lodMode, 'overview')
  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((node) => [String(node.id), node as BrainGraphNode])),
    [graphData.nodes],
  )

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
        setLodMode('auto')
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
        setLodMode('auto')
        setActiveClusterId(null)
        initialFitDone.current = false
      })

    return () => controller.abort()
  }, [refreshToken])

  useEffect(() => {
    if (!lodModel.clusters.length) {
      setActiveClusterId(null)
      return
    }
    setActiveClusterId((current) => current && lodModel.clusters.some((cluster) => cluster.id === current)
      ? current
      : lodModel.clusters[0].id)
  }, [lodModel.clusters])

  useEffect(() => {
    let timer: number | undefined
    if (selectedNodeId) {
      document.documentElement.classList.add('brain-is-inspecting')
      timer = window.setTimeout(() => setInspectorVisible(true), INSPECTOR_ENTRY_DELAY_MS)
    } else {
      setInspectorVisible(false)
      setPreviewNodeId(null)
      previewCameraRef.current = null
      document.documentElement.classList.remove('brain-is-inspecting')
    }

    return () => {
      if (timer) window.clearTimeout(timer)
      if (!selectedNodeId) document.documentElement.classList.remove('brain-is-inspecting')
    }
  }, [selectedNodeId])

  useEffect(() => () => {
    document.documentElement.classList.remove('brain-is-inspecting')
    lodTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const scene = graph.scene()
    const controls = graph.controls() as OrbitControlsLike
    controls.minPolarAngle = 0.16
    controls.maxPolarAngle = Math.PI / 2 - 0.07

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
    const bounds = clusterBounds(lodModel.clusters)
    const planeSize = Math.max(1500, bounds.extent * 3.2)
    const groundY = bounds.minY - Math.max(62, bounds.extent * 0.11)
    const gridDensity = Math.max(38, Math.min(88, Math.round(planeSize / 28)))
    const gridMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        gridColor: { value: new Color(accent) },
        gridDensity: { value: gridDensity },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 gridColor;uniform float gridDensity;varying vec2 vUv;void main(){vec2 scaled=vUv*gridDensity;vec2 grid=abs(fract(scaled-0.5)-0.5)/max(fwidth(scaled),vec2(0.0001));float line=1.0-min(min(grid.x,grid.y),1.0);float radial=distance(vUv,vec2(0.5));float fade=1.0-smoothstep(0.08,0.7,radial);gl_FragColor=vec4(gridColor,line*fade*0.162);}`,
    })
    const gridGeometry = new PlaneGeometry(planeSize, planeSize)
    const gridPlane = new Mesh(gridGeometry, gridMaterial)
    gridPlane.name = 'hermes-brain-ground-grid'
    gridPlane.rotation.x = -Math.PI / 2
    gridPlane.position.set(bounds.centerX, groundY, bounds.centerZ)
    gridPlane.renderOrder = -2
    scene.add(gridPlane)

    return () => {
      scene.remove(gridPlane)
      gridGeometry.dispose()
      gridMaterial.dispose()
    }
  }, [lodModel.clusters, size.width, size.height])

  const hoveredNode = useMemo(
    () => graphData.nodes.find((node) => String(node.id) === hoveredNodeId) as GraphNode | undefined,
    [graphData.nodes, hoveredNodeId],
  )
  const selectedNeighborhood = useMemo(
    () => buildFocusNeighborhood(graphData.links, selectedNodeId, nodeById),
    [graphData.links, nodeById, selectedNodeId],
  )
  const previewNeighborhood = useMemo(
    () => buildFocusNeighborhood(graphData.links, previewNodeId, nodeById),
    [graphData.links, nodeById, previewNodeId],
  )
  const hoverNeighborhood = useMemo(
    () => buildFocusNeighborhood(graphData.links, !selectedNodeId ? hoveredNodeId : null, nodeById),
    [graphData.links, hoveredNodeId, nodeById, selectedNodeId],
  )

  const previewBridgeKey = useMemo(() => {
    if (!selectedNodeId || !previewNodeId) return null
    const bridge = graphData.links
      .map((rawLink) => rawLink as GraphLink)
      .find((link) => {
        if (!isMemoryLink(link)) return false
        const source = endpointId(link.source as LinkEndpoint)
        const target = endpointId(link.target as LinkEndpoint)
        return (source === selectedNodeId && target === previewNodeId)
          || (source === previewNodeId && target === selectedNodeId)
      })
    return bridge ? graphLinkKey(bridge) : null
  }, [graphData.links, previewNodeId, selectedNodeId])

  const activeCluster = useMemo(
    () => lodModel.clusters.find((cluster) => cluster.id === activeClusterId),
    [activeClusterId, lodModel.clusters],
  )

  const activeClusterStats = useMemo(() => {
    if (!activeCluster) return null
    const members = activeCluster.memberIds
      .map((id) => nodeById.get(id))
      .filter((node): node is BrainGraphNode => Boolean(node))
    const memberSet = new Set(activeCluster.memberIds)
    const explicitLinks = graphData.links.filter((rawLink) => {
      const link = rawLink as BrainGraphLink
      if (link.synthetic !== 'memory' && link.synthetic != null) return false
      const source = endpointId(link.source as LinkEndpoint)
      const target = endpointId(link.target as LinkEndpoint)
      return memberSet.has(source) && memberSet.has(target)
    })
    const backboneLinks = explicitLinks.filter((link) => (link as BrainGraphLink).lodBackbone)
    const relatedClusters = new Set<string>()
    graphData.links.forEach((rawLink) => {
      const link = rawLink as BrainGraphLink
      if (link.synthetic !== 'aggregate') return
      const source = endpointId(link.source as LinkEndpoint)
      const target = endpointId(link.target as LinkEndpoint)
      if (source === activeCluster.id) relatedClusters.add(target)
      if (target === activeCluster.id) relatedClusters.add(source)
    })

    const typeCounts = new Map<string, number>()
    members.forEach((node) => {
      const type = node.factType || 'memory'
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
    })
    const typeSummary = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([type, count]) => `${type} ${count}`)
      .join(' · ')
    const latest = members
      .map((node) => node.occurredAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0]

    return {
      explicitLinks: explicitLinks.length,
      backboneLinks: backboneLinks.length,
      relatedClusters: relatedClusters.size,
      typeSummary: typeSummary || '—',
      latest,
    }
  }, [activeCluster, graphData.links, nodeById])

  const publishViewState = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return

    const now = performance.now()
    if (hoveredNode && Number.isFinite(hoveredNode.x) && Number.isFinite(hoveredNode.y) && Number.isFinite(hoveredNode.z)) {
      let visualX = Number(hoveredNode.x)
      let visualY = Number(hoveredNode.y)
      let visualZ = Number(hoveredNode.z)

      if (hoveredNode.kind === 'cluster') {
        const cluster = lodModel.clusters.find((candidate) => candidate.id === String(hoveredNode.id))
        if (cluster) {
          const offset = clusterVisualOffset(cluster, now)
          visualX += offset.x
          visualY += offset.y
          visualZ += offset.z
        }
      } else if (hoveredNode.kind === 'memory' && hoveredNode.id !== selectedNodeId && hoveredNode.id !== previewNodeId) {
        const offset = memoryVisualOffset(hoveredNode, now)
        visualX += offset.x
        visualY += offset.y
        visualZ += offset.z
      }

      const projected = graph.graph2ScreenCoords(visualX, visualY, visualZ)
      if (Number.isFinite(projected.x) && Number.isFinite(projected.y)) setHoverPoint(projected)
    } else {
      setHoverPoint((current) => current ? null : current)
    }

    const graphCamera = graph.camera() as CameraLike
    const controls = graph.controls() as OrbitControlsLike
    const target = controls.target ?? { x: 0, y: 0, z: 0 }
    const currentSnapshot = cameraSnapshot(graphCamera, controls)
    const previousSnapshot = cameraRef.current
    cameraRef.current = currentSnapshot

    const moved = previousSnapshot ? snapshotDelta(previousSnapshot, currentSnapshot) > 0.035 : false
    if (moved) {
      cameraMotionAtRef.current = now
      if (!cameraMovingRef.current) {
        cameraMovingRef.current = true
        setCameraMoving(true)
      }
    } else if (cameraMovingRef.current && now - cameraMotionAtRef.current > CAMERA_STILL_DELAY_MS) {
      cameraMovingRef.current = false
      setCameraMoving(false)
    }

    if (!selectedNodeId && !inspectorVisible && lodLevel !== 'detail') {
      const overallExtent = clusterBounds(lodModel.clusters).extent
      const projectedClusters = lodModel.clusters.flatMap((cluster) => {
        const node = nodeById.get(cluster.id) as GraphNode | undefined
        if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) return []
        const visualOffset = clusterVisualOffset(cluster, now)
        const visualX = Number(node.x) + visualOffset.x
        const visualY = Number(node.y) + visualOffset.y
        const visualZ = Number(node.z) + visualOffset.z
        const projected = graph.graph2ScreenCoords(visualX, visualY, visualZ)
        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return []
        const screenDistance = Math.hypot(projected.x - size.width / 2, projected.y - size.height / 2)
        const cameraDistance = Math.hypot(
          graphCamera.position.x - visualX,
          graphCamera.position.y - visualY,
          graphCamera.position.z - visualZ,
        )
        return [{ cluster, projected, screenDistance, cameraDistance, proximity: screenDistance + cameraDistance * 0.14 }]
      })

      const byProximity = [...projectedClusters].sort((a, b) => a.proximity - b.proximity)
      const nearest = byProximity[0]
      nearestClusterRef.current = nearest?.cluster.id ?? nearestClusterRef.current
      const nearIds = byProximity.slice(0, Math.min(3, byProximity.length)).map((entry) => entry.cluster.id)
      const signature = nearIds.join('|')
      if (signature !== nearClusterSignatureRef.current) {
        nearClusterSignatureRef.current = signature
        setNearClusterIds(nearIds)
      }

      const cameraDistances = projectedClusters.map((entry) => entry.cameraDistance)
      const minCameraDistance = cameraDistances.length ? Math.min(...cameraDistances) : 0
      const maxCameraDistance = cameraDistances.length ? Math.max(...cameraDistances) : 1
      const distanceSpan = Math.max(1, maxCameraDistance - minCameraDistance)
      const labelBudget = Math.max(3, Math.min(lodModel.clusters.length, Math.floor(size.width / 245)))
      const prominent = [...projectedClusters].sort((a, b) => b.cluster.prominence - a.cluster.prominence)
      const labelIds = new Set<string>()

      if (lodLevel === 'overview') {
        prominent.slice(0, Math.max(1, labelBudget - 1)).forEach((entry) => labelIds.add(entry.cluster.id))
        if (nearest) labelIds.add(nearest.cluster.id)
      } else {
        prominent.slice(0, Math.max(2, Math.ceil(labelBudget * 0.5))).forEach((entry) => labelIds.add(entry.cluster.id))
        if (nearest) labelIds.add(nearest.cluster.id)
        if (activeClusterId) labelIds.delete(activeClusterId)
      }

      const centerThreshold = Math.min(size.width, size.height) * 0.13
      setClusterLabelPoints(projectedClusters
        .filter((entry) => labelIds.has(entry.cluster.id) && entry.cluster.id !== hoveredNodeId)
        .map((entry) => {
          const closeness = 1 - Math.min(1, Math.max(0, (entry.cameraDistance - minCameraDistance) / distanceSpan))
          const distanceScale = 1 + closeness * 0.3
          const centerStrength = Math.max(0, 1 - entry.screenDistance / centerThreshold)
          const centerScale = 1 + centerStrength * 0.44
          const zoomStrength = Math.max(0, Math.min(1, 1 - entry.cameraDistance / Math.max(1, overallExtent * 0.92)))
          const pinLength = 44 + zoomStrength * 42 + centerStrength * 6
          return {
            id: entry.cluster.id,
            label: entry.cluster.label,
            count: entry.cluster.memberCount,
            prominence: entry.cluster.prominence,
            x: entry.projected.x,
            y: entry.projected.y,
            scale: Math.max(distanceScale, centerScale),
            pinLength,
          }
        }))
    } else {
      setClusterLabelPoints((current) => current.length ? [] : current)
    }

    if (onViewRotationChange) {
      const dx = graphCamera.position.x - target.x
      const dy = graphCamera.position.y - target.y
      const dz = graphCamera.position.z - target.z
      const horizontal = Math.max(0.0001, Math.hypot(dx, dz))
      onViewRotationChange({
        yaw: Math.atan2(dx, dz) * 180 / Math.PI,
        pitch: Math.atan2(dy, horizontal) * 180 / Math.PI,
      })
    }
  }, [
    activeClusterId,
    hoveredNode,
    hoveredNodeId,
    inspectorVisible,
    lodLevel,
    lodModel.clusters,
    nodeById,
    onViewRotationChange,
    previewNodeId,
    selectedNodeId,
    size.height,
    size.width,
  ])

  useEffect(() => {
    const timer = window.setInterval(publishViewState, CAMERA_LABEL_SAMPLE_MS)
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
      const selectedGraphNode = nodeById.get(selectedNodeId) as GraphNode | undefined
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
  }, [inspectorVisible, nodeById, selectedNodeId])

  const createNodeObject = useCallback((node: GraphNode) => {
    const id = String(node.id)
    if (node.kind === 'cluster') return createClusterSphere(node, id === hoveredNodeId, lodLevel)

    const freezePosition = id === selectedNodeId || id === previewNodeId
    if (previewNodeId && selectedNodeId) {
      const previewDistance = previewNeighborhood.distances.get(id) ?? null
      const selectedDistance = selectedNeighborhood.distances.get(id) ?? null
      if (previewDistance != null) {
        return createNeuralSphere(node, previewDistance, id === previewNodeId, 'selection', freezePosition)
      }
      return createNeuralSphere(node, selectedDistance, false, 'preview-base', freezePosition)
    }

    if (selectedNodeId) {
      const selectedDistance = selectedNeighborhood.distances.get(id) ?? null
      return createNeuralSphere(node, selectedDistance, id === selectedNodeId, 'selection', freezePosition)
    }

    const hoverDistance = hoveredNode?.kind === 'memory' ? hoverNeighborhood.distances.get(id) ?? null : null
    return createNeuralSphere(
      node,
      hoverDistance,
      false,
      hoveredNode?.kind === 'memory' ? 'hover' : 'normal',
      false,
    )
  }, [
    hoverNeighborhood.distances,
    hoveredNode?.kind,
    hoveredNodeId,
    lodLevel,
    previewNeighborhood.distances,
    previewNodeId,
    selectedNeighborhood.distances,
    selectedNodeId,
  ])

  const selectedNode = useMemo(
    () => selectedNodeId ? nodeById.get(selectedNodeId) : undefined,
    [nodeById, selectedNodeId],
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
        const neighbour = nodeById.get(neighbourId)
        const relationship = (link as BrainGraphLink).relationship || (link as BrainGraphLink).entity || 'related'
        return {
          id: neighbourId,
          label: neighbour?.label || neighbour?.summary || neighbourId,
          relationship,
        }
      })
      .filter((connection) => connection.id && connection.id !== 'core')
  }, [graphData.links, nodeById, selectedNodeId])

  const nodeIsVisible = useCallback((node: BrainGraphNode) => {
    if (!memoryGraphicsVisible) return false
    if (node.kind === 'core') return false
    if (selectedNodeId) {
      if (node.kind === 'cluster') return false
      if (selectedNeighborhood.distances.has(node.id)) return true
      if (previewNodeId && previewNeighborhood.distances.has(node.id)) return true
      return false
    }
    if (node.kind === 'cluster') return lodLevel !== 'detail'
    if (lodLevel === 'overview') return false
    if (lodLevel === 'cluster') return lodModel.representativeNodeIds.has(node.id)
    return node.clusterId === activeClusterId
  }, [
    activeClusterId,
    lodLevel,
    lodModel.representativeNodeIds,
    memoryGraphicsVisible,
    previewNeighborhood.distances,
    previewNodeId,
    selectedNeighborhood.distances,
    selectedNodeId,
  ])

  const linkIsVisible = useCallback((rawLink: BrainGraphLink) => {
    if (!memoryGraphicsVisible) return false
    const link = rawLink as GraphLink
    const typed = rawLink as BrainGraphLink
    const sourceId = endpointId(link.source as LinkEndpoint)
    const targetId = endpointId(link.target as LinkEndpoint)
    const sourceNode = nodeById.get(sourceId)
    const targetNode = nodeById.get(targetId)

    if (typed.synthetic === 'aggregate') return !selectedNodeId && lodLevel !== 'detail'
    if (typed.synthetic === 'membership') {
      if (selectedNodeId || lodLevel === 'overview') return false
      const memoryNode = sourceNode?.kind === 'memory'
        ? sourceNode
        : targetNode?.kind === 'memory'
          ? targetNode
          : undefined
      if (!memoryNode || !nodeIsVisible(memoryNode)) return false
      return lodLevel === 'cluster' || memoryNode.clusterId === activeClusterId
    }

    if (!isMemoryLink(link) || !sourceNode || !targetNode) return false
    const key = graphLinkKey(link)
    if (selectedNodeId) {
      if (selectedNeighborhood.linkKeys.has(key)) return true
      if (previewNodeId && previewNeighborhood.linkKeys.has(key)) return true
      if (previewBridgeKey && key === previewBridgeKey) return true
      return false
    }

    if (!nodeIsVisible(sourceNode) || !nodeIsVisible(targetNode)) return false
    if (hoveredNode?.kind === 'memory' && hoverNeighborhood.linkKeys.has(key)) return true
    if (!typed.lodBackbone) return false
    if (lodLevel === 'overview') return false
    if (lodLevel === 'cluster') return sourceNode.clusterId === targetNode.clusterId
    return sourceNode.clusterId === activeClusterId && targetNode.clusterId === activeClusterId
  }, [
    activeClusterId,
    hoverNeighborhood.linkKeys,
    hoveredNode?.kind,
    lodLevel,
    memoryGraphicsVisible,
    nodeById,
    nodeIsVisible,
    previewBridgeKey,
    previewNeighborhood.linkKeys,
    previewNodeId,
    selectedNeighborhood.linkKeys,
    selectedNodeId,
  ])

  const fitVisibleGraph = useCallback((duration = 420, padding = 150) => {
    const graph = graphRef.current
    if (!graph) return
    graph.zoomToFit(duration, padding, (node) => nodeIsVisible(node as BrainGraphNode))
  }, [nodeIsVisible])

  function refreshGraph() {
    if (source !== 'loading') setRefreshToken((value) => value + 1)
  }

  function selectConnectedMemory(nodeId: string) {
    previewCameraRef.current = null
    setHoveredNodeId(null)
    setPreviewNodeId(null)
    setSelectedNodeId(nodeId)
  }

  function transitionToLod(nextMode: BrainLodMode) {
    lodTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    lodTransitionTimersRef.current = []
    setLodTransitionPhase('out')
    lodTransitionTimersRef.current.push(window.setTimeout(() => {
      setLodMode(nextMode)
      setLodTransitionPhase('in')
    }, 130))
    lodTransitionTimersRef.current.push(window.setTimeout(() => setLodTransitionPhase(null), 420))
  }

  function switchClusterDetail(next: 'cluster' | 'detail') {
    if (next === 'cluster' && lodLevel !== 'cluster') transitionToLod('overview')
    if (next === 'detail' && lodLevel !== 'detail') transitionToLod('detail')
  }

  function focusCluster(node: GraphNode) {
    if (node.kind !== 'cluster') return
    const clusterId = String(node.id)
    const now = performance.now()
    if (lastClusterFocusRef.current?.id === clusterId && now - lastClusterFocusRef.current.at < 420) return
    lastClusterFocusRef.current = { id: clusterId, at: now }

    setActiveClusterId(clusterId)
    setSelectedNodeId(null)
    setPreviewNodeId(null)
    if (lodLevel === 'overview') transitionToLod('overview')

    const graph = graphRef.current
    const cluster = lodModel.clusters.find((candidate) => candidate.id === clusterId)
    if (!graph || !cluster) return

    const target = { x: cluster.anchor.x, y: cluster.anchor.y, z: cluster.anchor.z }
    const camera = graph.camera() as CameraLike
    const dx = camera.position.x - target.x
    const dy = camera.position.y - target.y
    const dz = camera.position.z - target.z
    const length = Math.max(0.0001, Math.hypot(dx, dy, dz))
    const overallExtent = clusterBounds(lodModel.clusters).extent
    const desiredDistance = Math.max(cluster.cloudRadius * 3.55, overallExtent * 0.13)

    graph.cameraPosition({
      x: target.x + dx / length * desiredDistance,
      y: target.y + dy / length * desiredDistance,
      z: target.z + dz / length * desiredDistance,
    }, target, CLUSTER_FOCUS_MS)
  }

  function previewConnectedMemory(nodeId: string) {
    if (!selectedNodeId || nodeId === previewNodeId) return
    const graph = graphRef.current
    const node = nodeById.get(nodeId) as GraphNode | undefined
    if (!graph || !node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) {
      setPreviewNodeId(nodeId)
      return
    }

    const camera = graph.camera() as CameraLike
    const controls = graph.controls() as OrbitControlsLike
    if (!previewCameraRef.current) previewCameraRef.current = cameraSnapshot(camera, controls)
    setPreviewNodeId(nodeId)

    const target = { x: Number(node.x), y: Number(node.y), z: Number(node.z) }
    graph.cameraPosition({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    }, target, PREVIEW_FOCUS_MS)
  }

  function clearConnectedPreview() {
    setPreviewNodeId(null)
    const graph = graphRef.current
    const snapshot = previewCameraRef.current
    if (!graph || !snapshot) return
    previewCameraRef.current = null

    const camera = graph.camera() as CameraLike
    graph.cameraPosition({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    }, {
      x: snapshot.tx,
      y: snapshot.ty,
      z: snapshot.tz,
    }, PREVIEW_FOCUS_MS)
  }

  function cycleLodMode() {
    setSelectedNodeId(null)
    setPreviewNodeId(null)
    previewCameraRef.current = null

    if (lodLevel === 'overview') {
      const clusterId = nearestClusterRef.current ?? activeClusterId ?? lodModel.clusters[0]?.id ?? null
      if (clusterId) setActiveClusterId(clusterId)
      transitionToLod('overview')
      return
    }
    if (lodLevel === 'cluster') {
      transitionToLod('detail')
      return
    }
    transitionToLod('auto')
  }

  const memoryCount = rawGraphData.nodes.filter((node) => node.kind === 'memory').length
  const hoverOverlayPoint = hoverPoint ? { x: hoverPoint.x, y: Math.max(86, hoverPoint.y - 44) } : null
  const maxAggregateCount = Math.max(1, ...graphData.links.map((link) => Number((link as BrainGraphLink).aggregateCount ?? 0)))
  const showClusterFocusUi = Boolean(activeCluster && lodLevel !== 'overview' && !selectedNodeId)
  const nearClusterSet = useMemo(() => new Set(nearClusterIds), [nearClusterIds])

  return (
    <div
      className={`brain-graph ${cameraMoving ? 'is-camera-moving' : ''}`}
      ref={hostRef}
      data-lod={lodLevel}
      data-lod-transition={lodTransitionPhase ?? 'idle'}
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
          const link = rawLink as GraphLink
          const key = graphLinkKey(link)

          if (typed.synthetic === 'membership') return 'rgba(53,217,255,0.12)'
          if (typed.synthetic === 'aggregate') {
            const sourceId = endpointId(link.source as LinkEndpoint)
            const targetId = endpointId(link.target as LinkEndpoint)
            const nearConnection = nearClusterSet.has(sourceId) && nearClusterSet.has(targetId)
            const normalized = Math.sqrt(Math.max(1, typed.aggregateCount ?? 1) / maxAggregateCount)
            const alpha = 0.2 + normalized * 0.3 + (nearConnection ? 0.18 : 0)
            return `rgba(53,217,255,${Math.min(0.72, alpha)})`
          }
          if (previewNodeId && (previewNeighborhood.linkKeys.has(key) || key === previewBridgeKey)) return 'rgba(100,238,255,0.74)'
          if (selectedNodeId && selectedNeighborhood.linkKeys.has(key)) return previewNodeId ? 'rgba(83,229,255,0.34)' : 'rgba(83,229,255,0.68)'
          if (!selectedNodeId && hoveredNode?.kind === 'memory' && hoverNeighborhood.linkKeys.has(key)) return 'rgba(94,234,255,0.72)'
          return 'rgba(53,217,255,0.22)'
        }}
        linkOpacity={0.5}
        linkWidth={(rawLink) => {
          const typed = rawLink as BrainGraphLink
          const link = rawLink as GraphLink
          const key = graphLinkKey(link)

          if (typed.synthetic === 'membership') return 0.075
          if (typed.synthetic === 'aggregate') {
            const sourceId = endpointId(link.source as LinkEndpoint)
            const targetId = endpointId(link.target as LinkEndpoint)
            const nearConnection = nearClusterSet.has(sourceId) && nearClusterSet.has(targetId)
            const normalized = Math.sqrt(Math.max(1, typed.aggregateCount ?? 1) / maxAggregateCount)
            return 0.13 + normalized * 0.2 + (nearConnection ? 0.055 : 0)
          }
          if (previewNodeId && (previewNeighborhood.linkKeys.has(key) || key === previewBridgeKey)) return 0.32
          if (selectedNodeId && selectedNeighborhood.linkKeys.has(key)) return previewNodeId ? 0.18 : 0.31
          if (!selectedNodeId && hoveredNode?.kind === 'memory' && hoverNeighborhood.linkKeys.has(key)) return 0.25
          return 0.12
        }}
        linkDirectionalParticles={(rawLink) => {
          if (!memoryGraphicsVisible) return 0
          const key = graphLinkKey(rawLink as GraphLink)
          if (previewNodeId && (previewNeighborhood.linkKeys.has(key) || key === previewBridgeKey)) return 1
          if (selectedNodeId && !previewNodeId && selectedNeighborhood.linkKeys.has(key)) return 1
          return 0
        }}
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
        cooldownTicks={90}
        warmupTicks={30}
        onEngineStop={() => {
          publishViewState()
          if (!initialFitDone.current) {
            initialFitDone.current = true
            fitVisibleGraph(650, 175)
          }
        }}
        onNodeHover={(node) => {
          if (!memoryGraphicsVisible) return
          setHoveredNodeId(node?.id == null ? null : String(node.id))
        }}
        onNodeClick={(node) => {
          if (!memoryGraphicsVisible) return
          if (node.kind === 'cluster') {
            focusCluster(node as GraphNode)
            return
          }
          previewCameraRef.current = null
          setPreviewNodeId(null)
          setSelectedNodeId((current) => current === String(node.id) ? null : String(node.id))
        }}
        onBackgroundClick={() => {
          if (!memoryGraphicsVisible) return
          previewCameraRef.current = null
          setPreviewNodeId(null)
          setSelectedNodeId(null)
        }}
        enablePointerInteraction={memoryGraphicsVisible}
        enableNodeDrag={false}
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
              '--cluster-label-scale': cluster.scale,
              '--cluster-pin-length': `${cluster.pinLength}px`,
            } as CSSProperties}
          >
            <span>{cluster.label}</span>
            <small>{cluster.count}</small>
          </div>
        ))}
      </div>

      {showClusterFocusUi && activeCluster && activeClusterStats && (
        <>
          <div className="brain-cluster-title" key={`title-${activeCluster.id}`}>
            <h2>{activeCluster.label}</h2>
          </div>
          <div className="brain-cluster-info" key={`info-${activeCluster.id}`}>
            <BrainHudPanel
              title="CLUSTER INFORMATION"
              meta={(
                <span className="brain-cluster-info__mode-toggle" aria-label="Cluster detail view toggle">
                  <button type="button" className={lodLevel === 'cluster' ? 'is-active' : ''} onClick={() => switchClusterDetail('cluster')}>CLUSTER</button>
                  <i aria-hidden="true" />
                  <button type="button" className={lodLevel === 'detail' ? 'is-active' : ''} onClick={() => switchClusterDetail('detail')}>DETAIL</button>
                </span>
              )}
              className="brain-cluster-info__panel"
            >
              <div className="brain-cluster-info__grid">
                <div><span>MEMORIES</span><strong>{activeCluster.memberCount}</strong></div>
                <div><span>RELATED CLUSTERS</span><strong>{activeClusterStats.relatedClusters}</strong></div>
                <div><span>EXPLICIT LINKS</span><strong>{activeClusterStats.explicitLinks}</strong></div>
                <div><span>VISIBLE BACKBONE</span><strong>{activeClusterStats.backboneLinks}</strong></div>
                <div><span>MEMORY TYPES</span><strong>{activeClusterStats.typeSummary}</strong></div>
                <div><span>LATEST MEMORY</span><strong>{formatDate(activeClusterStats.latest)}</strong></div>
              </div>
            </BrainHudPanel>
          </div>
        </>
      )}

      <div className="brain-graph__controls">
        <div className={`brain-graph__phase-label is-${source}`}>
          <span>{source === 'hindsight' ? `HINDSIGHT · ${bankId}` : source === 'loading' ? 'HINDSIGHT · LOADING' : 'MOCK FALLBACK'}</span>
          <strong>{memoryCount} / {totalUnits || memoryCount} NODES · {lodModel.clusters.length} CLUSTERS · {lodLevel === 'overview' ? 'GALAXY' : lodLevel.toUpperCase()}</strong>
        </div>
        <button className="brain-graph__lod" type="button" onClick={cycleLodMode} title="Cycle the manual Brain representation: Galaxy, Cluster, Detail.">
          VIEW · {lodLevel === 'overview' ? 'GALAXY' : lodLevel.toUpperCase()}
        </button>
        <button className="brain-graph__test-add" type="button" onClick={refreshGraph} disabled={source === 'loading'} title="Reload the current Hindsight graph snapshot. Read-only; this does not change memory.">
          {source === 'loading' ? 'SYNCING…' : <><b className="brain-control-icon">↻</b> SYNC GRAPH</>}
        </button>
        <button className="brain-graph__fit" type="button" onClick={() => fitVisibleGraph()} title="Fit only the nodes visible in the current Brain view.">
          <b className="brain-control-icon">◎</b> FIT GRAPH
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
            <p>{hoveredNode.kind === 'cluster' ? `${hoveredNode.memberCount ?? 0} grouped memories · click to focus` : hoveredNode.summary}</p>
          </div>
        </>
      )}

      {selectedNode && selectedNode.kind === 'memory' && inspectorVisible && (
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
                          onMouseEnter={() => previewConnectedMemory(connection.id)}
                          onMouseLeave={clearConnectedPreview}
                          onFocus={() => previewConnectedMemory(connection.id)}
                          onBlur={clearConnectedPreview}
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
