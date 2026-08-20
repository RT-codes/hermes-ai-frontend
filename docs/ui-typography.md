# UI typography and scaling

Hermes Home uses compact HUD typography, but readability must not depend on one monitor DPI or browser scale.

## Appearance controls

The Appearance settings provide:

- **Interface scale** — 85% to 140%; adjusts the root rem scale so the UI can be tuned for screen density and viewing distance.
- **Interface font** — Modern, Humanist, Technical, or Monospace presets for general UI text.
- **HUD / data font** — Technical, Monospace, or Modern presets for telemetry, Insight, compact labels, and data-heavy surfaces.

The font choices are system-font stacks and do not ship font files.

## Design rules

- Avoid adding new essential text below approximately `0.55rem` at the default 100% scale.
- Working Trace and other prose-heavy diagnostic text should be comfortably readable before the user changes scale.
- Very small type may still be used for non-essential metadata only when it remains legible and does not carry unique state.
- Prefer the shared `--font-ui` and `--font-hud` variables rather than hardcoding font stacks.
- Scaling is a user preference, not a substitute for a reasonable default font size.
