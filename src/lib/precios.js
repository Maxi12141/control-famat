import { guardarJSON, leerJSON } from './storage.js'
import { PRECIOS_SEED } from '../data/preciosSeed.js'

const KEY = 'famat_precios'

export const LISTA_PUBLICO = 'publico'
export const LISTA_ESCUELA = 'escuela'
export const PCT_ESCUELA = 10

function leerGuardado() {
  const data = leerJSON(KEY, {})
  return data && typeof data === 'object' ? data : {}
}

function filaEfectiva(slug) {
  const saved = leerGuardado()[slug]
  const seed = PRECIOS_SEED[slug]
  const venta = Number(saved?.venta) || Number(seed?.venta) || 0
  const costo = Number(saved?.costo) || Number(seed?.costo) || 0
  return { venta, costo }
}

function leer() {
  const slugs = new Set([...Object.keys(PRECIOS_SEED), ...Object.keys(leerGuardado())])
  const out = {}
  for (const slug of slugs) out[slug] = filaEfectiva(slug)
  return out
}

export function redondearEscuela(publico) {
  const n = Math.max(0, Number(publico) || 0)
  return n ? Math.round(n * (1 + PCT_ESCUELA / 100)) : 0
}

export function pctPublico(inicial, publico) {
  const base = Math.max(0, Number(inicial) || 0)
  const pub = Math.max(0, Number(publico) || 0)
  if (!base || !pub) return null
  return Math.round((pub / base - 1) * 100)
}

export function esListaEscuela(lista) {
  return lista === LISTA_ESCUELA
}

export function pareceEscuela(texto) {
  return /\b(escuela|colegio|jard[ií]n|jardin|instituto|secundari[oa]|primari[oa])\b/i.test(String(texto || ''))
}

export function precioDe(slug) {
  const row = filaEfectiva(slug)
  const venta = Number(row.venta) || 0
  const costo = Number(row.costo) || 0
  const publico = costo || venta || 0
  return { venta, costo, publico, escuela: redondearEscuela(publico) }
}

export function precioPublicoDe(slug) {
  return precioDe(slug).publico
}

export function precioEscuelaDe(slug) {
  return precioDe(slug).escuela
}

export function precioCobroDe(slug, lista = LISTA_PUBLICO) {
  const row = precioDe(slug)
  return esListaEscuela(lista) ? row.escuela : row.publico
}

export function cobroDesdeVenta(venta, porcentaje) {
  const v = Math.max(0, Number(venta) || 0)
  const pct = Number(String(porcentaje).replace(',', '.')) || 0
  return Math.round(v * (1 + pct / 100))
}

export function aplicarPorcentajeACobro(slugs, porcentaje) {
  const data = leerGuardado()
  let n = 0
  for (const slug of slugs) {
    const actual = filaEfectiva(slug)
    const venta = Number(actual.venta) || 0
    if (!venta) continue
    data[slug] = { venta, costo: cobroDesdeVenta(venta, porcentaje) }
    n += 1
  }
  guardarJSON(KEY, data)
  return n
}

export function guardarPrecio(slug, venta, costo) {
  const data = leerGuardado()
  const actual = filaEfectiva(slug)
  data[slug] = {
    venta: Math.max(0, Number(venta) || 0),
    costo: costo == null ? actual.costo : Math.max(0, Number(costo) || 0),
  }
  guardarJSON(KEY, data)
  return precioDe(slug)
}

export function guardarPreciosLote(filas) {
  const data = leerGuardado()
  for (const fila of filas) {
    const actual = filaEfectiva(fila.slug)
    data[fila.slug] = {
      venta: fila.venta == null ? actual.venta : Math.max(0, Number(fila.venta) || 0),
      costo: fila.costo == null ? actual.costo : Math.max(0, Number(fila.costo) || 0),
    }
  }
  guardarJSON(KEY, data)
}

export function aumentarPrecios(slugs, porcentaje) {
  const factor = 1 + (Number(porcentaje) || 0) / 100
  const data = leerGuardado()
  for (const slug of slugs) {
    const actual = filaEfectiva(slug)
    data[slug] = {
      venta: actual.venta ? Math.round(Number(actual.venta) * factor) : 0,
      costo: actual.costo ? Math.round(Number(actual.costo) * factor) : Number(actual.costo) || 0,
    }
  }
  guardarJSON(KEY, data)
}

export function parsearCodigos(texto) {
  return [...new Set(String(texto || '')
    .split(/[\s,;]+/)
    .map((col) => col.trim())
    .filter(Boolean))]
}

export function parsearListadoPrecios(texto) {
  const filas = []
  for (const linea of texto.split(/\r?\n/)) {
    const raw = linea.trim()
    if (!raw || /^(codigo|código|precio)\b/i.test(raw)) continue
    const cols = raw.split(/[;,|\t]/).map((col) => col.trim())
    if (cols.length < 2) continue
    const num = (i) => Number(String(cols[i] || '').replace(',', '.')) || 0
    const esCodigo = /^[PLGplg]?\d+$/i.test(cols[0])
    if (!esCodigo) continue
    const segundaEsNumero = cols[1] !== '' && !Number.isNaN(Number(String(cols[1]).replace(',', '.')))
    if (segundaEsNumero) filas.push({ codigo: cols[0], venta: num(1) })
    else if (cols.length >= 3) filas.push({ codigo: cols[0], venta: num(2) })
  }
  return filas
}
