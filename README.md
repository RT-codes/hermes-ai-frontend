# Hermes Home

Hermes Home is the custom household-facing frontend for the **Hermes Home AI Stack**.

It is a separate React + TypeScript + Vite application designed as a local control center for chatting with Hermes, watching the local AI runtime, managing workspaces, and growing into an interactive 3D memory/skills/tool graph.

## Current state

The frontend now includes:

- streaming multi-chat against the local Hermes API;
- persistent saved conversations with explicit open/close/delete controls;
- configurable HUD appearance and panel blur;
- a live Brain-view telemetry layer for Hermes, Hindsight, Ollama, CPU, RAM, GPU, VRAM and GPU temperature;
- compact Activity and System HUDs with the same glass treatment as Local Compute;
- dynamic connector lines whose endpoint follows the current Brain-scene center;
- a Local Compute position setting (`top-right` or `bottom-right`), with Activity/System automatically occupying the opposite side;
- a pannable, rotatable and zoomable 3D Brain workspace scaffold with a glowing cyan cube placeholder;
- a floating chat console that stays above Brain-view HUD content while remaining below the fixed sidebar;
- local development lifecycle integration through `hermesctl`.

The cube is intentionally temporary. It establishes the camera/interaction space and shared screen-space center anchor that the future 3D brain/knowledge visualization can reuse.

## Screenshot

> Screenshot coming soon.

<!-- Add the main project screenshot here once the UI stabilizes.

![Hermes Home control center](./docs/images/hermes-home.png)
-->

## What this frontend is for

Hermes Home is intentionally **not** a replacement for the built-in Hermes admin/developer dashboard.

Its job is to be the household interface on top of the local stack:

- chat with the local Hermes agent;
- manage multiple conversations;
- surface useful runtime and activity feedback;
- provide customizable HUD workspaces;
- expose future memory, skill, tool and automation views;
- host the interactive 3D Hermes brain;
- run on the home LAN as part of the stack managed by `hermesctl`.

## Frontend stack

- React
- TypeScript
- Vite
- custom CSS/design tokens
- native CSS 3D + pointer interaction for the current Brain scaffold
- Three.js / React Three Fiber planned for the full graph/brain renderer
- React Flow planned where structured 2D graph inspection is useful

## Runtime boundary

```text
Browser
  |
  v
Hermes Home / Vite
  |
  +-- /hermes-api/* ------> Hermes API :8642 ------> Ollama / Qwen
  |                              |
  |                              +------> skills / tools
  |
  +-- /hindsight-api/* ----> Hindsight memory
  |
  +-- /system-api/telemetry
          |
          +-- Windows host CPU / RAM
          +-- NVIDIA GPU / VRAM / temperature
          +-- Ollama loaded-model state
```

The Hermes API key remains server-side in the frontend environment and is not shipped in browser JavaScript.

The raw Hermes API remains a local backend boundary; the browser reaches it through the frontend proxy.

## Brain-view architecture

The Brain workspace now has an explicit interactive scene coordinate system.

The temporary 3D cube can be:

- dragged to rotate;
- Shift/right/middle-dragged to pan;
- zoomed with the mouse wheel;
- reset with a double click.

A shared `BrainSceneContext` publishes the visualization's current screen-space center. Local Compute, Activity and System HUD connectors use that anchor instead of a hard-coded endpoint, so the connector dot follows the scene when it is panned and can later be driven by the real Three.js camera/graph center.

## Telemetry

Telemetry is local-only and does not call the LLM.

The development server samples host/Ollama/NVIDIA state and exposes it at:

```text
/system-api/telemetry
```

The browser keeps a short rolling history for the compact VRAM/GPU/CPU graphs. Polling pauses while the tab is hidden.

CPU package temperature is intentionally omitted when a trustworthy sensor value is unavailable. GPU temperature is provided by NVIDIA telemetry.

See **[docs/TELEMETRY.md](./docs/TELEMETRY.md)** for details.

## Development

```bash
npm install
npm run dev -- --host
```

Build check:

```bash
npm run build
```

When using the local Hermes Home stack, `hermesctl` is the preferred lifecycle entry point rather than starting multiple frontend/runtime instances manually.

## Project documentation

- **[docs/HERMES_HOME.md](./docs/HERMES_HOME.md)** — detailed frontend architecture and product direction.
- **[docs/TELEMETRY.md](./docs/TELEMETRY.md)** — telemetry data flow and implementation notes.

## Repository

<https://github.com/RT-codes/hermes-ai-frontend>

## Current roadmap

1. Foundation and custom HUD workspace. ✅
2. Functional multi-chat UX, navigation and appearance controls. ✅
3. Real streaming chat against the local Hermes runtime. ✅
4. Local runtime telemetry and `hermesctl` development lifecycle. ✅
5. Replace the temporary 3D cube with the interactive Hermes brain/knowledge graph.
6. Feed memory, skill, tool and observable activity data into the 3D visualization.
7. Finish the production/LAN frontend serving boundary and household access.
