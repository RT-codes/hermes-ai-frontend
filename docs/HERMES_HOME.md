# Hermes Home Frontend

Hermes Home is the household-facing web interface for the **Hermes Home AI Stack**. It is intentionally maintained as a separate frontend project from the Hermes agent/runtime itself.

This document covers **Hermes Home only**: its purpose, frontend architecture, visual workspace, connection boundaries, local development, and how it is expected to fit into the wider home stack.

> Hermes agent/runtime documentation belongs with the Hermes Home AI Stack/operator documentation. This repository should not become a copy of Hermes' own documentation.

## Purpose

Hermes Home exists to make the local AI stack feel like a usable household product rather than a collection of Docker services and terminal commands.

The long-term target is a control center that provides:

- streaming conversations with the local Hermes agent;
- floating, draggable and resizable HUD panels;
- multiple chat sessions managed as tabs;
- workspace navigation for chats, memory, skills, system state, operations and settings;
- user-controlled appearance settings;
- visible feedback for activity happening behind the scenes;
- a future interactive 3D knowledge / capability / memory graph;
- LAN access for trusted household devices;
- lifecycle integration with `hermesctl` so the UI starts and stops with the rest of the stack.

Hermes Home intentionally does **not** aim to become another all-purpose Open WebUI-style administration suite. MCP configuration, model management and low-level Hermes administration should remain outside the household UI unless a specific household-facing feature needs them.

## Repository

GitHub: <https://github.com/RT-codes/hermes-ai-frontend>

The frontend lives in its own repository so it can evolve independently from the Hermes runtime/container and can eventually be modified directly by development agents without coupling UI work to the agent installation.

## Screenshots

Screenshots will be added as the interface stabilizes.

<!--
Suggested layout once screenshots are available:

### Brain workspace
![Hermes Home brain workspace](./images/brain-workspace.png)

### Chat workspace
![Hermes Home chat workspace](./images/chat-workspace.png)

### Appearance settings
![Hermes Home appearance settings](./images/appearance-settings.png)
-->

## Technology

Current frontend foundation:

- **React**
- **TypeScript**
- **Vite**
- **Custom CSS** with global design tokens

Planned visualization layer:

- **Three.js / React Three Fiber** for the living 3D brain scene;
- **React Flow** where a structured, inspectable 2D graph is more useful than the 3D scene.

Tailwind and CSS-in-JS are intentionally not part of the current styling approach. The interface uses normal CSS so the custom HUD shapes, clipping, blur, glow and animation system remain fully controllable.

## Product identity

For now Hermes Home has **one implicit household identity**.

There is no login screen and no account-management boilerplate. Opening Hermes Home enters the shared household context automatically.

The architecture keeps identity as a concept internally so true per-user support can be added later, but Rowan/Rizka memory isolation is intentionally deferred until Hermes/Hindsight can guarantee safe end-to-end user separation without fragile local patches.

## High-level architecture

```text
Trusted household browser
        |
        v
+---------------------------+
|      Hermes Home UI       |
| React / TypeScript / Vite |
+-------------+-------------+
              |
              | same-origin frontend API path
              | /hermes-api/*
              v
+---------------------------+
| Frontend server / proxy   |
| injects Hermes API secret |
+-------------+-------------+
              |
              v
+---------------------------+
|      Hermes API server    |
| OpenAI-compatible API     |
| expected: localhost:8642  |
+-------------+-------------+
              |
              v
+------------------------------------------------+
| Hermes agent runtime                            |
|                                                 |
| local model via Ollama/Qwen                     |
| Hindsight memory                                |
| skills / tools / future lazy MCP capabilities  |
+------------------------------------------------+
```

The browser should **never need the Hermes API key directly**. During development, Vite proxies requests to Hermes and injects the secret server-side.

A production/LAN deployment should retain that same boundary: trusted browsers talk to Hermes Home, and Hermes Home talks to the local Hermes API.

## Hermes connection

The frontend integration is designed around Hermes' OpenAI-compatible API server rather than scraping or embedding the built-in Hermes dashboard.

Expected development endpoint:

```text
http://127.0.0.1:8642
```

Frontend requests use:

```text
/hermes-api/v1/chat/completions
```

The Vite development proxy forwards that path to Hermes and supplies the configured API key.

### Session model

The current functional work uses two separate Hermes concepts:

- **Session ID** — unique per browser conversation so separate chats remain separate transcripts.
- **Session key** — shared `household` scope so the current long-term memory model remains one household identity.

Conceptually:

```text
Household memory scope
    |
    +-- Chat A -> unique session id
    +-- Chat B -> unique session id
    +-- Chat C -> unique session id
```

Browser chat state is also persisted locally so open/saved conversations can survive a frontend refresh.

## Frontend UI structure

The application is being organized around two kinds of interface elements.

### Fixed workspace navigation

The left sidebar is not draggable. It is the stable application/navigation surface and is designed for:

- Brain
- Chats
- Memory
- Skills
- System
- Operations
- Settings

It can collapse to free more screen space.

### Floating HUD panels

The workspace contains draggable/resizable panels. These are intended for information the user may want to arrange around the main scene, such as:

- active chat;
- activity feed;
- runtime/system status;
- future memory inspection;
- future tool/skill activity;
- logs or other temporary detail views.

Panel position and size can be persisted in browser storage.

