import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const execFileAsync = promisify(execFile)
const TELEMETRY_CACHE_MS = 1500
let telemetryCache: { at: number; payload: unknown } | null = null

type HostSample = {
  cpuName: string
  cpuUsage: number | null
  memoryTotalBytes: number
  memoryFreeBytes: number
  cpuTempC: number | null
  ollamaModels: Array<{
    name: string
    size: number
    sizeVram: number
  }>
}

type GpuSample = {
  name: string
  memoryTotalMb: number
  memoryUsedMb: number
  utilization: number
  temperatureC: number
}

async function collectHostSample(): Promise<HostSample | null> {
  const script = `
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$models = @()
try {
  $models = @((Invoke-RestMethod http://127.0.0.1:11434/api/ps -TimeoutSec 2).models | ForEach-Object {
    [pscustomobject]@{ name = $_.name; size = [int64]$_.size; sizeVram = [int64]$_.size_vram }
  })
} catch {}
[pscustomobject]@{
  cpuName = $cpu.Name
  cpuUsage = [double]$cpu.LoadPercentage
  memoryTotalBytes = [int64]$os.TotalVisibleMemorySize * 1KB
  memoryFreeBytes = [int64]$os.FreePhysicalMemory * 1KB
  cpuTempC = $null
  ollamaModels = $models
} | ConvertTo-Json -Compress -Depth 4
`

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 3500, maxBuffer: 1024 * 1024 },
    )
    return JSON.parse(stdout.trim()) as HostSample
  } catch {
    return null
  }
}

async function collectGpuSample(): Promise<GpuSample | null> {
  const args = [
    '--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu',
    '--format=csv,noheader,nounits',
  ]

  for (const command of ['nvidia-smi', 'nvidia-smi.exe']) {
    try {
      const { stdout } = await execFileAsync(command, args, { timeout: 2500 })
      const firstLine = stdout.trim().split(/\r?\n/)[0]
      const [name, memoryTotalMb, memoryUsedMb, utilization, temperatureC] = firstLine
        .split(',')
        .map((value) => value.trim())

      return {
        name,
        memoryTotalMb: Number(memoryTotalMb),
        memoryUsedMb: Number(memoryUsedMb),
        utilization: Number(utilization),
        temperatureC: Number(temperatureC),
      }
    } catch {
      // Try the Windows executable fallback when the WSL shim is unavailable.
    }
  }

  return null
}

async function collectTelemetry() {
  if (telemetryCache && Date.now() - telemetryCache.at < TELEMETRY_CACHE_MS) {
    return telemetryCache.payload
  }

  const [host, gpu] = await Promise.all([collectHostSample(), collectGpuSample()])
  const memoryUsedBytes = host ? Math.max(0, host.memoryTotalBytes - host.memoryFreeBytes) : null

  const payload = {
    sampledAt: Date.now(),
    host: host
      ? {
          cpuName: host.cpuName,
          cpuUsage: host.cpuUsage,
          cpuTempC: host.cpuTempC,
          memoryTotalBytes: host.memoryTotalBytes,
          memoryUsedBytes,
          memoryUsage: host.memoryTotalBytes > 0 && memoryUsedBytes !== null
            ? (memoryUsedBytes / host.memoryTotalBytes) * 100
            : null,
        }
      : null,
    gpu: gpu
      ? {
          ...gpu,
          memoryUsage: gpu.memoryTotalMb > 0 ? (gpu.memoryUsedMb / gpu.memoryTotalMb) * 100 : null,
        }
      : null,
    ollama: {
      models: host?.ollamaModels ?? [],
    },
  }

  telemetryCache = { at: Date.now(), payload }
  return payload
}

function localTelemetryPlugin(): Plugin {
  return {
    name: 'hermes-local-telemetry',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/system-api/telemetry', async (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        try {
          const payload = await collectTelemetry()
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(payload))
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Telemetry unavailable' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.HERMES_API_TARGET || 'http://127.0.0.1:8642'
  const dashboardTarget = env.HERMES_DASHBOARD_TARGET || 'http://127.0.0.1:9119'
  const hindsightTarget = env.HINDSIGHT_API_TARGET || 'http://127.0.0.1:8889'
  const apiKey = env.HERMES_API_KEY || ''
  const dashboardUsername = env.HERMES_DASHBOARD_USERNAME || ''
  const dashboardPassword = env.HERMES_DASHBOARD_PASSWORD || ''
  const dashboardAuthorization = dashboardUsername && dashboardPassword
    ? `Basic ${Buffer.from(`${dashboardUsername}:${dashboardPassword}`).toString('base64')}`
    : ''

  return {
    plugins: [react(), localTelemetryPlugin()],
    server: {
      proxy: {
        '/hermes-api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-api/, ''),
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
        },
        '/hermes-profile-api': {
          target: dashboardTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-profile-api/, ''),
          headers: dashboardAuthorization ? { Authorization: dashboardAuthorization } : undefined,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
          },
        },
        '/hindsight-api': {
          target: hindsightTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hindsight-api/, ''),
        },
      },
    },
  }
})
