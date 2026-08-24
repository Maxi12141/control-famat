const ROL_KEY = 'famat_sesion_rol'
const PIN_KEY = 'famat_jefe_pin_hash'
const PERFIL_KEY = 'famat_staff_perfil'

export function leerRol() {
  try {
    const rol = sessionStorage.getItem(ROL_KEY)
    if (rol === 'jefe' || rol === 'empleado') return rol
    if (rol === 'clientes') sessionStorage.removeItem(ROL_KEY)
  } catch {
    /* ignore */
  }
  return null
}

export function guardarRol(rol) {
  sessionStorage.setItem(ROL_KEY, rol)
}

export function borrarRol() {
  sessionStorage.removeItem(ROL_KEY)
}

export function etiquetaRol(rol) {
  return rol === 'jefe' ? 'Administrador' : 'Empleado'
}

export function leerNombre() {
  try {
    return localStorage.getItem(PERFIL_KEY) || ''
  } catch {
    return ''
  }
}

export function guardarNombre(nombre) {
  localStorage.setItem(PERFIL_KEY, nombre.trim())
}

export function iniciales(nombre, rol) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return rol === 'jefe' ? 'JF' : 'EM'
}

export function soloPin(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8)
}

export function validarPin(pin) {
  return soloPin(pin).length < 4 ? 'El PIN tiene que tener entre 4 y 8 números.' : ''
}

async function hashPin(pin) {
  const payload = `famat-jefe:${soloPin(pin)}`
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(payload)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let hash = 5381
  for (let i = 0; i < payload.length; i += 1) hash = (hash << 5) + hash + payload.charCodeAt(i)
  return (hash >>> 0).toString(16)
}

export function hayPinJefe() {
  try {
    return !!localStorage.getItem(PIN_KEY)
  } catch {
    return false
  }
}

export async function guardarPinJefe(pin, repetir) {
  const error = validarPin(pin)
  if (error) throw new Error(error)
  if (pin !== repetir) throw new Error('Los PIN no coinciden.')
  localStorage.setItem(PIN_KEY, await hashPin(pin))
}

export async function verificarPinJefe(pin) {
  const error = validarPin(pin)
  if (error) throw new Error(error)
  const guardado = localStorage.getItem(PIN_KEY)
  if (!guardado) throw new Error('Todavía no hay un PIN de jefe. Crealo ahora.')
  if (guardado !== (await hashPin(pin))) throw new Error('PIN incorrecto.')
}
