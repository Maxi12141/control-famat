import { CLAVES_CONTROL, guardarRespaldoControl, leerRespaldoControl, marcaControlRemota } from './supabase.js'

export { marcaControlRemota }

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

const MAPAS_SYNC = new Set([
  'famat_codigos',
  'famat_precios',
  'famat_stock',
  'famat_stock_min',
])

const LISTAS_SYNC = new Set([
  'famat_ventas',
  'famat_perdidas',
  'famat_cuentas',
])

const KEY_MARCAS = 'famat_sync_marcas'
const KEY_MARCA_VISTA = 'famat_control_marca_vista'
const KEY_MARCA_PROPIA = 'famat_control_marca_propia'
let marcaEnCurso = ''

function objeto(valor) {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}
}

function ordenar(valor) {
  if (Array.isArray(valor)) return valor.map(ordenar)
  if (!valor || typeof valor !== 'object') return valor
  const out = {}
  for (const clave of Object.keys(valor).sort()) out[clave] = ordenar(valor[clave])
  return out
}

function estable(valor) {
  return JSON.stringify(ordenar(valor))
}

function sinMarca(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  const { _m, ...resto } = item
  return resto
}

function leerMarcas() {
  return objeto(leerJSON(KEY_MARCAS, {}))
}

function anotarMarca(marca) {
  if (!marca) return
  localStorage.setItem(KEY_MARCA_VISTA, marca)
  localStorage.setItem(KEY_MARCA_PROPIA, marca)
}

export function esMarcaReciente(marca) {
  if (!marca) return true
  try {
    const vista = localStorage.getItem(KEY_MARCA_VISTA) || ''
    const propia = localStorage.getItem(KEY_MARCA_PROPIA) || ''
    return marca === vista || marca === propia || (marcaEnCurso !== '' && marca === marcaEnCurso)
  } catch {
    return false
  }
}

