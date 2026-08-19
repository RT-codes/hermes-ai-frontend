import type { ChatMessage } from '../../features/chat/types'

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
    throw new Error('Hermes returned malformed streaming data')
  }

  if (chunk.error) {
    const message = typeof chunk.error === 'string' ? chunk.error : chunk.error.message
    throw new Error(message || 'Hermes returned a streaming error')
  }

  const delta = chunk.choices?.[0]?.delta?.content
  if (delta) onDelta(delta)
}

export async function streamHermesChat({ messages, sessionId, onDelta, signal }: StreamHermesChatOptions) {
  const response = await fetch('/hermes-api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Id': sessionId,
      'X-Hermes-Session-Key': 'household',
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      stream: true,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Hermes returned HTTP ${response.status}`)
  }
  if (!response.body) throw new Error('Hermes returned no response stream')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() ?? ''
      for (const event of events) parseSseEvent(event, onDelta)
    }

    buffer += decoder.decode()
    if (buffer.trim()) parseSseEvent(buffer, onDelta)
  } finally {
    reader.releaseLock()
  }
}
