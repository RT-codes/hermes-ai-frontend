import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { Color, GridHelper } from 'three'
import type { Material } from 'three'

type SpatialNode = { id: string }
type SpatialLink = { source: string; target: string }

type Size = {
  width: number
  height: number
}

const emptyGraph = { nodes: [] as SpatialNode[], links: [] as SpatialLink[] }

export function SpatialInteractionCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<SpatialNode, SpatialLink> | undefined>(undefined)
  const [size, setSize] = useState<Size>({ width: 1, height: 1 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const updateSize = () => {
      const rect = host.getBoundingClientRect()
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    const scene = graph.scene()
    const grid = new GridHelper(1400, 56, new Color('#d8f8ff'), new Color('#35d9ff'))
    grid.position.y = -92

    const materials = Array.isArray(grid.material) ? grid.material : [grid.material]
    materials.forEach((material: Material) => {
      material.transparent = true
      material.opacity = 0.18
      material.depthWrite = false
    })

    scene.add(grid)
    graph.cameraPosition({ x: 0, y: 165, z: 360 }, { x: 0, y: -48, z: 0 }, 0)

    const controls = graph.controls() as {
      enableDamping?: boolean
      dampingFactor?: number
      minDistance?: number
      maxDistance?: number
    }
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 70
    controls.maxDistance = 1300

    return () => {
      scene.remove(grid)
      grid.geometry.dispose()
      materials.forEach((material) => material.dispose())
    }
  }, [size.width, size.height])

  return (
    <div className="spatial-interaction-canvas" ref={hostRef} aria-label="Interactive Operations 3D environment">
      <ForceGraph3D<SpatialNode, SpatialLink>
        ref={graphRef}
        graphData={emptyGraph}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        controlType="orbit"
        showNavInfo={false}
        enableNodeDrag={false}
        enableNavigationControls
        cooldownTicks={0}
      />
    </div>
  )
}
