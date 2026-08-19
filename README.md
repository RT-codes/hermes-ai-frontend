# Hermes Home

**A local-first household interface for the Hermes Home AI Stack.**

Hermes Home is a React + TypeScript + Vite frontend for chatting with Hermes, monitoring the local AI runtime, managing conversations and workspaces, and eventually exploring memory, skills and tools through an interactive 3D brain.

> Interested in the local model, hardware, benchmarks, tuning choices and how the backend stack is orchestrated? See **[Backend & runtime](./docs/BACKEND.md)**.

## Preview
<img width="2541" height="1294" alt="image" src="https://github.com/user-attachments/assets/d6cc4597-0ff6-4be7-ba03-da34596c6bae" />

<img width="1600" height="809" alt="Hermes Home preview" src="https://github.com/user-attachments/assets/e1d31801-cfd3-41b8-8de2-9cc398994665" />


https://github.com/user-attachments/assets/6f6f82f6-2702-4f8a-a07f-63729be18006

https://github.com/user-attachments/assets/baa775ab-5ab0-41ee-a449-8d3b1c1066d0





## What it is

Hermes Home is intentionally **not** a replacement for the built-in Hermes admin/developer dashboard.

It is the household-facing layer on top of the local stack: a more visual, approachable place to use the assistant day to day while still exposing useful information about what the system is doing underneath.

The long-term goal is a single interface where the household can:

- chat with the local Hermes agent;
- manage multiple conversations and workspaces;
- see useful runtime and activity feedback;
- inspect memory, skills, tools and automations;
- explore an interactive 3D representation of the Hermes "brain";
- use the system over the home LAN without needing to interact with containers or terminals.

## Current state

The frontend already includes:

- **real streaming chat** against the local Hermes API;
- **multi-chat support** with persistent saved conversations;
- draggable/resizable floating panels and configurable appearance;
- a collapsible navigation sidebar and chat management;
- a pannable, rotatable and zoomable **Three.js Brain graph backed by read-only Hindsight memory data**;
- memory hover/selection, multi-hop relationship emphasis, connected-memory navigation and a read-only Memory Inspector;
- manual graph sync/fit controls and a live orthogonal selected-node-to-inspector connector;
- live local telemetry for **Hermes, Hindsight, Ollama, CPU, RAM, GPU, VRAM and GPU temperature**;
- compact Activity, System and Local Compute HUDs;
- configurable Brain HUD color, opacity and positioning;
- local stack lifecycle integration through `hermesctl`.

The current Brain view is the accepted Phase 2 memory-inspection baseline. Camera-focus/restore polish and future provenance, skills and tool/MCP graph layers remain separate follow-up work.

## How it fits together

```text
Browser
   |
   v
Hermes Home
   |
   +---- Hermes Agent ---- local Qwen model
   |
   +---- Hindsight ------- persistent memory
   |
   +---- Telemetry ------- host + GPU + Ollama state
```

The browser does not talk directly to the raw Hermes backend. Hermes Home proxies the local API boundary, keeping backend credentials server-side rather than shipping them in browser JavaScript.

For the full reference backend, model choice, hardware, benchmark numbers and `hermesctl` startup flow, see **[docs/BACKEND.md](./docs/BACKEND.md)**.

## Frontend stack

- React
- TypeScript
- Vite
- custom CSS / design tokens
- Three.js through `react-force-graph-3d` for the interactive Brain graph
- CSS 3D for the fixed Hermes thinking cube
- React Flow planned where structured 2D graph inspection is useful

## Telemetry

Telemetry is local-only and does not call the LLM.

The development server samples host, Ollama and NVIDIA state and exposes it through `/system-api/telemetry`. The browser keeps a short rolling history for the compact resource graphs and pauses polling while the tab is hidden.

CPU package temperature is intentionally omitted when a trustworthy sensor value is unavailable; GPU temperature comes from NVIDIA telemetry.

See **[docs/TELEMETRY.md](./docs/TELEMETRY.md)** for the implementation details.

## Development

```bash
npm install
npm run dev -- --host
```

Build check:

```bash
npm run build
```

When using the complete local stack, `hermesctl` is the preferred lifecycle entry point so the frontend, Hermes, Hindsight and Ollama are started and stopped together rather than as unrelated processes.

## Documentation

- **[Backend & runtime](./docs/BACKEND.md)** — reference hardware, local model choice, benchmarks, tuning and orchestration.
- **[Hermes Home architecture](./docs/HERMES_HOME.md)** — detailed frontend architecture and product direction.
- **[Telemetry](./docs/TELEMETRY.md)** — telemetry data flow and implementation notes.

## Roadmap

1. Foundation and custom HUD workspace. ✅
2. Functional multi-chat UX, navigation and appearance controls. ✅
3. Real streaming chat against the local Hermes runtime. ✅
4. Local runtime telemetry and `hermesctl` development lifecycle. ✅
5. Interactive 3D Hindsight memory graph and read-only Memory Inspector. ✅
6. Add provenance/activity, skills and tool/MCP node layers to the Brain graph.
7. Finish the production / LAN frontend serving boundary and household access.

---

Repository: <https://github.com/RT-codes/hermes-ai-frontend>
