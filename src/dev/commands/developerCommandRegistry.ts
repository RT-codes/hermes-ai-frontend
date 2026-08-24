import { layoutZones, type LayoutZoneId } from '../zones/layoutZones'

export type DeveloperConsoleTone = 'default' | 'accent' | 'muted' | 'warning'

export type DeveloperConsoleLine = {
  text: string
  tone?: DeveloperConsoleTone
}

export type DeveloperCommandContext = {
  activeWorkspace: string
  registeredLayers: string[]
  activeZoneIds: ReadonlySet<LayoutZoneId>
  setActiveZoneIds: (zoneIds: Set<LayoutZoneId>) => void
}

export type DeveloperCommandResult = {
  clear?: boolean
  lines?: DeveloperConsoleLine[]
}

type DeveloperCommand = {
  name: string
  aliases?: string[]
  usage: string
  description: string
  run: (args: string[], context: DeveloperCommandContext) => DeveloperCommandResult
}

const allZoneIds = layoutZones.map((zone) => zone.id)
const zoneIdSet = new Set<LayoutZoneId>(allZoneIds)

/** Resolves user text to a canonical zone id without inventing aliases implicitly. */
function parseZoneId(value: string | undefined): LayoutZoneId | null {
  if (!value) return null
  const normalized = value.toLowerCase() as LayoutZoneId
  return zoneIdSet.has(normalized) ? normalized : null
}

/** Builds a compact diagnostic summary that remains readable in the Quake console. */
function zoneStatusLines(context: DeveloperCommandContext): DeveloperConsoleLine[] {
  if (context.activeZoneIds.size === 0) {
    return [{ text: 'LAYOUT ZONES  HIDDEN', tone: 'accent' }]
  }

  return [
    { text: `LAYOUT ZONES  ${context.activeZoneIds.size}/${allZoneIds.length} VISIBLE`, tone: 'accent' },
    ...layoutZones.map((zone) => ({
      text: `${context.activeZoneIds.has(zone.id) ? 'ON ' : 'OFF'}  ${zone.id.padEnd(16)} ${zone.label}`,
      tone: context.activeZoneIds.has(zone.id) ? 'default' as const : 'muted' as const,
    })),
  ]
}

/**
 * The developer console intentionally exposes a small, explicit command surface.
 * Keeping diagnostics behind a registry makes later FCP tools discoverable without
 * coupling the console UI to workspace internals or host-shell execution.
 */
const commands: DeveloperCommand[] = [
  {
    name: 'help',
    aliases: ['?'],
    usage: 'help',
    description: 'List the developer commands registered in this frontend build.',
    run: () => ({
      lines: commands.map((command) => ({
        text: `${command.usage.padEnd(32)} ${command.description}`,
        tone: command.name === 'help' ? 'accent' : 'default',
      })),
    }),
  },
  {
    name: 'clear',
    aliases: ['cls'],
    usage: 'clear',
    description: 'Clear the developer console transcript.',
    run: () => ({ clear: true }),
  },
  {
    name: 'workspace',
    usage: 'workspace',
    description: 'Show the workspace identity currently owned by the app shell.',
    run: (_args, context) => ({
      lines: [{ text: `ACTIVE WORKSPACE  ${context.activeWorkspace.toUpperCase()}`, tone: 'accent' }],
    }),
  },
  {
    name: 'layers',
    usage: 'layers',
    description: 'List the frontend layers currently registered with the dev console.',
    run: (_args, context) => ({
      lines: context.registeredLayers.map((layer) => ({ text: layer, tone: 'muted' })),
    }),
  },
  {
    name: 'zones',
    usage: 'zones <show|hide|toggle|only|all|status> [zone]',
    description: 'Inspect or control all/individual diagnostic layout zones.',
    run: (args, context) => {
      const action = (args[0] ?? 'status').toLowerCase()
      const requestedZone = parseZoneId(args[1])
      const current = new Set(context.activeZoneIds)

      if (action === 'status') return { lines: zoneStatusLines(context) }

      if (action === 'all') {
        context.setActiveZoneIds(new Set(allZoneIds))
        return { lines: [{ text: 'LAYOUT ZONES  ALL VISIBLE', tone: 'accent' }] }
      }

      if (action === 'show' && !args[1]) {
        context.setActiveZoneIds(new Set(allZoneIds))
        return { lines: [{ text: 'LAYOUT ZONES  ALL VISIBLE', tone: 'accent' }] }
      }

      if (action === 'hide' && !args[1]) {
        context.setActiveZoneIds(new Set())
        return { lines: [{ text: 'LAYOUT ZONES  HIDDEN', tone: 'accent' }] }
      }

      if (action === 'toggle' && !args[1]) {
        const next = current.size > 0 ? new Set<LayoutZoneId>() : new Set(allZoneIds)
        context.setActiveZoneIds(next)
        return { lines: [{ text: `LAYOUT ZONES  ${next.size > 0 ? 'ALL VISIBLE' : 'HIDDEN'}`, tone: 'accent' }] }
      }

      if (!requestedZone) {
        return {
          lines: [
            { text: `UNKNOWN ZONE  ${args[1] ?? '(missing)'}`, tone: 'warning' },
            { text: `Zones: ${allZoneIds.join(', ')}`, tone: 'muted' },
          ],
        }
      }

      if (action === 'show') current.add(requestedZone)
      else if (action === 'hide') current.delete(requestedZone)
      else if (action === 'toggle') {
        if (current.has(requestedZone)) current.delete(requestedZone)
        else current.add(requestedZone)
      } else if (action === 'only') {
        current.clear()
        current.add(requestedZone)
      } else {
        return {
          lines: [
            { text: `UNKNOWN ZONES ACTION  ${action}`, tone: 'warning' },
            { text: 'Usage: zones <show|hide|toggle|only|all|status> [zone]', tone: 'muted' },
          ],
        }
      }

      context.setActiveZoneIds(current)
      return {
        lines: [
          { text: `${current.has(requestedZone) ? 'ON ' : 'OFF'}  ${requestedZone}`, tone: 'accent' },
          { text: `${current.size}/${allZoneIds.length} zones visible`, tone: 'muted' },
        ],
      }
    },
  },
  {
    name: 'echo',
    usage: 'echo <text>',
    description: 'Write text into the developer console transcript.',
    run: (args) => ({ lines: [{ text: args.join(' ') || '(empty)', tone: 'default' }] }),
  },
]

/**
 * Resolves user input to one bounded frontend command. Unknown commands remain
 * visible as diagnostics rather than falling through to an implicit execution path.
 */
export function executeDeveloperCommand(input: string, context: DeveloperCommandContext): DeveloperCommandResult {
  const normalized = input.trim()
  if (!normalized) return {}

  const [rawCommand, ...args] = normalized.split(/\s+/)
  const commandName = rawCommand.toLowerCase()
  const command = commands.find((candidate) => (
    candidate.name === commandName || candidate.aliases?.includes(commandName)
  ))

  if (!command) {
    return {
      lines: [
        { text: `UNKNOWN COMMAND  ${rawCommand}`, tone: 'warning' },
        { text: 'Type HELP to inspect the registered developer surface.', tone: 'muted' },
      ],
    }
  }

  return command.run(args, context)
}
