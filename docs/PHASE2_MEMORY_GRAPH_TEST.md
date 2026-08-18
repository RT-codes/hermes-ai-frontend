# Phase 2 memory graph test pass

This branch is intentionally read-only against Hindsight. The Brain view lists banks and reads Hindsight's graph endpoint; it does not retain, edit, invalidate, or delete memory.

## Expected behavior

- Brain starts with a loading state and replaces Phase 1 mock data with the real Hindsight graph.
- The phase label shows `HINDSIGHT · <bank id>` and the real node count.
- Orbit, pan, zoom and node drag still work.
- Hover emphasizes the first-hop neighborhood.
- Clicking a memory keeps it selected, fades unrelated nodes/links, and opens the right-side Memory Inspector.
- Inspector shows the memory text and available metadata and can be closed without changing memory.
- `REFRESH MEMORY` re-reads Hindsight; it does not create test memories.
- If Hindsight cannot be read, the UI explicitly reports a read-only mock fallback rather than silently pretending the mock graph is real.

## Test safety

No destructive or mutating Hindsight calls are used by this branch. You do not need to wipe memory after exercising graph interactions. If we later want to test retain/recall with synthetic content, use a dedicated temporary Hindsight bank rather than the household bank.
