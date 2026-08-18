# Hermes Home

Hermes Home is the custom household-facing frontend for the **Hermes Home AI Stack**.

It is a separate React + TypeScript + Vite application designed as a local control center for chatting with Hermes, watching the local AI runtime, managing workspaces, and growing into an interactive 3D memory/skills/tool graph.

## Current state

The frontend now includes:

- streaming multi-chat against the local Hermes API;
- persistent saved conversations with explicit open/close/delete controls;
- configurable panel appearance and blur;
- independently configurable Brain HUD color/opacity for Local Compute, Activity and System;
- a live Brain-view telemetry layer for Hermes, Hindsight, Ollama, CPU, RAM, GPU, VRAM and GPU temperature;
- compact Activity and System HUDs with the same glass treatment as Local Compute;
- a real Three.js force-directed Brain graph backed by read-only Hindsight memory data;
- memory hover/selection, multi-hop relationship emphasis, connected-memory navigation and a right-side Memory Inspector;
- a live orthogonal selected-node-to-inspector connector, manual graph sync and camera fit controls;
- a fixed animated Hermes thinking cube and fading 3D ground plane;
- a Local Compute position setting (`top-right` or `bottom-right`), with Activity/System automatically occupying the opposite side;
- a floating chat console that stays above Brain-view HUD content while remaining below the fixed sidebar;
- local development lifecycle integration through `hermesctl`.

## Preview

<img width="1600" height="809" alt="image" src="https://github.com/user-attachments/assets/e1d31801-cfd3-41b8-8de2-9cc398994665" />

https://github.com/user-attachments/assets/baa775ab-5ab0-41ee-a449-8d3b1c1066d0

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
- Three.js through `react-force-graph-3d` for the interactive Brain graph
- CSS 3D for the fixed Hermes thinking cube
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

The Brain workspace renders real Hindsight memory nodes and relationships in a Three.js force-directed scene. It supports orbit, pan, zoom, node dragging, hover inspection, persistent selection and connected-memory hopping.

Selecting a memory opens the read-only Memory Inspector and attaches a live orthogonal screen-space connector to the selected 3D node. The graph snapshot loads on entry and can be refreshed explicitly with **Sync Graph**; no Hindsight memory is written or changed by the visualization.

The fixed Rubik-style thinking cube mirrors graph camera orientation while remaining anchored beside the Hermes Home header. The scene also includes a fading 3D ground plane and prevents orbiting below the floor.

The Brain HUDs have their own appearance variables and can be tuned independently from the regular floating panel/sidebar system through **Brain HUD color** and **Brain HUD opacity** settings.

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
5. Interactive 3D Hindsight memory graph and read-only Memory Inspector. ✅
6. Add provenance/activity, skills and tool/MCP node layers to the Brain graph.
7. Finish the production/LAN frontend serving boundary and household access.
