import { createContext, useContext } from 'react'
import type { Project } from '@chronos/shared'

type ServicesLayoutContextValue = {
  activeProjectId?: string
  projects: Project[]
}

const ServicesLayoutContext = createContext<ServicesLayoutContextValue | null>(null)

export function ServicesLayoutProvider(props: {
  children: React.ReactNode
  value: ServicesLayoutContextValue
}) {
  return <ServicesLayoutContext.Provider value={props.value}>{props.children}</ServicesLayoutContext.Provider>
}

export function useServicesLayout() {
  const context = useContext(ServicesLayoutContext)

  if (!context) {
    throw new Error('useServicesLayout must be used within ServicesLayoutProvider')
  }

  return context
}
