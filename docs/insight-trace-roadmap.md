# Hermes Insight trace roadmap

Hermes Insight is intended to evolve from a live observability surface into a persistent, inspectable provenance layer for each assistant response.

## Stage 1 — live trace

Current work:

- stream Hermes runtime status and native events
- show tool activity separately from final response text
- show reasoning/working text only when Hermes explicitly publishes it
- keep events pinned to the chat session that produced them
- clearly distinguish native and compatibility transports

## Stage 2 — per-response trace memory

Next product step:

- preserve Insight events after the live turn finishes and after reload
- retain the request/response correlation ID on assistant messages
- group reasoning, tools, runtime events, skills, and memory references by assistant response
- selecting an existing assistant response in Chat should switch Insight from the live session view to that response's historical trace
- provide an obvious path back to the live/current trace
- preserve enough structured metadata for later visualization without storing fabricated reasoning

The persisted representation should be structured data, not a pre-rendered transcript, so future surfaces can reuse it.

## Stage 3 — provenance inspector / 3D Brain

Later direction:

- expose memories/recollections used by a response
- expose tools and skills used by the turn
- integrate the selected response trace with the existing inspector system
- highlight the corresponding nodes in the 3D Brain
- draw relationship lines from the active trace/response to the memories, skills, and tool/provenance nodes it used
- allow stepping through a response's working trace and seeing the associated 3D provenance state change over time

This stage should consume the Stage 2 structured trace model rather than parsing UI text or rebuilding provenance from the rendered Chat transcript.
