# Frontend architecture

This document records the dependency and ownership rules established during the Frontend Consolidation Pass (FCP). It is intentionally short: a contributor or coding agent should be able to understand the shape of the frontend before opening feature files.

## Layer direction

Dependencies should normally flow downward through these layers:

1. **cells** — smallest reusable visual/interaction primitives with no product semantics.
2. **components** — reusable controls/panels composed from cells.
3. **organisms** — coordinated UI surfaces with local interaction state.
4. **workspaces** — product views that own workspace-local selection and presentation state.
5. **shells** — application/spatial composition, workspace mounting and global overlay ownership.

Feature/data hooks and contexts sit beside this visual hierarchy and should expose structured state to the highest layer that actually owns it.

A lower layer must not import a higher layer merely to access state or styling.

## State ownership

- Backend/runtime truth belongs in dedicated hooks/providers/adapters.
- Workspace navigation/persistence belongs to `src/app/workspaces/WorkspaceProvider.tsx`.
- Canonical workspace IDs live in `src/app/workspaces/workspaceModel.ts`: `memory`, `operations`, `chat`, `skills`, `system`, `settings`.
- Historical `brain` workspace state is accepted only by the persistence normalizer and immediately converges to `memory`; live UI code must not use it as a workspace identity.
- Workspace-local selection/filter state belongs to that workspace.
- Shared spatial camera/environment state belongs to the spatial shell.
- Temporary component interaction state stays local unless another surface genuinely needs it.
- Do not duplicate authoritative state to make rendering easier; derive presentation state instead.

## Persistent spatial shell

Memory and Operations are sibling payloads inside one persistent spatial world, not separate 3D applications.

- `SpatialApplicationShell` owns the persistent spatial composition boundary.
- `SpatialGraphicsSlot` owns workspace graphics selection.
- `BrainGraph` currently remains mounted as the single WebGL renderer/camera/orbit-control authority.
- The real Three.js floor/grid/fade is shared world infrastructure and remains painted during Memory ↔ Operations switches.
- Memory nodes, cluster nodes, links, particles and hit-testing are a Memory payload and can be suppressed independently from the shared renderer/world.
- Memory HUD/inspectors are separate from Memory WebGL graphics and are suppressed independently.
- Operations deliberately starts with an empty graphics payload on the same renderer/world. Future Operations 3D objects must attach to this shared scene contract; do not introduce an Operations-only camera/canvas.

The invariant is continuity: switching workspace must not change camera position, target, FOV, orbit constraints, floor geometry/fade or perceived world scale unless a future explicit camera-pose transition requests it.

## Layout zones

Named layout zones are application contracts rather than developer-only rectangles.

- Canonical zone IDs and metadata live in `src/app/layout/layoutZones.ts`.
- Geometry tokens live in `src/styles/layout-zones.css`.
- Developer zone tooling re-exports and visualizes those exact contracts from `src/dev/zones/`; it must not own a duplicate zone model.
- Production surfaces declare ownership with `data-layout-zone` / `data-layout-owner` through `layoutZoneAttributes(...)`.
- Zones define stable edges, gutters and semantic ownership, but do **not** force rigid tiling. Panels may remain resizable, floating or narrower than their zone.
- Memory/Operations timelines own `top-band`; spatial interaction owns `center-stage`; Memory telemetry/Insight owns `right-hud`; scene controls/help own `bottom-band`; temporary chat/dialog surfaces own `floating-layer`; primary navigation owns `left-nav`.

FCP.7 semantic actions may rely on these stable ownership targets, but must not manipulate incidental CSS coordinates directly.

## Comments

Comments should explain **intent, ownership, invariants, boundaries or non-obvious tradeoffs**.

Good comments answer questions such as:
- Why does this component own this state?
- Which layer is allowed to call this function?
- Which behavior must remain stable during refactors?
- Why is an apparently simpler implementation intentionally avoided?

Avoid comments that merely translate syntax into English.

## Styling

Shared appearance belongs under `src/styles/primitives/` or shared application style layers. Feature styles should describe feature layout/variants, not reimplement shared glass, border, cut-corner or typography recipes.

Current shared HUD primitives:

- `src/ui/cells/HudSurface/HudSurface.tsx`
- `src/ui/components/HudPanel/HudPanel.tsx`
- `src/styles/primitives/hud-surface.css`
- `src/styles/primitives/hud-panel.css`

Shared layout geometry:

- `src/app/layout/layoutZones.ts`
- `src/styles/layout-zones.css`

Legacy Brain-specific wrappers/classes may remain as compatibility hooks while callers migrate. New workspace-agnostic code should depend on neutral UI primitives instead.

Application stylesheet ordering is centralized through `src/styles/app.css`; new style families should be grouped behind explicit entrypoints rather than imported ad hoc from `App.tsx`.

## Application composition

- `src/App.tsx` composes only `AppProviders`, `HermesHome`, and the application stylesheet entrypoint.
- `src/app/providers/AppProviders.tsx` owns cross-application provider wiring.
- `src/app/shell/HermesHome.tsx` owns global chrome, named layout-zone ownership and cross-workspace floating surfaces.
- `src/app/workspaces/WorkspaceProvider.tsx` owns active workspace state and browser resume behavior.
- `src/app/transitions/WorkspaceTransitionProvider.tsx` owns workspace exit/swap/enter presentation timing without becoming navigation state.

Shells may decide *where* a workspace is mounted, but they should not invent or persist workspace identity themselves.

## Developer tooling

Frontend developer tooling lives under `src/dev/`. It may inspect and manipulate registered frontend state through explicit APIs, but it is not a raw host shell and must not silently cross infrastructure/security boundaries.

The Quake-style console separates:
- UI/transcript/history: `src/dev/console/DeveloperConsole.tsx`
- global shortcut policy: `src/dev/console/useDeveloperConsoleToggle.ts`
- executable command registry: `src/dev/commands/developerCommandRegistry.ts`
- zone visualization/commands: `src/dev/zones/`

The zone definitions themselves are application contracts under `src/app/layout/`; developer tooling only visualizes them. Future zone/debug commands should extend the registry rather than adding command-specific conditionals to the console organism.
