import { CLAVES_CONTROL, guardarRespaldoControl, leerRespaldoControl } from './supabase.js'

const IDB_NAME = 'famat-datos'
const IDB_STORE = 'kv'
const KEY_REMOTO_CONTROL = 'famat_control_remoto_id'

function vacio(raw) {
  if (raw == null || raw === '' || raw === 'null' || raw === 'undefined') return true
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.length === 0
    if (v && typeof v === 'object') return Object.keys(v).length === 0
  } catch {
    return false
  }
  return false
}

const LISTAS_POR_ID = new Set([
  'famat_cuentas',
  'famat_ventas',
  'famat_perdidas',
  'famat_pedidos',
  'famat_pendientes',
  'famat_comprobantes',
])

const MAPAS = new Set([
  'famat_precios',
  'famat_stock',
  'famat_stock_min',
  'famat_fotos',
  'famat_codigos',
  'famat_empresa',
])

function parseMaybe(raw, fallback) {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function fusionarValor(key, actual, backup) {
  if (backup == null || backup === '') return actual
  if (LISTAS_POR_ID.has(key)) {
    const a = parseMaybe(actual, [])
    const b = parseMaybe(backup, [])
    if (!Array.isArray(b) || !b.length) return actual
    const lista = Array.isArray(a) ? a : []
    const ids = new Set(lista.map((item) => item && item.id).filter(Boolean))
    const extra = b.filter((item) => {
      if (item && item.id) return !ids.has(item.id)
      const raw = JSON.stringify(item)
      return !lista.some((row) => JSON.stringify(row) === raw)
    })
    if (!extra.length && lista.length) return actual
    return JSON.stringify([...extra, ...lista].slice(0, 800))
  }
  if (MAPAS.has(key)) {
    const a = parseMaybe(actual, {})
    const b = parseMaybe(backup, {})
    if (!b || typeof b !== 'object' || Array.isArray(b)) return actual
    const base = a && typeof a === 'object' && !Array.isArray(a) ? a : {}
    const next = { ...b, ...base }
    if (JSON.stringify(next) === JSON.stringify(base)) return actual
    return JSON.stringify(next)
  }
  if (vacio(actual)) return String(backup)
  return actual
}

export function snapshotFamat() {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith('famat_')) out[key] = localStorage.getItem(key)
    }
  } catch {
    /* ignore */
  }
  return out
}

export function aplicarSnapshot(data, { soloVacios = true, fusionar = true } = {}) {
  if (!data || typeof data !== 'object') return 0
  let n = 0
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('famat_') || value == null || value === '') continue
    const actual = (() => {
      try { return localStorage.getItem(key) } catch { return null }
    })()
    const next = fusionar && soloVacios
      ? fusionarValor(key, actual, value)
      : (!soloVacios || vacio(actual) ? String(value) : actual)
    if (next == null || next === actual) continue
    try {
      localStorage.setItem(key, String(next))
      n += 1
    } catch {
      /* ignore */
    }
  }
  return n
}

function abrirIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('sin indexedDB'))
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function leerIdb() {
  try {
    const db = await abrirIdb()
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get('respaldo')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function guardarIdb(data) {
  try {
    const db = await abrirIdb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(data, 'respaldo')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
}

let timerRespaldo = 0
let timerNube = 0

function programarRespaldo() {
  window.clearTimeout(timerRespaldo)
  timerRespaldo = window.setTimeout(() => {
    guardarIdb(snapshotFamat())
  }, 250)
}

function snapshotControl() {
  const out = {}
  for (const clave of CLAVES_CONTROL) {
    try {
      const raw = localStorage.getItem(clave)
      if (raw) out[clave] = JSON.parse(raw)
    } catch {
      /* ignore */
    }
  }
  return out
}

function productosDesdeLocal() {
  const snap = snapshotControl()
  return CLAVES_CONTROL.map((clave) => ({ clave, datos: snap[clave] ?? null }))
}

async function subirNube() {
  try {
    const remotoId = localStorage.getItem(KEY_REMOTO_CONTROL) || ''
    const id = await guardarRespaldoControl(remotoId, productosDesdeLocal())
    if (id) localStorage.setItem(KEY_REMOTO_CONTROL, id)
  } catch {
    /* ignore */
  }
}

function programarNube() {
  window.clearTimeout(timerNube)
  timerNube = window.setTimeout(() => {
    subirNube()
  }, 800)
}

function snapshotDesdeProductos(productos) {
  const out = {}
  if (!Array.isArray(productos)) return out
  for (const item of productos) {
    const clave = String(item?.clave || '')
    if (!CLAVES_CONTROL.includes(clave) || item?.datos == null) continue
    out[clave] = typeof item.datos === 'string' ? item.datos : JSON.stringify(item.datos)
  }
  return out
}

async function hidratarNube() {
  try {
    const row = await leerRespaldoControl()
    if (!row) {
      programarNube()
      return 0
    }
    if (row.id != null) localStorage.setItem(KEY_REMOTO_CONTROL, String(row.id))
    const n = aplicarSnapshot(snapshotDesdeProductos(row.productos), { soloVacios: true, fusionar: true })
    programarNube()
    return n
  } catch {
    return 0
  }
}

export async function hidratarAlmacen() {
  const idb = await leerIdb()
  aplicarSnapshot(idb, { soloVacios: true, fusionar: true })
  const n = await hidratarNube()
  programarRespaldo()
  return { restaurado: n }
}

export function leerJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return (raw ? JSON.parse(raw) : fallback) ?? fallback
  } catch {
    return fallback
  }
}

export function guardarJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  programarRespaldo()
  if (CLAVES_CONTROL.includes(key)) programarNube()
}

export function resumenAlmacen() {
  const cuentas = leerJSON('famat_cuentas', [])
  const precios = leerJSON('famat_precios', {})
  const ventas = leerJSON('famat_ventas', [])
  const perdidas = leerJSON('famat_perdidas', [])
  const movs = Array.isArray(cuentas) ? cuentas : []
  const fiados = movs.filter((mov) => mov && mov.tipo === 'cargo' && mov.modo === 'fiado')
  const cobros = movs.filter((mov) => mov && mov.tipo === 'cobro')
  const mapaPrecios = precios && typeof precios === 'object' ? precios : {}
  return {
    fiados: fiados.length,
    cobros: cobros.length,
    movimientos: movs.length,
    precios: Object.keys(mapaPrecios).length,
    ventas: Array.isArray(ventas) ? ventas.length : 0,
    perdidas: Array.isArray(perdidas) ? perdidas.length : 0,
  }
}

export function descargarRespaldo() {
  const blob = new Blob([JSON.stringify({ fecha: new Date().toISOString(), datos: snapshotFamat() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `famat-respaldo-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importarRespaldoArchivo(file) {
  const texto = await file.text()
  const parsed = JSON.parse(texto)
  const datos = parsed?.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed
  const n = aplicarSnapshot(datos, { soloVacios: false, fusionar: false })
  await guardarIdb(snapshotFamat())
  programarNube()
  return n
}