### Visual language

Hermes Home uses an angled HUD/cyberpunk-inspired panel system rather than conventional rounded dashboard cards.

Current visual concepts include:

- cut top-right and bottom-left corners;
- translucent panel backgrounds;
- backdrop blur;
- cyan/blue accent lighting;
- lightweight glow and activity feedback;
- a dark environment intended to sit behind the future 3D brain scene.

## Chat UX

The functional chat direction includes:

- one floating chat console;
- multiple conversations represented as tabs;
- create a new chat from a global `+` action;
- close individual tabs;
- close all tabs so the floating chat console can disappear;
- a Chats workspace listing known conversations;
- clicking a conversation reopens it in the floating console;
- streamed Hermes responses and connection/error feedback.

The chat UI should remain a thin client. Hermes logic, memory and tool behavior belong in the Hermes agent/runtime rather than being duplicated in React components.

## Appearance settings

The Settings workspace is intended to become the central frontend customization area.

Initial appearance controls cover items such as:

- accent color;
- application background color;
- panel color;
- panel opacity;
- panel blur amount;
- workspace margin/spacing;
- HUD corner-cut size.

Later additions may include:

- animation intensity;
- particle density;
- sound effects;
- motion preferences;
- graph/brain visualization options.

Appearance state is designed to apply live through CSS variables and persist locally.

## 3D brain direction

The central Brain workspace is deliberately being implemented after the functional shell.

The intended result is not a decorative sphere. It should become an interactive system visualization where the user can:

- rotate/orbit around the graph;
- click nodes to inspect or expand them;
- see memory, skills, tools and system components as connected concepts;
- see glowing/synaptic activity move through relevant connections when Hermes performs observable operations;
- use floating panels to inspect selected nodes without leaving the scene.

The visualization must show **observable system activity**, not hidden chain-of-thought.

## Project layout

The exact structure will continue to evolve, but the frontend currently follows this responsibility split:

```text
src/
├── components/       reusable UI and workspace components
├── context/          household, chat-session and appearance state
├── lib/hermes/       Hermes API client and API-specific types
├── styles/           tokens, global styles and feature-specific CSS
├── App.tsx           top-level application composition
└── main.tsx          React entry point
```

Important architectural rule:

> UI components should consume a small Hermes client/interface rather than knowing about Docker, Ollama, Hindsight or Hermes installation details directly.

## Local development

Clone and install:

```bash
git clone https://github.com/RT-codes/hermes-ai-frontend.git
cd hermes-ai-frontend
npm install
```

Run the development server:

```bash
npm run dev -- --host
```

The normal Vite development URL is:

```text
http://localhost:5173
```

Build check:

```bash
npm run build
```

## Local Hermes API configuration

Once the functional chat PR is merged, create a local environment file from the committed example:

```bash
cp .env.example .env.local
```

Expected variables:

```env
HERMES_API_TARGET=http://127.0.0.1:8642
HERMES_API_KEY=replace-with-the-local-hermes-api-key
```

`.env.local` must stay local and must never be committed.

The Hermes API server itself must be running and configured with the corresponding API key before end-to-end chat can work.

## Relationship to `hermesctl`

`hermesctl` belongs to the wider Hermes Home AI Stack, not this frontend repository.

The planned operational integration is:

```text
hermesctl start
    |
    +-- Ollama / Qwen
    +-- Hindsight
    +-- Hermes runtime/API
    +-- Hermes Home frontend
```

And similarly for:

```text
hermesctl stop
hermesctl restart
hermesctl status
```

That lifecycle integration should happen only after real chat is validated locally.

## LAN deployment direction

Hermes Home is intended to be reachable from trusted devices on the home LAN so the household does not need terminal access.

The eventual user experience should be:

```text
start stack once on the host PC
        |
        v
open Hermes Home URL on a trusted phone/laptop
        |
        v
chat with and inspect the local Hermes system
```

LAN exposure must keep Hermes' secret/API boundary on the server side. The browser should not receive an API key simply because it is on the home network.

## What belongs elsewhere

This repository should document the frontend and its boundary with Hermes.

Detailed documentation for these belongs in the wider Hermes Home AI Stack/operator docs instead:

- installing/upgrading Hermes itself;
- Docker/container layout;
- Ollama model installation;
- Hindsight service configuration;
- `hermesctl` implementation details;
- persistent host directories/backups;
- skill installation and MCP routing architecture.

When those systems affect the frontend, this repository should document only the contract/interface needed by Hermes Home.

## Current development sequence

The frontend is intentionally being built in layers:

1. React/TypeScript/Vite foundation and custom CSS system.
2. Draggable/resizable HUD workspace and fixed sidebar.
3. Functional navigation, multi-chat UX, Hermes streaming API integration and appearance controls.
4. Local Hermes end-to-end validation.
5. LAN + `hermesctl` lifecycle integration.
6. Interactive React Three Fiber synaptic brain.
7. Real memory/skills/tools/activity data feeding the visualization.

## Related pull requests

- Foundation/component architecture: <https://github.com/RT-codes/hermes-ai-frontend/pull/1>
- Draggable HUD workspace: <https://github.com/RT-codes/hermes-ai-frontend/pull/2>
- Functional shell/chat/settings: <https://github.com/RT-codes/hermes-ai-frontend/pull/3>
