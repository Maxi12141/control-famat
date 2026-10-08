import { useEffect, useRef, useState } from 'react'
import { hidratarCatalogoRemoto, marcaCatalogoLocal, marcaCatalogoRemoto } from '../lib/catalog.js'
import { hidratarTablas } from '../lib/nube.js'
import { esMarcaReciente, marcaControlRemota, sincronizarControl } from '../lib/storage.js'
import { versionRemotaNueva } from '../lib/version.js'

async function recargarPrograma() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      reg?.waiting?.postMessage('actualizar')
    }
    if (window.caches) {
      const claves = await caches.keys()
      await Promise.all(claves.map((clave) => caches.delete(clave)))
    }
  } catch {
    /* igual se recarga */
  }
  window.setTimeout(() => location.reload(), 300)
}

export default function AvisoCambios({ onDatos, suelto = false }) {
  const [cambiosNuevos, setCambiosNuevos] = useState(false)
  const [appNueva, setAppNueva] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const marcaVista = useRef('')

  useEffect(() => {
    let vivo = true
    const avisarApp = () => {
      if (!vivo) return
      setAppNueva(true)
      setCambiosNuevos(true)
    }
    const onCambios = (event) => {
      if (event?.detail === 'app') avisarApp()
      else setCambiosNuevos(true)
    }
    window.addEventListener('famat-cambios-nuevos', onCambios)

    const mirar = async () => {
      try {
        if (await versionRemotaNueva()) avisarApp()
      } catch {
        /* sin red no molesta */
      }
      try {
        const marcaDatos = await marcaControlRemota()
        if (vivo && marcaDatos && !esMarcaReciente(marcaDatos)) setCambiosNuevos(true)
      } catch {
        /* sin red no molesta */
      }
      try {
        const marca = await marcaCatalogoRemoto()
        if (!vivo || !marca) return
        if (!marcaVista.current) {
          marcaVista.current = marca
          return
        }
        if (marca !== marcaVista.current && marca !== marcaCatalogoLocal()) {
          marcaVista.current = marca
          setCambiosNuevos(true)
        }
      } catch {
        /* sin red no molesta */
      }
    }

    mirar()
    const timer = window.setInterval(mirar, 15000)
    const alVolver = () => {
      if (document.visibilityState === 'hidden') return
      mirar()
    }
    window.addEventListener('focus', mirar)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      window.clearInterval(timer)
      window.removeEventListener('famat-cambios-nuevos', onCambios)
      window.removeEventListener('focus', mirar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  const actualizar = async () => {
    if (actualizando) return
    setActualizando(true)
    if (appNueva) {
      await recargarPrograma()
      return
    }
    try {
      await sincronizarControl()
      await hidratarTablas()
      await hidratarCatalogoRemoto()
      const marca = await marcaCatalogoRemoto()
      if (marca) marcaVista.current = marca
      onDatos?.()
      setCambiosNuevos(false)
    } catch {
      location.reload()
    } finally {
      setActualizando(false)
    }
  }

  if (!cambiosNuevos) return null

  return (
    <div className={`cambios-nuevos${suelto ? ' cambios-nuevos--suelto' : ''}`} role="status">
      <span>{appNueva ? 'Hay un cambio nuevo del programador' : 'Hay cambios nuevos'}</span>
      <button type="button" onClick={actualizar} disabled={actualizando}>
        {actualizando ? 'actualizando…' : 'actualizar'}
      </button>
    </div>
  )
}
