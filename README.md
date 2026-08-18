# Hermes Home

Hermes Home is the custom household-facing frontend for the **Hermes Home AI Stack**.

It is a separate React + TypeScript + Vite application designed as a local control center for chatting with Hermes, watching the local AI runtime, managing workspaces, and growing into an interactive 3D memory/skills/tool graph.

## What powers Hermes Home?

Hermes Home is the frontend for a **local-first AI assistant stack**.

The project is currently developed and tested against a reference backend running on a home workstation. That system combines:

- **Hermes Agent** for conversation, reasoning and orchestration;
- **Qwen3.8 27B Q4_K_M** through Ollama as the main local language model;
- **Hindsight** for persistent memory;
- **Docker + WSL2** for the supporting services;
- a small `hermesctl` orchestration script that starts, stops and health-checks the stack as one system.

The stack is intentionally local-first. The normal AI workload runs on owned hardware instead of depending on paid API calls for every request, while keeping full control over context, memory, tools, skills and future home integrations.

The numbers below describe the **current development/test backend for this project**. They are useful as a performance baseline, not as minimum requirements for running the frontend.

### Why this model?

Qwen3.8 27B currently hits a useful middle ground for this machine.

It is large enough to be useful for reasoning, coding and agent-style tasks, while still fitting on a single RTX 4090 with a large context window.

The main goal was not simply to get the model running, but to keep a **64K context fully on the GPU** without falling back to slower system memory.

### Baseline vs. tuned runtime

Initial tests showed that simply increasing the context size was enough to push the runtime very close to the GPU memory limit.

| | Initial / default behavior | Current Hermes configuration |
|---|---:|---:|
| Model | Qwen3.8 27B Q4_K_M | Qwen3.8 27B Q4_K_M |
| Context | 32,768 tokens | **65,536 tokens** |
| Loaded size | ~17 GB | ~18 GB |
| GPU residency | 100% at smaller context | **100% at 64K** |
| 64K VRAM use | ~23.6 GB | **~21.8–22.4 GB** |
| CPU offload at 64K | ~6% | **none** |
| KV cache | default | **Q8** |
| Flash Attention | default/runtime dependent | **enabled** |
| Keep-alive | temporary | **Forever while Hermes is running** |
| MTP speculative decoding | enabled/tested | **disabled for stability** |
| Parallel inference | experimental | **1 stable inference slot** |

A straightforward 64K run with the original runtime settings reached roughly:

```text
Context        65,536
Processor      94% GPU / 6% CPU
VRAM           ~23.6 GB
```

That worked, but it was right against the RTX 4090's memory ceiling and started spilling part of the workload to CPU memory.

After switching the KV cache to Q8 and enabling Flash Attention, the same model and context fit fully on the GPU:

```text
Context        65,536
Processor      100% GPU
VRAM           ~21.8–22.4 GB
```

That difference matters for Hermes because it is an agent rather than a single-shot chatbot. One request may involve several reasoning or tool steps, so keeping the model fully GPU-resident helps keep those steps more responsive and predictable.

### Current performance baseline

The current stable configuration benchmarks at roughly:

```text
Prompt processing    ~299 tokens/s
Generation           ~45 tokens/s
Context              65,536 tokens
GPU residency        100%
Loaded model size    ~18 GB
Working VRAM         ~21.8–22.4 GB / 24 GB
```

This is the current **stability-first baseline**.

Earlier experiments with Qwen3.8's MTP speculative decoding reached roughly **80+ generated tokens/s**, showing that the hardware has more raw decoding headroom.

However, the current Ollama/Qwen runtime showed instability when initializing the additional MTP draft context at 64K.

For now Hermes therefore favors:

```text
64K context
+ full GPU residency
+ stable startup
+ predictable memory use
```

over:

```text
higher peak token throughput
+ less reliable model loading
```

MTP can be revisited later as the runtime matures.

### Current reference hardware

Hermes Home is currently developed and tested against:

- **NVIDIA RTX 4090 24 GB**
- **Intel Core i7-12700K**
- **32 GB system RAM**
- **Windows + WSL2**

On this system, the current Qwen model runs fully on the RTX 4090 with a 65,536-token context window.

### How the stack starts

The local stack is managed through `hermesctl`.

At a high level, `hermesctl start` does roughly this:

```text
Start Docker if needed
↓
Start Ollama with the Hermes runtime settings
↓
Preload the local Qwen model
↓
Start Hindsight memory
↓
Start Hermes
↓
Start Hermes Home
↓
Verify that each service is healthy
```

Shutdown happens in reverse.

`hermesctl stop` also cleans up the Ollama inference runner so failed or interrupted model loads do not leave orphaned processes holding RAM or VRAM.

### Backend overview

```text
Browser
  │
  ▼
Hermes Home
  │
  ▼
Hermes Agent
  │
  ├── Qwen3.8 27B / Ollama
  │
  ├── Hindsight memory
  │
  └── future skills / tools / integrations
```

The frontend is intentionally kept separate from the AI runtime. That makes the interface easier to replace or evolve without tying the local model, memory system and future tools directly to one UI implementation.

For deeper technical notes, benchmarks and runtime experiments, see the **[Hermes Runtime & Performance Log](https://app.notion.com/p/3c0a2ea2012b819eb016f895cbd25936?pvs=204)**.

## Current state

The frontend now includes:

- streaming multi-chat against the local Hermes API;
- persistent saved conversations with explicit open/close/delete controls;
- configurable panel appearance and blur;
- independently configurable Brain HUD color/opacity for Local Compute, Activity and System;
- a live Brain-view telemetry layer for Hermes, Hindsight, Ollama, CPU, RAM, GPU, VRAM and GPU temperature;
- compact Activity and System HUDs with the same glass treatment as Local Compute;
- dynamic connector lines whose endpoint follows the current Brain-scene center;
- a Local Compute position setting (`top-right` or `bottom-right`), with Activity/System automatically occupying the opposite side;
- a pannable, rotatable and zoomable 3D Brain workspace scaffold with a glowing cyan 3x3 Rubik-style wireframe cube placeholder;
- a floating chat console that stays above Brain-view HUD content while remaining below the fixed sidebar;
- local development lifecycle integration through `hermesctl`.

## Preview

<img width="1600" height="809" alt="image" src="https://github.com/user-attachments/assets/e1d31801-cfd3-41b8-8de2-9cc398994665" />
<img width="1600" height="1105" alt="image" src="https://github.com/user-attachments/assets/7bbd0859-1e7c-4743-ae8e-a113e81d861e" />

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

The temporary 3D Rubik-style wireframe cube can be:

- dragged to rotate;
- Shift/right/middle-dragged to pan;
- zoomed with the mouse wheel;
- reset with a double click.

Only the placeholder model uses wireframe rendering. The surrounding scene and HUDs retain the standard glass/cyberpunk treatment.

A shared `BrainSceneContext` publishes the visualization's current screen-space center. Local Compute, Activity and System HUD connectors use that anchor instead of a hard-coded endpoint, so the connector dot follows the scene when it is panned and can later be driven by the real Three.js camera/graph center.

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
5. Replace the temporary wireframe cube with the interactive Hermes brain/knowledge graph.
6. Feed memory, skill, tool and observable activity data into the 3D visualization.
7. Finish the production/LAN frontend serving boundary and household access.
