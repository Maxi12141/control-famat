let evento = null
const oyentes = new Set()

function avisar() {
  for (const fn of oyentes) fn()
}

export function puedeInstalar() {
  return Boolean(evento)
}

export function yaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function esCelu() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function alCambiarInstalacion(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function prepararInstalacion() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    evento = event
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    avisar()
  })
}

export async function instalarApp() {
  if (!evento) return false
  evento.prompt()
  const resultado = await evento.userChoice
  evento = null
  avisar()
  return resultado.outcome === 'accepted'
}
