# Hermes Home Runtime Telemetry

Hermes Home exposes lightweight local runtime information to the browser during development so the Brain view can show useful system state without exposing shell access or hardware commands directly to frontend JavaScript.

## Data path

```text
Browser
  -> GET /system-api/telemetry every ~3 seconds
  -> Vite local middleware
      -> Windows PowerShell/CIM for CPU + physical RAM + Ollama /api/ps
      -> nvidia-smi for GPU, VRAM, utilization, and GPU temperature
  -> JSON snapshot
  -> shared SystemTelemetryProvider
  -> HardwareTelemetryHud + System panel
```

The telemetry endpoint is implemented in `vite.config.ts` and exists on the local Vite server. It does not call Hermes, does not use the LLM, and consumes no model tokens.

## Polling and overhead

- Browser polling interval: approximately 3 seconds.
- Server-side telemetry cache: 1.5 seconds.
- Polling pauses while the page is hidden.
- GPU sampling uses NVIDIA `nvidia-smi` selective queries.
- Host CPU/RAM and Ollama process/model state are collected from Windows through a short non-interactive PowerShell call.
- The UI keeps the most recent 48 samples for the compact VRAM/GPU/CPU sparklines.

This is intentionally a semi-realtime observability layer, not a high-frequency profiler.

## Metrics

Current HUD metrics:

- GPU name
- GPU utilization
- VRAM used / total and percentage
- GPU temperature
- CPU utilization
- Windows physical RAM used / total
- currently loaded Ollama model
- fraction of the loaded model reported in VRAM
- VRAM, GPU, and CPU sparkline history

### CPU temperature

CPU package temperature is deliberately shown as `SENSOR N/A` unless a trustworthy sensor source is added later. Windows ACPI thermal-zone values are not assumed to represent the actual CPU package temperature.

## Runtime health panels

The top status pill and the floating Activity/System panels now poll real local endpoints instead of showing fixed placeholder labels:

- Hermes `/health`
- Hermes `/v1/models`
- Hindsight `/docs`
- local telemetry endpoint
- browser chat session activity/errors

Hindsight is reached through the server-side `/hindsight-api` Vite proxy.

## Security boundary

- `HERMES_API_KEY` remains server-side in `.env.local`.
- `.env` and `.env.*` are ignored by Git, while `.env.example` remains tracked.
- The browser never receives a shell command or API secret.
- Raw Hermes port `8642` remains intended for local host access; the household-facing frontend can be exposed separately later.

## Production note

The current telemetry route is a Vite development-server middleware. When Hermes Home moves from Vite dev hosting to the planned LAN production service, this collector should move into that local backend/reverse-proxy process rather than being reimplemented in browser code.
