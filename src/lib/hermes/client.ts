import type { ChatMessage } from './types'

type StreamHermesChatOptions = {
  messages: ChatMessage[]
  sessionId: string
  onDelta: (delta: string) => void
  signal?: AbortSignal
}

type HermesChunk = {
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
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
    throw new Error(detail || `Hermes returned ${response.status}`)
  }

  if (!response.body) {
    throw new Error('Hermes returned no response stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue

        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        const chunk = JSON.parse(payload) as HermesChunk
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      }
    }
  }
}
