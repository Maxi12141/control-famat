import { guardarJSON, leerJSON } from './storage.js'

const KEY = 'famat_precios'

function leer() {
  const data = leerJSON(KEY, {})
  return data && typeof data === 'object' ? data : {}
}

export function precioDe(slug) {
  const row = leer()[slug]
  return { venta: Number(row?.venta) || 0, costo: Number(row?.costo) || 0 }
}

export function guardarPrecio(slug, venta, costo) {
  const data = leer()
  const actual = precioDe(slug)
  data[slug] = {
    venta: Math.max(0, Number(venta) || 0),
    costo: costo == null ? actual.costo : Math.max(0, Number(costo) || 0),
  }
  guardarJSON(KEY, data)
  return data[slug]
}

export function guardarPreciosLote(filas) {
  const data = leer()
  for (const fila of filas) {
    const actual = data[fila.slug] || { venta: 0, costo: 0 }
    data[fila.slug] = {
      venta: fila.venta == null ? Number(actual.venta) || 0 : Math.max(0, Number(fila.venta) || 0),
      costo: fila.costo == null ? Number(actual.costo) || 0 : Math.max(0, Number(fila.costo) || 0),
    }
  }
  guardarJSON(KEY, data)
}

export function aumentarPrecios(slugs, porcentaje) {
  const factor = 1 + (Number(porcentaje) || 0) / 100
  const data = leer()
  for (const slug of slugs) {
    const actual = data[slug] || { venta: 0, costo: 0 }
    data[slug] = {
      venta: actual.venta ? Math.round(Number(actual.venta) * factor) : 0,
      costo: actual.costo ? Math.round(Number(actual.costo) * factor) : Number(actual.costo) || 0,
    }
  }
  guardarJSON(KEY, data)
}

export function parsearListadoPrecios(texto) {
  const filas = []
  for (const linea of texto.split(/\r?\n/)) {
    const raw = linea.trim()
    if (!raw || /^(codigo|código)\b/i.test(raw)) continue
    const cols = raw.split(/[;,|\t]/).map((col) => col.trim())
    if (cols.length < 3) continue
    const num = (i) => Number(String(cols[i] || '').replace(',', '.')) || 0
    const esCodigo = /^[PLGplg]?\d+$/.test(cols[0])
    if (!esCodigo) continue
    const segundaEsNumero = cols[1] !== '' && !Number.isNaN(Number(String(cols[1]).replace(',', '.')))
    // Formato: codigo,venta,cobro
    if (segundaEsNumero) filas.push({ codigo: cols[0], venta: num(1), costo: num(2) })
    // Compat: codigo,nombre,venta,cobro
    else if (cols.length >= 4) filas.push({ codigo: cols[0], venta: num(2), costo: num(3) })
  }
  return filas
}
