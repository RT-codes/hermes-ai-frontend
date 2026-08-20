import type { ChatMessage } from '../../features/chat/types'
import { getHermesConnectionSettings } from '../../features/settings/connection'

type StreamHermesChatOptions = {
  messages: ChatMessage[]
  sessionId: string
  onDelta: (delta: string) => void
  signal?: AbortSignal
}

type HermesChunk = {
  choices?: Array<{ delta?: { content?: string } }>
  error?: { message?: string } | string
}

const HERMES_SESSION_KEY = 'household'

function parseSseEvent(event: string, onDelta: (delta: string) => void) {
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())

  if (!dataLines.length) return
  const payload = dataLines.join('\n').trim()
  if (!payload || payload === '[DONE]') return

  let chunk: HermesChunk
  try {
    chunk = JSON.parse(payload) as HermesChunk
  } catch {
    throw new Error('Hermes returned malformed streaming data. Retry the response.')
  }

  if (chunk.error) {
    const message = typeof chunk.error === 'string' ? chunk.error : chunk.error.message
    throw new Error(message || 'Hermes returned a streaming error. Retry the response.')
  }

  const delta = chunk.choices?.[0]?.delta?.content
  if (delta) onDelta(delta)
}

function httpError(status: number, detail: string) {
  const compact = detail.replace(/\s+/g, ' ').trim()
  if (status >= 500) return new Error(compact || `Hermes service error (${status}). The model or backend may be unavailable.`)
  if (status === 429) return new Error(compact || 'Hermes is busy. Retry this response shortly.')
  if (status === 401 || status === 403) return new Error('Hermes API authentication failed. Check the local gateway configuration.')
  return new Error(compact || `Hermes returned HTTP ${status}.`)
}

export async function streamHermesChat({ messages, sessionId, onDelta, signal }: StreamHermesChatOptions) {
  const connection = getHermesConnectionSettings()
  const requestController = new AbortController()
  let timedOut = false
  const relayAbort = () => requestController.abort()
  signal?.addEventListener('abort', relayAbort, { once: true })
  const timeout = window.setTimeout(() => {
    timedOut = true
    requestController.abort()
  }, connection.requestTimeoutMs)

  try {
    let response: Response
    try {
      response = await fetch(`${connection.apiBasePath}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hermes-Session-Id': sessionId,
          'X-Hermes-Session-Key': HERMES_SESSION_KEY,
        },
        body: JSON.stringify({
          model: connection.model,
          stream: true,
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
        signal: requestController.signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      if (timedOut) throw new Error('Hermes request timed out. Your conversation is safe; retry the response.')
      throw new Error('Hermes is unreachable. Check that the local stack is running, then retry the response.')
    }

    if (!response.ok) {
      const detail = await response.text()
      throw httpError(response.status, detail)
    }
    if (!response.body) throw new Error('Hermes returned no response stream. Retry the response.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>
        try {
          result = await reader.read()
        } catch (error) {
          if (signal?.aborted) throw error
          if (timedOut) throw new Error('Hermes request timed out while streaming. The partial response was kept.')
          throw new Error('Hermes connection was interrupted while streaming. The partial response was kept; retry when ready.')
        }
        if (result.done) break

        buffer += decoder.decode(result.value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() ?? ''
        for (const event of events) parseSseEvent(event, onDelta)
      }

      buffer += decoder.decode()
      if (buffer.trim()) parseSseEvent(buffer, onDelta)
    } finally {
      reader.releaseLock()
    }
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', relayAbort)
  }
}
