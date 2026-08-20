import type { ChatMessage } from '../../features/chat/types'
import { getHermesConnectionSettings } from '../../features/settings/connection'

export type HermesNativeEvent = {
  type: string
  payload: Record<string, unknown>
}

type StreamHermesChatOptions = {
  messages: ChatMessage[]
  sessionId: string
  onDelta: (delta: string) => void
  onEvent?: (event: HermesNativeEvent) => void
  preferNativeSession?: boolean
  signal?: AbortSignal
}

type HermesChunk = {
  choices?: Array<{ delta?: { content?: string } }>
  error?: { message?: string } | string
}

const HERMES_SESSION_KEY = 'household'

function eventName(block: string) {
  return block
    .split(/\r?\n/)
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim() || ''
}

function eventData(block: string) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim()
}

function parseJsonPayload(payload: string) {
  if (!payload || payload === '[DONE]') return null
  try {
    const parsed = JSON.parse(payload)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    throw new Error('Hermes returned malformed streaming data. Retry the response.')
  }
}

function parseOpenAiSseEvent(block: string, onDelta: (delta: string) => void, onEvent?: (event: HermesNativeEvent) => void) {
  const name = eventName(block)
  const payloadText = eventData(block)
  if (!payloadText || payloadText === '[DONE]') return

  if (name === 'hermes.tool.progress') {
    const payload = parseJsonPayload(payloadText)
    if (payload) onEvent?.({ type: name, payload })
    return
  }

  const chunk = parseJsonPayload(payloadText) as HermesChunk | null
  if (!chunk) return
  if (chunk.error) {
    const message = typeof chunk.error === 'string' ? chunk.error : chunk.error.message
    throw new Error(message || 'Hermes returned a streaming error. Retry the response.')
  }

  const delta = chunk.choices?.[0]?.delta?.content
  if (delta) onDelta(delta)
}

function parseNativeSessionEvent(block: string, onDelta: (delta: string) => void, onEvent?: (event: HermesNativeEvent) => void) {
  const type = eventName(block)
  const payload = parseJsonPayload(eventData(block))
  if (!type || !payload) return

  onEvent?.({ type, payload })
  if (type === 'assistant.delta') {
    const delta = payload.delta
    if (typeof delta === 'string' && delta) onDelta(delta)
  }
}

function httpError(status: number, detail: string) {
  const compact = detail.replace(/\s+/g, ' ').trim()
  if (status >= 500) return new Error(compact || `Hermes service error (${status}). The model or backend may be unavailable.`)
  if (status === 429) return new Error(compact || 'Hermes is busy. Retry this response shortly.')
  if (status === 401 || status === 403) return new Error('Hermes API authentication failed. Check the local gateway configuration.')
  return new Error(compact || `Hermes returned HTTP ${status}.`)
}

async function ensureNativeSession(basePath: string, sessionId: string, signal: AbortSignal) {
  const response = await fetch(`${basePath}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Key': HERMES_SESSION_KEY,
    },
    body: JSON.stringify({ id: sessionId, source: 'dashboard' }),
    signal,
  })

  if (response.ok || response.status === 409) return true
  if (response.status === 404 || response.status === 405) return false
  throw httpError(response.status, await response.text())
}

async function openNativeSessionStream(
  basePath: string,
  sessionId: string,
  model: string,
  message: string,
  signal: AbortSignal,
) {
  const response = await fetch(`${basePath}/api/sessions/${encodeURIComponent(sessionId)}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Key': HERMES_SESSION_KEY,
    },
    body: JSON.stringify({ message, model }),
    signal,
  })

  if (response.status === 404 || response.status === 405) return null
  if (!response.ok) throw httpError(response.status, await response.text())
  return response
}

async function openCompatibilityStream(
  basePath: string,
  model: string,
  sessionId: string,
  messages: ChatMessage[],
  signal: AbortSignal,
) {
  const response = await fetch(`${basePath}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Id': sessionId,
      'X-Hermes-Session-Key': HERMES_SESSION_KEY,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  })

  if (!response.ok) throw httpError(response.status, await response.text())
  return response
}

async function consumeSse(
  response: Response,
  parseEvent: (event: string) => void,
  signal: AbortSignal | undefined,
  timedOut: () => boolean,
) {
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
        if (timedOut()) throw new Error('Hermes request timed out while streaming. The partial response was kept.')
        throw new Error('Hermes connection was interrupted while streaming. The partial response was kept; retry when ready.')
      }
      if (result.done) break

      buffer += decoder.decode(result.value, { stream: true })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      for (const event of events) {
        if (!event.trim() || event.trimStart().startsWith(':')) continue
        parseEvent(event)
      }
    }

    buffer += decoder.decode()
    if (buffer.trim() && !buffer.trimStart().startsWith(':')) parseEvent(buffer)
  } finally {
    reader.releaseLock()
  }
}

export async function streamHermesChat({
  messages,
  sessionId,
  onDelta,
  onEvent,
  preferNativeSession = true,
  signal,
}: StreamHermesChatOptions) {
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
    let response: Response | null = null
    let native = false

    try {
      const latestUser = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
      if (preferNativeSession && latestUser) {
        const available = await ensureNativeSession(connection.apiBasePath, sessionId, requestController.signal)
        if (available) {
          response = await openNativeSessionStream(
            connection.apiBasePath,
            sessionId,
            connection.model,
            latestUser,
            requestController.signal,
          )
          native = Boolean(response)
        }
      }

      if (!response) {
        onEvent?.({ type: 'transport.fallback', payload: { reason: 'native_session_stream_unavailable' } })
        response = await openCompatibilityStream(
          connection.apiBasePath,
          connection.model,
          sessionId,
          messages,
          requestController.signal,
        )
      }
    } catch (error) {
      if (signal?.aborted) throw error
      if (timedOut) throw new Error('Hermes request timed out. Your conversation is safe; retry the response.')
      if (error instanceof Error && !/Hermes returned HTTP/.test(error.message) && !/service error/.test(error.message)) {
        throw new Error('Hermes is unreachable. Check that the local stack is running, then retry the response.')
      }
      throw error
    }

    await consumeSse(
      response,
      native
        ? (event) => parseNativeSessionEvent(event, onDelta, onEvent)
        : (event) => parseOpenAiSseEvent(event, onDelta, onEvent),
      signal,
      () => timedOut,
    )
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', relayAbort)
  }
}
