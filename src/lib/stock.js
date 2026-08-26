import { guardarJSON, leerJSON } from './storage.js'

const KEY = 'famat_stock'

function leer() {
  const data = leerJSON(KEY, {})
  return data && typeof data === 'object' ? data : {}
}

export function unidadDeTipo(tipo) {
  if (tipo === 'liquido') return 'L'
  if (tipo === 'granel') return 'kg'
  return 'u'
}

export function etiquetaUnidad(tipo) {
  if (tipo === 'liquido') return 'litros'
  if (tipo === 'granel') return 'kilos'
  return 'unidades'
}

export function pasoStock(tipo) {
  return tipo === 'producto' ? 1 : 0.5
}

export const UMBRAL = {
  producto: 5,
  liquido: 10,
  granel: 5,
}

export function umbralAlerta(tipo) {
  if (tipo === 'liquido') return UMBRAL.liquido
  if (tipo === 'granel') return UMBRAL.granel
  return UMBRAL.producto
}

export function formatoStock(cantidad, tipo) {
  const n = Number(cantidad) || 0
  const redondeado = Math.round(n * 10) / 10
  const txt = Number.isInteger(redondeado) ? String(redondeado) : String(redondeado).replace('.', ',')
  return `${txt} ${unidadDeTipo(tipo)}`
}

export function stockDe(slug) {
  const valor = leer()[slug]
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 12
}

export function setStock(slug, cantidad) {
  const data = leer()
  data[slug] = Math.max(0, Math.round(cantidad * 10) / 10)
  guardarJSON(KEY, data)
  return data[slug]
}

export function ajustarStock(slug, delta) {
  return setStock(slug, stockDe(slug) + delta)
}

export function esAlerta(slug, tipo) {
  const n = stockDe(slug)
  return n > 0 && n <= umbralAlerta(tipo)
}

export function sinStock(slug) {
  return stockDe(slug) <= 0
}

export function conteoStock(items) {
  let normal = 0
  let alerta = 0
  let sin = 0
  for (const item of items) {
    const slug = typeof item === 'string' ? item : item.slug
    const tipo = typeof item === 'string' ? 'producto' : item.tipo
    const n = stockDe(slug)
    if (n <= 0) sin += 1
    else if (n <= umbralAlerta(tipo)) alerta += 1
    else normal += 1
  }
  return { normal, alerta, sin }
}
