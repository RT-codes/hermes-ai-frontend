import { useSystemTelemetry } from '../../context/SystemTelemetryContext'
import { BrainHudPanel } from '../BrainHudPanel/BrainHudPanel'

function clamp(value: number) {
  return Math.min(100, Math.max(0, value))
}

function formatGb(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return '—'
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function formatVram(mb: number | null | undefined) {
  if (mb === null || mb === undefined) return '—'
  return `${(mb / 1024).toFixed(1)} GB`
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="telemetry-sparkline telemetry-sparkline--empty" />
  }

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 28 - (clamp(value) / 100) * 26
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg className="telemetry-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function HardwareTelemetryHud() {
  const { snapshot, history, error } = useSystemTelemetry()
  const gpu = snapshot?.gpu
  const host = snapshot?.host
  const model = snapshot?.ollama.models[0]
  const modelGpuPercent = model && model.size > 0 ? Math.round((model.sizeVram / model.size) * 100) : null

  return (
    <BrainHudPanel
      title="LOCAL COMPUTE"
      meta={error ? 'DEGRADED' : 'LIVE · 3S'}
      ariaLabel="Live hardware telemetry"
      className="hardware-hud-panel"
    >
      <div className="hardware-hud__identity">
        <strong>{gpu?.name ?? 'GPU telemetry unavailable'}</strong>
        <span>{model ? `${model.name} · ${modelGpuPercent ?? 0}% model bytes in VRAM` : 'No Ollama model currently loaded'}</span>
      </div>

      <div className="hardware-hud__metrics">
        <div><span>GPU</span><strong>{gpu ? `${Math.round(gpu.utilization)}%` : '—'}</strong></div>
        <div><span>VRAM</span><strong>{gpu ? `${formatVram(gpu.memoryUsedMb)} / ${formatVram(gpu.memoryTotalMb)}` : '—'}</strong></div>
        <div><span>GPU TEMP</span><strong>{gpu ? `${Math.round(gpu.temperatureC)}°C` : '—'}</strong></div>
        <div><span>CPU</span><strong>{host?.cpuUsage !== null && host?.cpuUsage !== undefined ? `${Math.round(host.cpuUsage)}%` : '—'}</strong></div>
        <div><span>RAM</span><strong>{host ? `${formatGb(host.memoryUsedBytes)} / ${formatGb(host.memoryTotalBytes)}` : '—'}</strong></div>
        <div><span>CPU TEMP</span><strong>{host?.cpuTempC !== null && host?.cpuTempC !== undefined ? `${Math.round(host.cpuTempC)}°C` : 'SENSOR N/A'}</strong></div>
      </div>

      <div className="hardware-hud__graphs">
        <div className="telemetry-graph-row">
          <span>VRAM</span>
          <Sparkline values={history.map((point) => point.vram)} />
          <strong>{gpu?.memoryUsage !== null && gpu?.memoryUsage !== undefined ? `${Math.round(gpu.memoryUsage)}%` : '—'}</strong>
        </div>
        <div className="telemetry-graph-row">
          <span>GPU</span>
          <Sparkline values={history.map((point) => point.gpu)} />
          <strong>{gpu ? `${Math.round(gpu.utilization)}%` : '—'}</strong>
        </div>
        <div className="telemetry-graph-row">
          <span>CPU</span>
          <Sparkline values={history.map((point) => point.cpu)} />
          <strong>{host?.cpuUsage !== null && host?.cpuUsage !== undefined ? `${Math.round(host.cpuUsage)}%` : '—'}</strong>
        </div>
      </div>

      {host?.cpuName && (
        <div className="hardware-hud__footer">
          {host.cpuName.replace(/\s+/g, ' ').trim()}
        </div>
      )}
    </BrainHudPanel>
  )
}
