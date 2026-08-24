import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { BoxGeometry, GridHelper, Group, Mesh, MeshBasicMaterial, TorusGeometry } from 'three'
import { useSpatialApplicationShell } from './SpatialApplicationShell'

type OperationsSpatialGraphicsProps = {
  active: boolean
}

type EmptyNode = { id: string }
type EmptyLink = { source: string; target: string }
type Size = { width: number; height: number }

const emptyGraph = { nodes: [] as EmptyNode[], links: [] as EmptyLink[] }

/**
 * First Operations-owned WebGL payload for the shared spatial shell. This is
 * intentionally schematic rather than product-final: it proves that workspace 3D
 * graphics can be swapped independently from Memory while sharing shell orientation.
 */
export function OperationsSpatialGraphics({ active }: OperationsSpatialGraphicsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<EmptyNode, EmptyLink> | undefined>(undefined)
  const [size, setSize] = useState<Size>({ width: 1, height: 1 })
  const { viewRotation } = useSpatialApplicationShell()

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
    const group = new Group()
    group.name = 'operations-spatial-payload'

    const grid = new GridHelper(1200, 48, 0x35d9ff, 0x16475a)
    grid.position.y = -86
    group.add(grid)

    const ringMaterial = new MeshBasicMaterial({ color: 0x35d9ff, wireframe: true, transparent: true, opacity: 0.28 })
    const ringGeometry = new TorusGeometry(118, 1.6, 8, 96)
    const ring = new Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -38
    group.add(ring)

    const pillarGeometry = new BoxGeometry(12, 116, 12)
    const pillarMaterial = new MeshBasicMaterial({ color: 0x35d9ff, wireframe: true, transparent: true, opacity: 0.24 })
    const anchors = [
      [-170, -30, -120],
      [170, -14, -90],
      [-128, -22, 150],
      [146, -8, 132],
    ] as const

    anchors.forEach(([x, y, z]) => {
      const pillar = new Mesh(pillarGeometry, pillarMaterial)
      pillar.position.set(x, y, z)
      group.add(pillar)
    })

    scene.add(group)
    graph.refresh()
    graph.resumeAnimation()

    return () => {
      scene.remove(group)
      ringGeometry.dispose()
      ringMaterial.dispose()
      pillarGeometry.dispose()
      pillarMaterial.dispose()
      grid.geometry.dispose()
      const gridMaterial = grid.material
      if (Array.isArray(gridMaterial)) gridMaterial.forEach((material) => material.dispose())
      else gridMaterial.dispose()
    }
  }, [size.width, size.height])

  useEffect(() => {
    if (!active) return
    const graph = graphRef.current
    if (!graph) return

    const yaw = viewRotation.yaw * Math.PI / 180
    const pitch = viewRotation.pitch * Math.PI / 180
    const radius = 430
    const horizontalRadius = radius * Math.cos(pitch * 0.58)
    const target = { x: 0, y: -34, z: 0 }

    graph.cameraPosition({
      x: Math.sin(yaw) * horizontalRadius,
      y: 150 + Math.sin(pitch) * 190,
      z: Math.cos(yaw) * horizontalRadius,
    }, target, 0)
    graph.refresh()
  }, [active, viewRotation.pitch, viewRotation.yaw])

  return (
    <div className="operations-spatial-graphics" ref={hostRef} aria-label="Operations 3D graphics layer">
      <ForceGraph3D
        ref={graphRef}
        graphData={emptyGraph}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        enablePointerInteraction={false}
        enableNavigationControls={false}
        enableNodeDrag={false}
        cooldownTicks={0}
      />
    </div>
  )
}
