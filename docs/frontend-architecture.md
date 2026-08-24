# Frontend architecture

This document records the dependency and ownership rules being established during the Frontend Consolidation Pass (FCP). It is intentionally short: a contributor or coding agent should be able to understand the shape of the frontend before opening feature files.

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
- Workspace navigation belongs to one workspace controller (FCP.3 target).
- Workspace-local selection/filter state belongs to that workspace.
- Shared spatial camera/environment state belongs to the spatial shell (FCP.4 target).
- Temporary component interaction state stays local unless another surface genuinely needs it.
- Do not duplicate authoritative state to make rendering easier; derive presentation state instead.

## Comments

Comments should explain **intent, ownership, invariants, boundaries or non-obvious tradeoffs**.

Good comments answer questions such as:
- Why does this component own this state?
- Which layer is allowed to call this function?
- Which behavior must remain stable during refactors?
- Why is an apparently simpler implementation intentionally avoided?

Avoid comments that merely translate syntax into English.

## Styling

Shared appearance belongs under `src/styles/primitives/` or later shared style layers. Feature styles should describe feature layout/variants, not reimplement shared glass, border, cut-corner or typography recipes.

The first extracted primitive is:

- `src/ui/cells/HudSurface/HudSurface.tsx`
- `src/styles/primitives/hud-surface.css`

Both `BrainHudPanel` and the FCP developer console consume that primitive. This is the migration pattern for repeated visual recipes during FCP.6.

## Developer tooling

Frontend developer tooling lives under `src/dev/`. It may inspect and manipulate registered frontend state through explicit APIs, but it is not a raw host shell and must not silently cross infrastructure/security boundaries.

The Quake-style console separates:
- UI/transcript/history: `src/dev/console/DeveloperConsole.tsx`
- global shortcut policy: `src/dev/console/useDeveloperConsoleToggle.ts`
- executable command registry: `src/dev/commands/developerCommandRegistry.ts`

Future zone/debug commands should extend the registry rather than adding command-specific conditionals to the console organism.
