import { createContext, useContext } from 'react'

export const PanelContext = createContext({
  role: 'empleado',
  verPrecios: false,
  esJefe: false,
})

export function usePanel() {
  return useContext(PanelContext)
}
