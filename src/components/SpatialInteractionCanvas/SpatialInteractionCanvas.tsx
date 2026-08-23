import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'

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
    const geometry = new PlaneGeometry(1600, 1600, 1, 1)
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;

        float gridLine(vec2 uv, float divisions, float width) {
          vec2 coord = uv * divisions;
          vec2 edge = min(fract(coord), 1.0 - fract(coord));
          float line = min(edge.x, edge.y);
          return 1.0 - smoothstep(0.0, width, line);
        }

        void main() {
          vec2 centered = abs(vUv - 0.5) * 2.0;
          float edgeDistance = max(centered.x, centered.y);
          float edgeFade = 1.0 - smoothstep(0.56, 0.96, edgeDistance);

          float fine = gridLine(vUv, 64.0, 0.055);
          float major = gridLine(vUv, 8.0, 0.04);
          float strength = max(fine * 0.34, major * 0.72);

          vec3 fineColor = vec3(0.21, 0.85, 1.0);
          vec3 majorColor = vec3(0.77, 0.96, 1.0);
          vec3 color = mix(fineColor, majorColor, major);
          float alpha = strength * edgeFade * 0.30;

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })
    const floor = new Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -92

    scene.add(floor)
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
      scene.remove(floor)
      geometry.dispose()
      material.dispose()
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
