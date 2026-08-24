import { guardarJSON, leerJSON } from './storage.js'

const KEY = 'famat_stock'

function leer() {
  const data = leerJSON(KEY, {})
  return data && typeof data === 'object' ? data : {}
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

export function esAlerta(slug) {
  const n = stockDe(slug)
  return n > 0 && n <= 5
}

export function sinStock(slug) {
  return stockDe(slug) <= 0
}

export function conteoStock(slugs) {
  let normal = 0
  let alerta = 0
  let sin = 0
  for (const slug of slugs) {
    const n = stockDe(slug)
    if (n <= 0) sin += 1
    else if (n <= 5) alerta += 1
    else normal += 1
  }
  return { normal, alerta, sin }
}
