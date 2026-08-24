import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { HudSurface } from '../../ui/cells/HudSurface/HudSurface'
import {
  executeDeveloperCommand,
  type DeveloperConsoleLine,
} from '../commands/developerCommandRegistry'
import { LayoutZoneOverlay } from '../zones/LayoutZoneOverlay'
import { useDeveloperConsoleToggle } from './useDeveloperConsoleToggle'

type DeveloperConsoleProps = {
  activeWorkspace: string
}

type TranscriptEntry = DeveloperConsoleLine & {
  id: number
}

const INITIAL_TRANSCRIPT: DeveloperConsoleLine[] = [
  { text: 'HERMES FRONTEND DEVELOPER CONSOLE', tone: 'accent' },
  { text: 'Frontend-only diagnostics. Type HELP to inspect available commands.', tone: 'muted' },
]

/**
 * Quake-style frontend diagnostic organism. It owns transcript/history UX while
 * keyboard policy, visual primitives and executable commands live in lower layers.
 */
export function DeveloperConsole({ activeWorkspace }: DeveloperConsoleProps) {
  const { open } = useDeveloperConsoleToggle()
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [zonesVisible, setZonesVisible] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() => (
    INITIAL_TRANSCRIPT.map((line, index) => ({ ...line, id: index + 1 }))
  ))
  const nextLineId = useRef(INITIAL_TRANSCRIPT.length + 1)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const commandContext = useMemo(() => ({
    activeWorkspace,
    registeredLayers: [
      'application-shell',
      'workspace',
      'floating-chat',
      'hermes-insight',
      'developer-overlay',
    ],
    zonesVisible,
    setZonesVisible,
  }), [activeWorkspace, zonesVisible])

  /** Opening the HUD always returns keyboard ownership to its command line. */
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  /** Keep the newest diagnostic output visible without requiring manual scrolling. */
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
  }, [transcript])

  /** Adds console lines while keeping rendering identity independent from command text. */
  const appendLines = (lines: DeveloperConsoleLine[]) => {
    if (lines.length === 0) return
    setTranscript((current) => [
      ...current,
      ...lines.map((line) => ({ ...line, id: nextLineId.current++ })),
    ])
  }

  /** Executes one command through the bounded registry and records the interaction. */
  const submitCommand = (event: FormEvent) => {
    event.preventDefault()
    const command = input.trim()
    if (!command) return

    setHistory((current) => [...current, command])
    setHistoryIndex(null)
    appendLines([{ text: `> ${command}`, tone: 'accent' }])

    const result = executeDeveloperCommand(command, commandContext)
    if (result.clear) {
      setTranscript([])
      nextLineId.current = 1
    } else if (result.lines) {
      appendLines(result.lines)
    }

    setInput('')
  }

  /** Command history mirrors terminal ergonomics without adding shell semantics. */
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (history.length === 0) return

    event.preventDefault()
    const nextIndex = event.key === 'ArrowUp'
      ? Math.max(0, historyIndex == null ? history.length - 1 : historyIndex - 1)
      : Math.min(history.length, historyIndex == null ? history.length : historyIndex + 1)

    if (nextIndex >= history.length) {
      setHistoryIndex(null)
      setInput('')
      return
    }

    setHistoryIndex(nextIndex)
    setInput(history[nextIndex])
    window.requestAnimationFrame(() => inputRef.current?.select())
  }

  return (
    <>
      <LayoutZoneOverlay visible={zonesVisible} />
      <aside
        className={`developer-console ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label="Frontend developer console"
      >
        <HudSurface className="developer-console__surface" />
        <header className="developer-console__header">
          <div>
            <span className="developer-console__eyebrow">DEVELOPER MODE</span>
            <strong>FRONTEND CONSOLE</strong>
          </div>
          <div className="developer-console__meta">
            <span>{activeWorkspace.toUpperCase()}</span>
            <span>FCP.2</span>
          </div>
        </header>

        <div ref={outputRef} className="developer-console__output" aria-live="polite">
          {transcript.map((entry) => (
            <div
              key={entry.id}
              className={`developer-console__line developer-console__line--${entry.tone ?? 'default'}`}
            >
              {entry.text}
            </div>
          ))}
        </div>

        <form className="developer-console__command" onSubmit={submitCommand}>
          <span aria-hidden="true">›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Developer command"
          />
          <button type="submit">SEND</button>
        </form>

        <footer className="developer-console__footer">
          <span>~ TOGGLE</span>
          <span>↑↓ HISTORY</span>
          <span>ZONES SHOW/HIDE</span>
        </footer>
      </aside>
    </>
  )
}
