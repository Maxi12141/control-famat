import { listarProductos } from './catalog.js'
import { headersSupabase, SUPABASE_URL } from './supabase.js'
import { guardarJSON, leerJSON } from './storage.js'

function numero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

async function leerTabla(tabla) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*&limit=1000`, {
    headers: headersSupabase(),
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function guardarTabla(tabla, filas, conflicto) {
  if (!filas.length) return false
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?on_conflict=${conflicto}`, {
    method: 'POST',
    headers: headersSupabase({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(filas),
  })
  return res.ok
}

function importeLocal(row) {
  return {
    id: String(row.id),
    fecha: String(row.fecha || ''),
    origen: String(row.origen || ''),
    cliente: String(row.cliente || ''),
    telefono: String(row.telefono || ''),
    pedidoId: String(row.pedido_id || row.pedidoId || ''),
    pagado: row.pagado !== false,
    items: Array.isArray(row.items) ? row.items : [],
    total: numero(row.total),
  }
}

function importeRemoto(row) {
  return {
    id: String(row.id),
    fecha: String(row.fecha || ''),
    origen: String(row.origen || ''),
    cliente: String(row.cliente || ''),
    telefono: String(row.telefono || ''),
    pedido_id: String(row.pedidoId || row.pedido_id || ''),
    pagado: row.pagado !== false,
    items: Array.isArray(row.items) ? row.items : [],
    total: numero(row.total),
  }
}

function fiadoLocal(row) {
  return {
    id: String(row.id),
    tipo: row.tipo === 'cobro' ? 'cobro' : 'cargo',
    cliente: String(row.cliente || ''),
    telefono: String(row.telefono || ''),
    pedidoId: String(row.pedido_id || row.pedidoId || ''),
    total: numero(row.total),
    monto: numero(row.monto),
    modo: String(row.modo || ''),
    fecha: String(row.fecha || ''),
    notas: String(row.notas || ''),
    items: Array.isArray(row.items) ? row.items : [],
  }
}

function fiadoRemoto(row) {
  return {
    id: String(row.id),
    tipo: row.tipo === 'cobro' ? 'cobro' : 'cargo',
    cliente: String(row.cliente || ''),
    telefono: String(row.telefono || ''),
    pedido_id: String(row.pedidoId || row.pedido_id || ''),
    total: numero(row.total),
    monto: numero(row.monto),
    modo: String(row.modo || ''),
    fecha: String(row.fecha || ''),
    notas: String(row.notas || ''),
    items: Array.isArray(row.items) ? row.items : [],
  }
}

function perdidaLocal(row) {
  return {
    id: String(row.id),
    fecha: String(row.fecha || ''),
    slug: String(row.slug || ''),
    nombre: String(row.nombre || ''),
    cantidad: numero(row.cantidad),
    costo: numero(row.costo),
    total: numero(row.total),
    proveedor: String(row.proveedor || ''),
  }
}

function perdidaRemota(row) {
  return {
    id: String(row.id),
    fecha: String(row.fecha || ''),
    slug: String(row.slug || ''),
    nombre: String(row.nombre || ''),
    cantidad: numero(row.cantidad),
    costo: numero(row.costo),
    total: numero(row.total),
    proveedor: String(row.proveedor || ''),
  }
}

function mismaLista(local, remoto) {
  const firma = (lista) => (Array.isArray(lista) ? lista : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return JSON.stringify(item)
      const { _m, ...resto } = item
      return JSON.stringify(resto)
    })
    .sort()
    .join('|')
  return firma(local) === firma(remoto)
}

function mezclarPorId(local, remoto) {
  const map = new Map()
  for (const row of remoto) {
    if (row?.id) map.set(String(row.id), row)
  }
  for (const row of local) {
    if (!row?.id) continue
    const previo = map.get(String(row.id))
    map.set(String(row.id), previo ? { ...previo, ...row } : row)
  }
  return [...map.values()]
}

export async function publicarImportes(filas) {
  const rows = (Array.isArray(filas) ? filas : [filas]).filter((row) => row?.id).map(importeRemoto)
  try {
    await guardarTabla('importes', rows, 'id')
  } catch {
    /* el local queda y se reintenta al abrir */
  }
}

export async function publicarFiados(filas) {
  const rows = (Array.isArray(filas) ? filas : [filas]).filter((row) => row?.id && row.cliente).map(fiadoRemoto)
  try {
    await guardarTabla('fiados', rows, 'id')
  } catch {
    /* el local queda y se reintenta al abrir */
  }
}

