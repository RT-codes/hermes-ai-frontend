/**
 * Telemetry formatters keep unit conversion rules consistent across HUD and system
 * views. Callers decide their own empty-state copy instead of baking presentation
 * fallbacks into these helpers.
 */
export function formatGigabytesFromBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined) return null
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

/** Convert megabyte-based GPU telemetry to the same one-decimal GB presentation. */
export function formatGigabytesFromMegabytes(megabytes: number | null | undefined): string | null {
  if (megabytes === null || megabytes === undefined) return null
  return `${(megabytes / 1024).toFixed(1)} GB`
}
