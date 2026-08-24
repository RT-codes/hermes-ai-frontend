import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ForceGraphMethods } from 'react-force-graph-3d'
import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { useSpatialApplicationShell } from '../../app/spatial/SpatialApplicationShell'

type SpatialNode = { id: string }
type SpatialLink = { source: string; target: string }

type Size = {
  width: number
  height: number
}

type CameraLike = { position: { x: number; y: number; z: number } }
type ControlsLike = { target?: { x: number; y: number; z: number }; enableDamping?: boolean; dampingFactor?: number; minDistance?: number; maxDistance?: number }

const emptyGraph = { nodes: [] as SpatialNode[], links: [] as SpatialLink[] }

/**
 * Transitional Operations interaction layer. It still owns a temporary ForceGraph3D
 * canvas, but camera pose and orientation are exported to the spatial application shell
 * so switching workspaces preserves view state and the later single-camera migration can
 * replace this canvas without changing the workspace contract.
 */
export function SpatialInteractionCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<SpatialNode, SpatialLink> | undefined>(undefined)
  const [size, setSize] = useState<Size>({ width: 1, height: 1 })
  const { getCameraPose, saveCameraPose, reportViewRotation } = useSpatialApplicationShell()

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

          float fine = gridLine(vUv, 72.0, 0.05);
          float major = gridLine(vUv, 9.0, 0.032);
          float strength = max(fine * 0.34, major * 0.14);

          vec3 fineColor = vec3(0.21, 0.85, 1.0);
          vec3 majorColor = vec3(0.62, 0.91, 1.0);
          vec3 color = mix(fineColor, majorColor, major * 0.28);
          float alpha = strength * edgeFade * 0.28;

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })
    const floor = new Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -92

    scene.add(floor)

    const savedPose = getCameraPose('operations')
    graph.cameraPosition(
      savedPose?.position ?? { x: 0, y: 195, z: 440 },
      savedPose?.target ?? { x: 0, y: -48, z: 0 },
      0,
    )

    const controls = graph.controls() as ControlsLike
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 70
    controls.maxDistance = 1300

    const publishCameraPose = () => {
      const camera = graph.camera() as CameraLike
      const target = controls.target ?? { x: 0, y: 0, z: 0 }
      saveCameraPose('operations', {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: target.x, y: target.y, z: target.z },
      })

      const dx = camera.position.x - target.x
      const dy = camera.position.y - target.y
      const dz = camera.position.z - target.z
      const horizontal = Math.max(0.0001, Math.hypot(dx, dz))
      reportViewRotation({
        yaw: Math.atan2(dx, dz) * 180 / Math.PI,
        pitch: Math.atan2(dy, horizontal) * 180 / Math.PI,
      })
    }

    publishCameraPose()
    const timer = window.setInterval(publishCameraPose, 80)

    return () => {
      window.clearInterval(timer)
      publishCameraPose()
      scene.remove(floor)
      geometry.dispose()
      material.dispose()
    }
  }, [getCameraPose, reportViewRotation, saveCameraPose, size.width, size.height])

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
