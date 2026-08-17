import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type BrainScreenPoint = {
  x: number
  y: number
}

type BrainSceneContextValue = {
  centerPoint: BrainScreenPoint | null
  setCenterPoint: (point: BrainScreenPoint | null) => void
}

const BrainSceneContext = createContext<BrainSceneContextValue | null>(null)

export function BrainSceneProvider({ children }: { children: ReactNode }) {
  const [centerPoint, setCenterPoint] = useState<BrainScreenPoint | null>(null)
  const value = useMemo(() => ({ centerPoint, setCenterPoint }), [centerPoint])

  return <BrainSceneContext.Provider value={value}>{children}</BrainSceneContext.Provider>
}

export function useBrainScene() {
  const context = useContext(BrainSceneContext)
  if (!context) throw new Error('useBrainScene must be used inside BrainSceneProvider')
  return context
}
