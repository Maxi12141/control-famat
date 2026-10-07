import { useEffect, useState } from 'react'
import { alCambiarInstalacion, esCelu, instalarApp, puedeInstalar, yaInstalada } from '../lib/instalar.js'

export default function DescargarApp({ compacto = false }) {
  const [listo, setListo] = useState(() => puedeInstalar())
  const [instalada, setInstalada] = useState(() => yaInstalada())

  useEffect(() => alCambiarInstalacion(() => {
    setListo(puedeInstalar())
    setInstalada(yaInstalada())
  }), [])

  if (instalada) return null

  if (listo) {
    return (
      <button type="button" className={compacto ? 'descargar-app descargar-app--compacto' : 'descargar-app'} onClick={() => instalarApp()}>
        {compacto ? 'Descargar' : 'Descargar la app'}
      </button>
    )
  }

  if (compacto || !esCelu()) return null

  return (
    <p className="descargar-app__ayuda">
      Para dejarla en el acceso rápido: tocá los 3 puntos del navegador y después Instalar aplicación.
    </p>
  )
}