export async function publicarPerdidas(filas) {
  const rows = (Array.isArray(filas) ? filas : [filas]).filter((row) => row?.id).map(perdidaRemota)
  try {
    await guardarTabla('perdidas', rows, 'id')
  } catch {
    /* el local queda y se reintenta al abrir */
  }
}

export async function publicarPrecios() {
  try {
    const guardados = leerJSON('famat_precios', {})
    const codigos = leerJSON('famat_codigos', {})
    const nombres = new Map()
    try {
      for (const item of listarProductos()) nombres.set(item.slug, { nombre: item.nombre, codigo: item.codigo })
    } catch {
      /* sin catálogo igual se guardan los precios */
    }
    const slugs = new Set([...Object.keys(guardados || {}), ...Object.keys(codigos || {})])
    const filas = []
    for (const slug of slugs) {
      const precio = guardados?.[slug] || {}
      const info = nombres.get(slug)
      const inicial = numero(precio.venta)
      const publico = numero(precio.costo)
      const codigo = String(codigos?.[slug] || info?.codigo || '')
      if (!inicial && !publico && !codigo) continue
      filas.push({
        slug,
        codigo,
        nombre: info?.nombre || '',
        precio_inicial: inicial,
        precio_publico: publico,
        updated_at: new Date().toISOString(),
      })
    }
    await guardarTabla('precios', filas, 'slug')
  } catch {
    /* se reintenta al abrir */
  }
}

let timerPrecios = 0
export function programarPrecios() {
  window.clearTimeout(timerPrecios)
  timerPrecios = window.setTimeout(() => {
    publicarPrecios()
  }, 400)
}

export async function hidratarTablas() {
  try {
    const [precios, importes, fiados, perdidas] = await Promise.all([
      leerTabla('precios'),
      leerTabla('importes'),
      leerTabla('fiados'),
      leerTabla('perdidas'),
    ])

    const localPrecios = leerJSON('famat_precios', {})
    const basePrecios = localPrecios && typeof localPrecios === 'object' ? { ...localPrecios } : {}
    const codigos = leerJSON('famat_codigos', {})
    const baseCodigos = codigos && typeof codigos === 'object' ? { ...codigos } : {}
    let cambioPrecios = false
    for (const row of precios) {
      if (!row?.slug) continue
      if (!basePrecios[row.slug]) {
        basePrecios[row.slug] = {
          venta: numero(row.precio_inicial),
          costo: numero(row.precio_publico),
        }
        cambioPrecios = true
      }
      if (row.codigo && !baseCodigos[row.slug]) {
        baseCodigos[row.slug] = String(row.codigo)
        cambioPrecios = true
      }
    }
    if (cambioPrecios) {
      guardarJSON('famat_precios', basePrecios)
      guardarJSON('famat_codigos', baseCodigos)
    }
    if (Object.keys(basePrecios).length || Object.keys(baseCodigos).length) publicarPrecios()

    const ventasLocal = leerJSON('famat_ventas', [])
    const ventas = mezclarPorId(
      Array.isArray(ventasLocal) ? ventasLocal : [],
      importes.map(importeLocal),
    )
    if (ventas.length && !mismaLista(ventasLocal, ventas)) guardarJSON('famat_ventas', ventas)

    const fiadosLocal = leerJSON('famat_cuentas', [])
    const cuentas = mezclarPorId(
      Array.isArray(fiadosLocal) ? fiadosLocal : [],
      fiados.map(fiadoLocal),
    )
    if (cuentas.length && !mismaLista(fiadosLocal, cuentas)) guardarJSON('famat_cuentas', cuentas)

    const perdidasLocal = leerJSON('famat_perdidas', [])
    const bajas = mezclarPorId(
      Array.isArray(perdidasLocal) ? perdidasLocal : [],
      perdidas.map(perdidaLocal),
    )
    if (bajas.length && !mismaLista(perdidasLocal, bajas)) guardarJSON('famat_perdidas', bajas)
    const idsPerdidas = new Set(perdidas.map((row) => String(row.id)))
    publicarPerdidas(bajas.filter((row) => row?.id && !idsPerdidas.has(String(row.id))))
  } catch {
    /* sin red sigue lo que hay en el aparato */
  }
}
