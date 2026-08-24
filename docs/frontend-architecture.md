# Frontend architecture

This document records the dependency and ownership rules established during the Frontend Consolidation Pass (FCP). It is intentionally short: a contributor or coding agent should be able to understand the shape of the frontend before opening feature files.

## Current consolidation sequence

The accepted spatial shell and horizontal production-zone foundation are complete through FCP.6. The remaining consolidation gate before Hermes-facing browser control is:

1. **FCP.6A** — subdivide managed HUD lanes into semantic vertical slots and normalize panel fit contracts.
2. **FCP.6B** — add one managed HUD allocator with occupancy, collision/fallback policy and animated reflow.
3. **FCP.7** — add the local **Stage Director** semantic presentation/action layer and run the final frontend regression gate.
4. **Orchestration S2.6** may bind Hermes/browser transport only after FCP.7 is accepted.

Do not skip the placement layer by wiring semantic actions directly to DOM selectors, CSS coordinates or incidental `App.tsx` composition.

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
- Managed HUD geometry belongs to the HUD placement/allocator layer once FCP.6A/FCP.6B are implemented; individual feature panels should describe placement intent rather than own global coordinates.
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

## Layout zones and panel fit

Named layout zones are application contracts rather than developer-only rectangles.

- Canonical zone IDs and metadata live in `src/app/layout/layoutZones.ts`.
- Geometry tokens live in `src/styles/layout-zones.css`.
- Developer zone tooling re-exports and visualizes those exact contracts from `src/dev/zones/`; it must not own a duplicate zone model.
- Production surfaces declare ownership with `data-layout-zone` / `data-layout-owner` through `layoutZoneAttributes(...)`.
- The accepted horizontal lanes are `left-nav`, `left-hud`, `center-stage`, `right-hud`, with `top-band`, `bottom-band` and `floating-layer` as cross-workspace/global contracts.
- Zones define HUD/layout ownership; they do **not** clip the persistent WebGL world. Nodes, links, floor/grid/fade and scene connectors may render behind or across HUD zone boundaries.
- FCP.6A extends the managed lanes with semantic vertical slots such as `left-hud.top`, `left-hud.middle`, `left-hud.bottom` and equivalent center/right slots, separated by explicit gaps.
- Managed panels should declare fit intent such as content-fit, slot-fill, elastic, min/max height or preferred slot span. Lane-managed HUDs normally fill the lane width while height follows their fit contract rather than arbitrary full-lane geometry.
- User-floating/resizable surfaces remain valid where their contract says they are floating; the slot model is not a desktop-wide rigid tiling system.

The developer overlay must visualize the same application contracts used by production layout so debug geometry cannot silently diverge from real placement.

## Managed HUD allocation

FCP.6B introduces one semantic placement owner for registered HUD surfaces. Its job is to decide **where** managed panels fit; feature code and later semantic actions describe intent.

A managed HUD registration should be able to express:

- stable panel ID;
- preferred zone/slot and allowed fallbacks;
- priority or pinned status;
- fit/min/max/span policy;
- preferred ordering relative to known panels;
- whether the panel may move during reflow;
- lifetime such as workspace, selection-context or transient.

The allocator should:

- track live occupancy of semantic slots;
- use preferred free placement when possible;
- choose allowed fallbacks or reflow lower-priority movable panels when required;
- preserve lane/slot gaps and avoid managed-panel overlap;
- animate coherent repositioning rather than teleporting panels;
- restore a stable arrangement when transient panels close;
- reject arbitrary screen coordinates as the placement contract for managed semantic HUDs.

Floating/dragged user surfaces are a separate escape hatch and should not be silently snapped unless they explicitly opt into managed placement.

## Stage Director

**Stage Director** is the frontend's local semantic presentation/action boundary. It coordinates **what should be shown** while workspace state, runtime/data owners and the HUD allocator retain their own responsibilities.

Initial action families are expected to include:

- `openWorkspace(...)`
- `openTask(...)`
- `selectMemory(...)`
- `openChat(...)`
- `presentPanel(...)`
- `dismissPanel(...)`
- a memory-trace presentation primitive such as `focusMemoryTrace(...)`

Stage Director must not become a second Hermes execution/control plane. Hermes tasks, sessions, memory and runtime state remain authoritative in their existing backend/data layers. Stage Director only coordinates frontend presentation of stable IDs and bounded user-facing content.

Callers may express semantic placement preference for a managed panel, but the HUD allocator decides final zone/slot and any animated reflow. Public Stage Director inputs must not depend on DOM selectors, React refs, incidental component hierarchy or x/y coordinates.

Orchestration S2.6 may expose Hermes → browser transport only after this local action boundary and its regression gate are accepted.

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

The zone definitions themselves are application contracts under `src/app/layout/`; developer tooling only visualizes them. Future zone/slot/debug commands should extend the registry rather than adding command-specific conditionals to the console organism.
