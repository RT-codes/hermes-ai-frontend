import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods, GraphData, LinkObject, NodeObject } from 'react-force-graph-3d'
import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import { createMockBrainGraph } from './mockBrainGraph'
import type { BrainGraphLink, BrainGraphNode } from './mockBrainGraph'

type Point = { x: number; y: number }
type LinkEndpoint = string | number | GraphNode | undefined

type BrainGraphProps = {
  onCorePointChange: (point: Point) => void
}

type GraphNode = NodeObject<BrainGraphNode>
type GraphLink = LinkObject<BrainGraphNode, BrainGraphLink>

function endpointId(endpoint: LinkEndpoint) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  return endpoint?.id == null ? '' : String(endpoint.id)
}

function isDirectLink(link: GraphLink, nodeId: string | null) {
  if (!nodeId) return false
  return endpointId(link.source as LinkEndpoint) === nodeId || endpointId(link.target as LinkEndpoint) === nodeId
}

function createNeuralSphere(node: GraphNode, emphasized: boolean) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#35d9ff'
  const radius = 3.8 + Math.max(0, Number(node.val ?? 1)) * 1.45
  const group = new Group()
  const phase = Math.random() * Math.PI * 2

  const body = new Mesh(
    new SphereGeometry(radius, 22, 16),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: emphasized ? 0.68 : 0.34,
      depthWrite: false,
    }),
  )

  const halo = new Mesh(
    new SphereGeometry(radius * 1.5, 18, 12),
    new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: emphasized ? 0.18 : 0.07,
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

export function BrainGraph({ onCorePointChange }: BrainGraphProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<BrainGraphNode, BrainGraphLink> | undefined>(undefined)
  const initialFitDone = useRef(false)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [graphData, setGraphData] = useState<GraphData<BrainGraphNode, BrainGraphLink>>(() => createMockBrainGraph())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [addedCount, setAddedCount] = useState(0)

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
      const source = endpointId(typedLink.source as LinkEndpoint)
      const target = endpointId(typedLink.target as LinkEndpoint)
      if (source === activeId) highlighted.add(target)
      if (target === activeId) highlighted.add(source)
    })
    return highlighted
  }, [graphData.links, hoveredNodeId, selectedNodeId])

  const createNodeObject = useCallback((node: GraphNode) => {
    const emphasized = highlightedNodeIds.has(String(node.id))
    return createNeuralSphere(node, emphasized)
  }, [highlightedNodeIds])

  function addMockMemory() {
    setGraphData((current) => {
      const memoryNodes = current.nodes.filter((node) => (node as GraphNode).kind === 'memory')
      const target = memoryNodes[Math.floor(Math.random() * memoryNodes.length)] as GraphNode | undefined
      const nextIndex = addedCount + 1
      const id = `live-memory-${Date.now()}`
      const nextNode: BrainGraphNode = {
        id,
        label: `Incoming memory ${nextIndex}`,
        summary: 'Synthetic Phase 1 node used to verify live graph updates before Hindsight is connected.',
        kind: 'memory',
        val: 1.1 + Math.random() * 0.45,
      }
      const nextLink: BrainGraphLink = { source: target?.id ? String(target.id) : 'memory', target: id }

      return {
        nodes: [...current.nodes, nextNode],
        links: [...current.links, nextLink],
      }
    })
    setAddedCount((count) => count + 1)
    window.setTimeout(() => graphRef.current?.d3ReheatSimulation(), 0)
  }

  function resetView() {
    setSelectedNodeId(null)
    graphRef.current?.zoomToFit(520, 190, (node) => node.kind !== 'core')
  }

  const activeNodeId = selectedNodeId ?? hoveredNodeId

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
        linkColor={(link) => isDirectLink(link as GraphLink, activeNodeId) ? 'rgba(53,217,255,0.9)' : 'rgba(53,217,255,0.22)'}
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

      <div className="brain-graph__phase-label">
        <span>MEMORY GRAPH · PHASE 1 MOCK DATA</span>
        <strong>{graphData.nodes.length - 1} NODES</strong>
      </div>

      <button className="brain-graph__test-add" type="button" onClick={addMockMemory}>
        + ADD TEST MEMORY
      </button>

      {activeNodeId && (
        <div className="brain-graph__selection-label">
          {selectedNodeId ? 'SELECTED' : 'HOVER'} · {graphData.nodes.find((node) => String(node.id) === activeNodeId)?.label}
        </div>
      )}
    </div>
  )
}
