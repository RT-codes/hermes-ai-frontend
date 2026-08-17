import { useRuntimeStatus } from '../../context/RuntimeStatusContext'
import { useSystemTelemetry } from '../../context/SystemTelemetryContext'

function formatGb(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return null
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function formatVram(mb: number | null | undefined) {
  if (mb === null || mb === undefined) return null
  return `${(mb / 1024).toFixed(1)} GB`
}

export function SystemPanel() {
  const { hermesOnline, hindsightOnline, hermesVersion } = useRuntimeStatus()
  const { snapshot } = useSystemTelemetry()
  const loadedModel = snapshot?.ollama.models[0]
  const gpu = snapshot?.gpu
  const host = snapshot?.host

  const rows = [
    {
      label: 'System',
      value: hermesOnline ? `Hermes · v${hermesVersion ?? '?'}` : 'Hermes · OFFLINE',
      state: hermesOnline ? 'is-online' : 'is-offline',
    },
    {
      label: 'Memory',
      value: hindsightOnline ? 'Hindsight · READY' : 'Hindsight · OFFLINE',
      state: hindsightOnline ? 'is-online' : 'is-offline',
    },
    {
      label: 'AI model',
      value: loadedModel ? `Ollama · ${loadedModel.name}` : 'Ollama · NO MODEL',
    },
    gpu ? {
      label: 'GPU',
      value: `${gpu.name} · ${formatVram(gpu.memoryTotalMb) ?? '—'} total`,
    } : null,
    gpu ? {
      label: 'VRAM',
      value: `${formatVram(gpu.memoryUsedMb) ?? '—'} / ${formatVram(gpu.memoryTotalMb) ?? '—'} · ${Math.round(gpu.memoryUsage ?? 0)}%`,
    } : null,
    host?.cpuName ? {
      label: 'CPU',
      value: `${host.cpuName.replace(/\s+/g, ' ').trim()}${host.cpuUsage !== null ? ` · ${Math.round(host.cpuUsage)}%` : ''}`,
    } : null,
    host ? {
      label: 'RAM',
      value: `${formatGb(host.memoryUsedBytes) ?? '—'} / ${formatGb(host.memoryTotalBytes) ?? '—'}`,
    } : null,
    gpu ? {
      label: 'GPU temp',
      value: `${Math.round(gpu.temperatureC)}°C`,
    } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; state?: string }>

  return (
    <div className="system-runtime-list">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong className={row.state}>{row.value}</strong>
        </div>
      ))}
    </div>
  )
}
