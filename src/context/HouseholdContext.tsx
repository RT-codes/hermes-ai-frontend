import { createContext, useContext, type ReactNode } from 'react'

type HouseholdUser = {
  id: string
  displayName: string
}

type HouseholdContextValue = {
  currentUser: HouseholdUser
}

const householdUser: HouseholdUser = {
  id: 'household',
  displayName: 'Home',
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  return (
    <HouseholdContext.Provider value={{ currentUser: householdUser }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)

  if (!context) {
    throw new Error('useHousehold must be used inside HouseholdProvider')
  }

  return context
}
