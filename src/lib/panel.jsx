import { createContext, useContext } from 'react'

export const PanelContext = createContext({
  role: 'empleado',
  verPrecios: true,
  editarPrecios: false,
  esJefe: false,
})

export function usePanel() {
  return useContext(PanelContext)
}
