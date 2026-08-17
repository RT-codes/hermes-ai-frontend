# Hermes Home

Hermes Home is the custom household-facing frontend for the **Hermes Home AI Stack**.

It is a separate React + TypeScript + Vite application designed to provide a polished local control center for chatting with Hermes, viewing system activity, managing workspaces, and eventually exploring an interactive 3D memory/skills/tool graph.

## Screenshot

> Screenshot coming soon.

<!-- Add the main project screenshot here once the UI stabilizes.

![Hermes Home control center](./docs/images/hermes-home.png)
-->

## What this frontend is for

Hermes Home is intentionally **not** a full Hermes admin dashboard or an Open WebUI-style model/MCP management suite.

Its job is to be the clean household interface on top of the local stack:

- chat with the local Hermes agent;
- manage multiple conversations;
- surface useful system/activity feedback;
- provide customizable floating HUD panels and workspaces;
- expose future memory, skill, tool and automation views;
- host the future interactive 3D Hermes brain;
- run on the home LAN as part of the stack managed by `hermesctl`.

## Stack

- React
- TypeScript
- Vite
- Custom CSS/design tokens
- Three.js / React Three Fiber planned for the 3D brain
- React Flow planned where structured 2D graph inspection is useful

## Connection boundary

The frontend is designed to talk to Hermes through its OpenAI-compatible API server rather than coupling itself to the built-in Hermes dashboard.

```text
Browser
  |
  v
Hermes Home
  |
  v
server-side frontend proxy
  |
  v
Hermes API :8642
  |
  +-- Ollama / Qwen
  +-- Hindsight memory
  +-- skills / tools
```

The Hermes API key should remain server-side and must not be shipped in browser JavaScript.

## Development

```bash
npm install
npm run dev -- --host
```

Build check:

```bash
npm run build
```

## Project documentation

See **[docs/HERMES_HOME.md](./docs/HERMES_HOME.md)** for the detailed frontend architecture, chat/session model, UI structure, appearance system, Hermes connection, LAN direction and planned `hermesctl` integration.

## Repository

<https://github.com/RT-codes/hermes-ai-frontend>

## Current roadmap

1. Foundation and custom HUD workspace.
2. Functional multi-chat UX, navigation and appearance controls.
3. Validate real streaming chat against the local Hermes runtime.
4. Add Hermes Home to LAN access and `hermesctl` lifecycle management.
5. Build the interactive 3D synaptic brain.
6. Feed real memory, skill, tool and activity data into the visualization.
