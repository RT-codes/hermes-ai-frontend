import { useRuntimeStatus } from '../../context/RuntimeStatusContext'
import { useSystemTelemetry } from '../../context/SystemTelemetryContext'

export function SystemPanel() {
  const { hermesOnline, hindsightOnline, hermesVersion, apiModel } = useRuntimeStatus()
  const { snapshot } = useSystemTelemetry()
  const loadedModel = snapshot?.ollama.models[0]

  return (
    <div className="system-runtime-list">
      <div><span>Hermes</span><strong className={hermesOnline ? 'is-online' : 'is-offline'}>{hermesOnline ? `v${hermesVersion ?? '?'}` : 'OFFLINE'}</strong></div>
      <div><span>API model</span><strong>{apiModel ?? '—'}</strong></div>
      <div><span>Hindsight</span><strong className={hindsightOnline ? 'is-online' : 'is-offline'}>{hindsightOnline ? 'READY' : 'OFFLINE'}</strong></div>
      <div><span>Ollama</span><strong>{loadedModel?.name ?? 'NO MODEL'}</strong></div>
      <div><span>GPU</span><strong>{snapshot?.gpu?.name ?? '—'}</strong></div>
    </div>
  )
}
