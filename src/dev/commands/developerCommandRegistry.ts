export type DeveloperConsoleTone = 'default' | 'accent' | 'muted' | 'warning'

export type DeveloperConsoleLine = {
  text: string
  tone?: DeveloperConsoleTone
}

export type DeveloperCommandContext = {
  activeWorkspace: string
  registeredLayers: string[]
  zonesVisible: boolean
  setZonesVisible: (visible: boolean) => void
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
        text: `${command.usage.padEnd(22)} ${command.description}`,
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
    usage: 'zones <show|hide|toggle|status>',
    description: 'Inspect or toggle the FCP diagnostic layout-zone overlay.',
    run: (args, context) => {
      const action = (args[0] ?? 'status').toLowerCase()
      let nextVisible = context.zonesVisible

      if (action === 'show') nextVisible = true
      else if (action === 'hide') nextVisible = false
      else if (action === 'toggle') nextVisible = !context.zonesVisible
      else if (action !== 'status') {
        return {
          lines: [
            { text: `UNKNOWN ZONES ACTION  ${action}`, tone: 'warning' },
            { text: 'Usage: zones <show|hide|toggle|status>', tone: 'muted' },
          ],
        }
      }

      if (nextVisible !== context.zonesVisible) context.setZonesVisible(nextVisible)
      return {
        lines: [{ text: `LAYOUT ZONES  ${nextVisible ? 'VISIBLE' : 'HIDDEN'}`, tone: 'accent' }],
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
