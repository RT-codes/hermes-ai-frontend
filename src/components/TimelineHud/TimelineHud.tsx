import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'

type TimelineMarker = {
  id: string
  at: string
  label: string
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success'
  detail?: string
  color?: string
}

type TimelineHudProps = {
  className?: string
  eyebrow?: string
  title?: string
  markers?: TimelineMarker[]
  rangeMinutes?: number
  onRangeMinutesChange?: (minutes: number) => void
}

const RANGE_OPTIONS = [30, 60, 120, 240] as const
const MIN_RANGE_MINUTES = 1
const MAX_RANGE_MINUTES = 7 * 24 * 60
const TICK_STEPS_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120, 240, 360, 720, 1440] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatTick(date: Date, rangeMinutes: number) {
  if (rangeMinutes >= 24 * 60) {
    return date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatWindow(minutes: number) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} MIN`
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const remainder = Math.round(minutes % 60)
    return remainder ? `${hours}H ${remainder}M` : `${hours}H`
  }
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.round((minutes % (24 * 60)) / 60)
  return hours ? `${days}D ${hours}H` : `${days}D`
}

function markerPosition(at: string, startMs: number, endMs: number) {
  const value = new Date(at).getTime()
  if (!Number.isFinite(value) || endMs <= startMs) return null
  return ((value - startMs) / (endMs - startMs)) * 100
}

function nearestPreset(rangeMinutes: number) {
  return RANGE_OPTIONS.reduce((best, option) => {
    const bestDistance = Math.abs(Math.log(rangeMinutes / best))
    const optionDistance = Math.abs(Math.log(rangeMinutes / option))
    return optionDistance < bestDistance ? option : best
  }, RANGE_OPTIONS[0])
}

function tickStepForRange(rangeMinutes: number) {
  const target = rangeMinutes / 8
  return TICK_STEPS_MINUTES.find((step) => step >= target) ?? TICK_STEPS_MINUTES[TICK_STEPS_MINUTES.length - 1]
}

export function TimelineHud({
  className = '',
  eyebrow = 'TEMPORAL TRACE',
  title = 'LIVE TIMELINE',
  markers = [],
  rangeMinutes,
  onRangeMinutesChange,
}: TimelineHudProps) {
  const [now, setNow] = useState(() => new Date())
  const [internalRange, setInternalRange] = useState(60)
  const [scrubAtMs, setScrubAtMs] = useState<number | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const activeRange = clamp(rangeMinutes ?? internalRange, MIN_RANGE_MINUTES, MAX_RANGE_MINUTES)
  const highlightedPreset = nearestPreset(activeRange)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const setRange = (minutes: number) => {
    const next = clamp(minutes, MIN_RANGE_MINUTES, MAX_RANGE_MINUTES)
    if (onRangeMinutesChange) onRangeMinutesChange(next)
    else setInternalRange(next)
  }

  const { startMs, endMs, ticks } = useMemo(() => {
    const end = now.getTime()
    const start = end - activeRange * 60_000
    const stepMinutes = tickStepForRange(activeRange)
    const stepMs = stepMinutes * 60_000
    const firstTick = Math.ceil(start / stepMs) * stepMs
    const values: Array<{ ratio: number; at: Date }> = []

    for (let value = firstTick; value <= end; value += stepMs) {
      values.push({
        ratio: (value - start) / (end - start),
        at: new Date(value),
      })
    }

    return { startMs: start, endMs: end, ticks: values }
  }, [activeRange, now])

  useEffect(() => {
    setScrubAtMs((current) => {
      if (current == null) return null
      return clamp(current, startMs, endMs)
    })
  }, [endMs, startMs])

  const visibleMarkers = useMemo(
    () => markers
      .map((marker) => ({ marker, position: markerPosition(marker.at, startMs, endMs) }))
      .filter((entry): entry is { marker: TimelineMarker; position: number } => entry.position != null && entry.position >= 0 && entry.position <= 100),
    [endMs, markers, startMs],
  )

  const playheadMs = scrubAtMs ?? endMs
  const playheadPosition = clamp(((playheadMs - startMs) / (endMs - startMs)) * 100, 0, 100)
  const playheadAtNow = scrubAtMs == null || endMs - playheadMs < 1500

  const setPlayheadFromClientX = (clientX: number) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    if (ratio >= 0.998) {
      setScrubAtMs(null)
      return
    }
    setScrubAtMs(startMs + ratio * (endMs - startMs))
  }

  const handlePlayheadDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setPlayheadFromClientX(event.clientX)
  }

  const handlePlayheadMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return
    setPlayheadFromClientX(event.clientX)
  }

  const handlePlayheadUp = (event: PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = Math.exp(event.deltaY * 0.0014)
    setRange(Number((activeRange * factor).toFixed(2)))
  }

  return (
    <div className={`timeline-hud ${className}`}>
      <div className="timeline-hud__frame" aria-hidden="true" />
      <header className="timeline-hud__header">
        <div>
          <span className="timeline-hud__eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <div className="timeline-hud__controls" aria-label="Timeline range presets">
          {RANGE_OPTIONS.map((minutes) => (
            <button
              type="button"
              key={minutes}
              className={highlightedPreset === minutes ? 'is-active' : ''}
              onClick={() => setRange(minutes)}
              title={`Snap timeline window to ${formatWindow(minutes)}`}
            >
              {minutes < 60 ? `${minutes}M` : `${minutes / 60}H`}
            </button>
          ))}
        </div>
      </header>

      <div className="timeline-hud__rail-wrap">
        <div className="timeline-hud__rail" ref={railRef} onWheel={handleWheel}>
          <span className="timeline-hud__axis" aria-hidden="true" />

          {ticks.map((tick) => (
            <span
              className="timeline-hud__tick"
              key={tick.at.getTime()}
              style={{ '--timeline-position': `${tick.ratio * 100}%` } as CSSProperties}
            >
              <i />
              <small>{formatTick(tick.at, activeRange)}</small>
            </span>
          ))}

          {visibleMarkers.map(({ marker, position }) => (
            <span
              key={marker.id}
              className={`timeline-hud__marker timeline-hud__marker--${marker.tone ?? 'default'}`}
              style={{
                '--timeline-position': `${position}%`,
                '--timeline-marker-color': marker.color ?? undefined,
              } as CSSProperties}
              title={marker.detail ? `${marker.label} — ${marker.detail}` : marker.label}
            >
              <i />
              <small>{marker.label}</small>
            </span>
          ))}

          <span className="timeline-hud__now-terminal" aria-hidden="true">
            <i />
            <small>NOW</small>
          </span>

          <button
            type="button"
            className={`timeline-hud__playhead ${playheadAtNow ? 'is-live' : ''}`}
            style={{ '--timeline-position': `${playheadPosition}%` } as CSSProperties}
            onPointerDown={handlePlayheadDown}
            onPointerMove={handlePlayheadMove}
            onPointerUp={handlePlayheadUp}
            onPointerCancel={handlePlayheadUp}
            aria-label="Timeline playhead. Drag to scrub through history."
            title="Drag to scrub through time"
          >
            <i />
            <span>{playheadAtNow ? 'LIVE' : 'TRACE'}</span>
            <time>{formatClock(new Date(playheadMs))}</time>
          </button>
        </div>
      </div>

      <footer className="timeline-hud__footer">
        <span>WINDOW {formatWindow(activeRange)} · WHEEL TO ZOOM</span>
        <time>{playheadAtNow ? `NOW ${formatClock(now)}` : new Date(playheadMs).toLocaleString()}</time>
      </footer>
    </div>
  )
}

export type { TimelineMarker }
