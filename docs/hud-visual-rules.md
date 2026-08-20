# Hermes HUD visual rules

## Cut-corner borders

Any panel, bubble, control, or card that uses a clipped diagonal/cut-corner shape must preserve the visible 1px HUD edge around the diagonal cuts.

A standard CSS `border` on an element with `clip-path` does not reliably draw the border along the clipped diagonal edges. Use a two-layer construction instead:

1. outer clipped layer = edge/border color
2. inner clipped layer inset by 1px = component fill/background

Do not ship a new clipped HUD component using only `border + clip-path`.

This is a shared design-system rule, not a component-specific Chat workaround.
