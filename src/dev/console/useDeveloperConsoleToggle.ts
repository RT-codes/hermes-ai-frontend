import { useEffect, useState } from 'react'

/**
 * Owns the global developer-console shortcut policy so the console component does
 * not need to know how keyboard ownership is negotiated with the rest of the app.
 * Shift+Backquote represents the requested `~` toggle; plain backtick remains
 * available as normal text inside the console input.
 */
export function useDeveloperConsoleToggle() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleToggle = (event: globalThis.KeyboardEvent) => {
      const isTildeToggle = event.code === 'Backquote'
        && event.shiftKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey

      if (!isTildeToggle) return

      // Capture and cancel the shortcut before the browser can deliver `~` to a
      // newly focused command input during the same keyboard interaction.
      event.preventDefault()
      event.stopPropagation()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleToggle, true)
    return () => window.removeEventListener('keydown', handleToggle, true)
  }, [])

  return { open, setOpen }
}