function parseMaybe(raw, fallback) {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function fusionarLista(actual, backup, preferirRemoto) {
  const lista = Array.isArray(parseMaybe(actual, [])) ? parseMaybe(actual, []) : []
  const remoto = Array.isArray(parseMaybe(backup, [])) ? parseMaybe(backup, []) : []
  if (!remoto.length) return actual
  const map = new Map()
  for (const item of lista) {
    if (item?.id) map.set(String(item.id), item)
  }
  let cambio = false
  for (const item of remoto) {
    if (!item?.id) continue
    const id = String(item.id)
    const previo = map.get(id)
    if (!previo) {
      map.set(id, item)
      cambio = true
      continue
    }
    const lm = String(previo._m || '')
    const rm = String(item._m || '')
    let elegido = previo
    if (rm && rm > lm) elegido = item
    else if (lm && lm >= rm) elegido = previo
    else if (preferirRemoto && estable(sinMarca(previo)) !== estable(sinMarca(item))) elegido = { ...previo, ...item }
    else elegido = { ...item, ...previo, _m: previo._m || item._m }
    if (estable(elegido) !== estable(previo)) cambio = true
    map.set(id, elegido)
  }
  const sueltos = remoto.filter((item) => {
    if (item?.id) return false
    const raw = estable(item)
    return !lista.some((row) => estable(row) === raw)
  })
  if (sueltos.length) cambio = true
  if (!cambio) return actual
  const idsLocal = new Set(lista.map((item) => (item?.id ? String(item.id) : '')).filter(Boolean))
  const nuevos = remoto.filter((item) => item?.id && !idsLocal.has(String(item.id))).map((item) => map.get(String(item.id)))
  const resto = lista.map((item) => (item?.id ? map.get(String(item.id)) || item : item))
  return JSON.stringify([...nuevos, ...sueltos, ...resto].slice(0, 800))
}

function fusionarMapa(actual, backup, localSlot, remotoSlot, preferirRemoto) {
  const base = objeto(parseMaybe(actual, {}))
  const extra = objeto(parseMaybe(backup, {}))
  const localM = objeto(localSlot)
  const remotoM = objeto(remotoSlot)
  const claves = new Set([...Object.keys(base), ...Object.keys(extra)])
  const next = { ...base }
  const marcas = { ...localM }
  let cambio = false
  for (const clave of claves) {
    const tieneLocal = Object.prototype.hasOwnProperty.call(base, clave)
    const tieneRemoto = Object.prototype.hasOwnProperty.call(extra, clave)
    const lm = localM[clave] || ''
    const rm = remotoM[clave] || ''
    let tomarRemoto = false
    if (!tieneLocal && tieneRemoto) tomarRemoto = true
    else if (tieneLocal && !tieneRemoto) tomarRemoto = false
    else if (rm && rm > lm) tomarRemoto = true
    else if (lm && lm >= rm) tomarRemoto = false
    else if (preferirRemoto && estable(base[clave]) !== estable(extra[clave])) tomarRemoto = true
    if (tomarRemoto && tieneRemoto) {
      if (estable(base[clave]) !== estable(extra[clave])) {
        next[clave] = extra[clave]
        cambio = true
      }
      if (rm) marcas[clave] = rm
      else if (lm) marcas[clave] = lm
    } else if (lm) {
      marcas[clave] = lm
    }
  }
  return { valor: cambio ? JSON.stringify(next) : actual, marcas, cambio }
}

function fusionarValor(key, actual, backup, preferirRemoto = false) {
  if (backup == null || backup === '') return actual
  if (LISTAS_POR_ID.has(key)) return fusionarLista(actual, backup, preferirRemoto)
  if (MAPAS_SYNC.has(key)) {
    return fusionarMapa(actual, backup, {}, {}, preferirRemoto).valor
  }
  if (MAPAS.has(key)) {
    const a = parseMaybe(actual, {})
    const b = parseMaybe(backup, {})
    if (!b || typeof b !== 'object' || Array.isArray(b)) return actual
    const base = a && typeof a === 'object' && !Array.isArray(a) ? a : {}
    const next = preferirRemoto ? { ...base, ...b } : { ...b, ...base }
    if (JSON.stringify(next) === JSON.stringify(base)) return actual
    return JSON.stringify(next)
  }
  if (vacio(actual) || preferirRemoto) return String(backup)
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

export function aplicarSnapshot(data, { soloVacios = true, fusionar = true, preferirRemoto = false } = {}) {
  if (!data || typeof data !== 'object') return 0
  const remotoMarcas = objeto(parseMaybe(data[KEY_MARCAS], {}))
  const localMarcas = leerMarcas()
  const marcasNext = { ...localMarcas }
  let marcasCambio = false
  let n = 0
  for (const [key, value] of Object.entries(data)) {
    if (key === KEY_MARCAS || !key.startsWith('famat_') || value == null || value === '') continue
    const actual = (() => {
      try { return localStorage.getItem(key) } catch { return null }
    })()
    let next = actual
    if (fusionar && MAPAS_SYNC.has(key)) {
      const resultado = fusionarMapa(
        actual,
        value,
        localMarcas[key],
        remotoMarcas[key],
        preferirRemoto || !soloVacios,
      )
      next = resultado.valor
      if (estable(resultado.marcas) !== estable(objeto(localMarcas[key]))) {
        marcasNext[key] = resultado.marcas
        marcasCambio = true
      }
    } else if (fusionar) {
      next = fusionarValor(key, actual, value, preferirRemoto && !soloVacios)
    } else if (!soloVacios || vacio(actual)) {
      next = String(value)
    }
    if (next == null || next === actual) continue
    try {
      localStorage.setItem(key, String(next))
      n += 1
    } catch {
      /* ignore */
    }
  }
  if (marcasCambio) {
    try { localStorage.setItem(KEY_MARCAS, JSON.stringify(marcasNext)) } catch { /* ignore */ }
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

function firmaProductos(productos) {
  const obj = {}
  if (!Array.isArray(productos)) return ''
  for (const item of productos) {
    const clave = String(item?.clave || '')
    if (!clave || item?.datos == null) continue
    obj[clave] = item.datos
  }
  return estable(obj)
}

let colaSync = Promise.resolve()

async function sincronizarControlAhora() {
  let row = null
  try {
    row = await leerRespaldoControl()
  } catch {
    row = null
  }
  let cambios = 0
  const marcaRemota = row?.id != null ? `${row.id}|${row.fecha_creacion || ''}` : ''
  if (marcaRemota) anotarMarca(marcaRemota)
  if (row) {
    if (row.id != null) localStorage.setItem(KEY_REMOTO_CONTROL, String(row.id))
    cambios = aplicarSnapshot(snapshotDesdeProductos(row.productos), {
      soloVacios: false,
      fusionar: true,
      preferirRemoto: true,
    })
  }
  const productos = productosDesdeLocal()
  const firmaLocal = firmaProductos(productos)
  const firmaRemota = row ? firmaProductos(row.productos) : ''
  if (row && firmaLocal === firmaRemota) {
    anotarMarca(marcaRemota)
    if (cambios > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('famat-datos-aplicados'))
    }
    return { cambios, marca: marcaRemota }
  }
  const fecha = new Date().toISOString()
  const remotoId = localStorage.getItem(KEY_REMOTO_CONTROL) || ''
  if (remotoId) marcaEnCurso = `${remotoId}|${fecha}`
  try {
    const id = await guardarRespaldoControl(remotoId, productos, fecha)
    if (!id) return { cambios, marca: marcaRemota }
    const marca = `${id}|${fecha}`
    anotarMarca(marca)
    if (cambios > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('famat-datos-aplicados'))
    }
    return { cambios, marca }
  } finally {
    marcaEnCurso = ''
  }
}

export function sincronizarControl() {
  const tarea = colaSync.then(() => sincronizarControlAhora())
  colaSync = tarea.then(() => {}, () => {})
  return tarea
}

function programarNube() {
  window.clearTimeout(timerNube)
  timerNube = window.setTimeout(() => {
    sincronizarControl().catch(() => {})
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
    const { cambios } = await sincronizarControl()
    return cambios
  } catch {
    return 0
  }
}

export async function hidratarAlmacen() {
  const idb = await leerIdb()
  aplicarSnapshot(idb, { soloVacios: true, fusionar: true })
  const n = await hidratarNube()
  try {
    const { hidratarTablas } = await import('./nube.js')
    await hidratarTablas()
  } catch {
    /* sin red siguen los datos del aparato */
  }
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

function marcarMapa(key, value) {
  const previo = objeto(leerJSON(key, {}))
  const next = objeto(value)
  const marcas = leerMarcas()
  const slot = { ...objeto(marcas[key]) }
  const ahora = new Date().toISOString()
  let cambio = false
  const claves = new Set([...Object.keys(previo), ...Object.keys(next)])
  for (const clave of claves) {
    if (estable(previo[clave]) === estable(next[clave])) continue
    slot[clave] = ahora
    cambio = true
  }
  if (!cambio) return
  marcas[key] = slot
  localStorage.setItem(KEY_MARCAS, JSON.stringify(marcas))
}

function marcarLista(key, value) {
  if (!Array.isArray(value)) return value
  const previo = leerJSON(key, [])
  const anteriores = new Map()
  if (Array.isArray(previo)) {
    for (const item of previo) {
      if (item?.id) anteriores.set(String(item.id), item)
    }
  }
  const ahora = new Date().toISOString()
  return value.map((item) => {
    if (!item || typeof item !== 'object' || !item.id) return item
    const anterior = anteriores.get(String(item.id))
    if (anterior && estable(sinMarca(anterior)) === estable(sinMarca(item))) {
      return anterior._m ? { ...item, _m: anterior._m } : item
    }
    return { ...item, _m: ahora }
  })
}

export function guardarJSON(key, value, opts = {}) {
  let next = value
  if (!opts.sinNube && LISTAS_SYNC.has(key)) next = marcarLista(key, value)
  const previoRaw = (() => {
    try { return localStorage.getItem(key) } catch { return null }
  })()
  if (previoRaw != null && estable(parseMaybe(previoRaw, null)) === estable(next)) return
  if (!opts.sinNube && MAPAS_SYNC.has(key)) marcarMapa(key, next)
  localStorage.setItem(key, JSON.stringify(next))
  programarRespaldo()
  if (!opts.sinNube && (CLAVES_CONTROL.includes(key) || MAPAS_SYNC.has(key) || LISTAS_SYNC.has(key))) programarNube()
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
