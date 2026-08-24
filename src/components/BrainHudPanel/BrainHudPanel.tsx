import { HudPanel, type HudPanelProps } from '../../ui/components/HudPanel/HudPanel'

export type BrainHudPanelProps = HudPanelProps

/**
 * Compatibility wrapper retained while Memory-era imports migrate toward HudPanel.
 * New shared/workspace-agnostic code should import the neutral UI component instead.
 */
export function BrainHudPanel(props: BrainHudPanelProps) {
  return <HudPanel {...props} />
}
