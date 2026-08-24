import type { ReactNode } from 'react'
import { AppearanceProvider } from '../../context/AppearanceContext'
import { BrainSceneProvider } from '../../context/BrainSceneContext'
import { ChatSessionsProvider } from '../../context/ChatSessionsContext'
import { ConnectionSettingsProvider } from '../../context/ConnectionSettingsContext'
import { HermesProfileProvider } from '../../context/HermesProfileContext'
import { HouseholdProvider } from '../../context/HouseholdContext'
import { InsightSelectionProvider } from '../../context/InsightSelectionContext'
import { RuntimeStatusProvider } from '../../context/RuntimeStatusContext'
import { SystemTelemetryProvider } from '../../context/SystemTelemetryContext'

type AppProvidersProps = {
  children: ReactNode
}

/**
 * Owns cross-application service/context composition. Keeping provider wiring here
 * prevents the root app and workspace shells from accumulating infrastructure
 * knowledge as new capabilities are added.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <HouseholdProvider>
      <AppearanceProvider>
        <ConnectionSettingsProvider>
          <HermesProfileProvider>
            <ChatSessionsProvider>
              <InsightSelectionProvider>
                <RuntimeStatusProvider>
                  <SystemTelemetryProvider>
                    <BrainSceneProvider>
                      {children}
                    </BrainSceneProvider>
                  </SystemTelemetryProvider>
                </RuntimeStatusProvider>
              </InsightSelectionProvider>
            </ChatSessionsProvider>
          </HermesProfileProvider>
        </ConnectionSettingsProvider>
      </AppearanceProvider>
    </HouseholdProvider>
  )
}
