import { useEffect, useMemo, useState, type CSSProperties } from 'react'

type TimelineMarker = {
  id: string
  at: string
  label: string
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success'
  detail?: string
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

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatTick(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function markerPosition(at: string, startMs: number, endMs: number) {
  const value = new Date(at).getTime()
  if (!Number.isFinite(value) || endMs <= startMs) return null
  return ((value - startMs) / (endMs - startMs)) * 100
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
  const activeRange = rangeMinutes ?? internalRange

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const setRange = (minutes: number) => {
    if (onRangeMinutesChange) onRangeMinutesChange(minutes)
    else setInternalRange(minutes)
  }

  const { startMs, endMs, ticks } = useMemo(() => {
    const end = now.getTime()
    const start = end - activeRange * 60_000
    const tickCount = activeRange <= 30 ? 6 : activeRange <= 60 ? 6 : activeRange <= 120 ? 8 : 8
    const values = Array.from({ length: tickCount + 1 }, (_, index) => {
      const ratio = index / tickCount
      return {
        ratio,
        at: new Date(start + (end - start) * ratio),
      }
    })
    return { startMs: start, endMs: end, ticks: values }
  }, [activeRange, now])

  const visibleMarkers = useMemo(
    () => markers
      .map((marker) => ({ marker, position: markerPosition(marker.at, startMs, endMs) }))
      .filter((entry): entry is { marker: TimelineMarker; position: number } => entry.position != null && entry.position >= 0 && entry.position <= 100),
    [endMs, markers, startMs],
  )

  return (
    <div className={`timeline-hud ${className}`}>
      <div className="timeline-hud__frame" aria-hidden="true" />
      <header className="timeline-hud__header">
        <div>
          <span className="timeline-hud__eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <div className="timeline-hud__controls" aria-label="Timeline range">
          {RANGE_OPTIONS.map((minutes) => (
            <button
              type="button"
              key={minutes}
              className={activeRange === minutes ? 'is-active' : ''}
              onClick={() => setRange(minutes)}
            >
              {minutes < 60 ? `${minutes}M` : `${minutes / 60}H`}
            </button>
          ))}
        </div>
      </header>

      <div className="timeline-hud__rail-wrap">
        <div className="timeline-hud__rail">
          <span className="timeline-hud__past-glow" />

          {ticks.map((tick) => (
            <span
              className="timeline-hud__tick"
              key={tick.at.getTime()}
              style={{ '--timeline-position': `${tick.ratio * 100}%` } as CSSProperties}
            >
              <i />
              <small>{formatTick(tick.at)}</small>
            </span>
          ))}

          {visibleMarkers.map(({ marker, position }) => (
            <span
              key={marker.id}
              className={`timeline-hud__marker timeline-hud__marker--${marker.tone ?? 'default'}`}
              style={{ '--timeline-position': `${position}%` } as CSSProperties}
              title={marker.detail ? `${marker.label} — ${marker.detail}` : marker.label}
            >
              <i />
              <small>{marker.label}</small>
            </span>
          ))}

          <span className="timeline-hud__now">
            <i />
            <small>NOW</small>
          </span>
        </div>
      </div>

      <footer className="timeline-hud__footer">
        <span>WINDOW {activeRange} MIN</span>
        <time>{formatClock(now)}</time>
      </footer>
    </div>
  )
}

export type { TimelineMarker }
