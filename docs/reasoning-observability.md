# Reasoning observability

Hermes Home treats model reasoning as optional structured telemetry. It never synthesizes or infers private reasoning text.

## Supported frontend inputs

The Chat V2 transport accepts reasoning text from these upstream shapes when present:

- Hermes native events: `thinking.delta`, `reasoning.delta`, `reasoning.available`
- OpenAI-compatible chunks: `delta.reasoning`
- OpenAI-compatible chunks: `delta.reasoning_content`
- Compatibility aliases: `delta.thinking`

All supported shapes normalize into the same per-request reasoning activity channel. The resulting events are persisted with the response request ID so Hermes Insight and the Chat response disclosure can replay the same trace later.

## Why `delta.reasoning` matters for the local stack

Ollama thinking-capable models can expose thinking separately from visible content. Qwen/Ollama OpenAI-compatible integrations may use `delta.reasoning`, while other provider stacks use `reasoning_content`. A client that only watches one field can silently lose reasoning even though visible assistant content and tool events work normally.

## Display policy

- Actual model-emitted reasoning is shown as **Model reasoning** in Chat and in Hermes Insight.
- Tool calls, lifecycle events, and runtime evidence remain available even when separate model reasoning is not emitted.
- Verified execution activity may be used as an execution trace, but it must never be labelled as model reasoning.
- If the running Hermes API server strips provider reasoning before it reaches the frontend, the remaining fix belongs at the Hermes server/gateway event boundary rather than in React.

## Long-term direction

Per-response reasoning, tools, skills, memories, and other provenance should remain correlated by stable session/request/message identifiers. The future 3D Brain inspector can consume that structured trace without parsing rendered Chat text.
