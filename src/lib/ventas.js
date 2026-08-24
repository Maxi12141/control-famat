import { hoyISO } from './format.js'
import { itemsPedido, cantidadItem, esPedidoCatalogo, productoDeItemPedido } from './pedidos.js'
import { precioDe } from './precios.js'
import { ajustarStock } from './stock.js'
import { guardarJSON, leerJSON } from './storage.js'

const KEY_APLICADOS = 'famat_stock_aplicados'
const KEY_BASELINE = 'famat_stock_baseline'
const KEY_VENTAS = 'famat_ventas'
const KEY_PERDIDAS = 'famat_perdidas'

function leerLista(key) {
  const data = leerJSON(key, [])
  return Array.isArray(data) ? data : []
}

export function leerVentas() {
  return leerLista(KEY_VENTAS)
}

export function leerPerdidas() {
  return leerLista(KEY_PERDIDAS)
}

function registrarVenta(venta) {
  const items = venta.items.map((item) => ({ ...item, precio: item.precio || precioDe(item.slug).venta }))
  const total = venta.total ?? items.reduce((acc, item) => acc + item.precio * item.cantidad, 0)
  const row = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fecha: venta.fecha || hoyISO(),
    origen: venta.origen,
    cliente: venta.cliente,
    items,
    total,
  }
  guardarJSON(KEY_VENTAS, [row, ...leerVentas()])
  return row
}

export function guardarVentaLocal(venta) {
  const row = registrarVenta(venta)
  for (const item of row.items) ajustarStock(item.slug, -item.cantidad)
  return row
}

export function registrarReposicion(item) {
  const costo = item.costo || precioDe(item.slug).costo
  const row = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fecha: item.fecha || hoyISO(),
    slug: item.slug,
    nombre: item.nombre,
    cantidad: item.cantidad,
    costo,
    total: item.total ?? costo * item.cantidad,
    proveedor: item.proveedor,
  }
  guardarJSON(KEY_PERDIDAS, [row, ...leerPerdidas()])
  ajustarStock(item.slug, item.cantidad)
  return row
}

function parseFecha(fecha) {
  const iso = fecha.includes('/') ? fecha.split('/').reverse().join('-') : fecha
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    const now = new Date()
    return { anio: now.getFullYear(), mes: now.getMonth() + 1 }
  }
  return { anio: date.getFullYear(), mes: date.getMonth() + 1 }
}

function agruparPorPeriodo(movimientos) {
  const meses = new Map()
  for (const mov of movimientos) {
    const { anio, mes } = parseFecha(mov.fecha)
    const key = `${anio}-${mes}`
    const row = meses.get(key) || { anio, mes, total: 0 }
    row.total += Number(mov.total) || 0
    meses.set(key, row)
  }
  const anios = new Map()
  for (const mes of meses.values()) {
    const row = anios.get(mes.anio) || { anio: mes.anio, total: 0, meses: [] }
    row.meses.push(mes)
    row.total += mes.total
    anios.set(mes.anio, row)
  }
  return [...anios.values()]
    .map((row) => ({ ...row, meses: row.meses.sort((a, b) => b.mes - a.mes) }))
    .sort((a, b) => b.anio - a.anio)
}

export function periodosVentas() {
  return agruparPorPeriodo(leerVentas())
}

export function periodosPerdidas() {
  return agruparPorPeriodo(leerPerdidas())
}

export function totalVentas() {
  return leerVentas().reduce((acc, item) => acc + item.total, 0)
}

export function totalPerdidas() {
  return leerPerdidas().reduce((acc, item) => acc + item.total, 0)
}

function idsAplicados() {
  const raw = leerJSON(KEY_APLICADOS, [])
  return new Set(Array.isArray(raw) ? raw.map(String) : [])
}

export function aplicarPedidosAlStock(pedidos) {
  const aplicados = idsAplicados()
  if (!localStorage.getItem(KEY_BASELINE)) {
    for (const pedido of pedidos) aplicados.add(String(pedido.id))
    guardarJSON(KEY_APLICADOS, [...aplicados])
    localStorage.setItem(KEY_BASELINE, '1')
    return
  }

  for (const pedido of pedidos) {
    const id = String(pedido.id)
    if (aplicados.has(id) || esPedidoCatalogo(pedido)) continue
    const items = itemsPedido(pedido)
      .map((item) => {
        const slug = productoDeItemPedido(item)
        return {
          slug,
          nombre: item.nombre,
          cantidad: cantidadItem(item) || 1,
          precio: precioDe(slug).venta,
        }
      })
      .filter((item) => item.slug && item.cantidad > 0)
    if (items.length) {
      registrarVenta({ fecha: hoyISO(), origen: 'web', cliente: pedido.cliente, items })
      for (const item of items) ajustarStock(item.slug, -item.cantidad)
    }
    aplicados.add(id)
  }
  guardarJSON(KEY_APLICADOS, [...aplicados])
}

export const PROVEEDORES = [
  { id: 'sima', nombre: 'Sima', tipo: 'web', url: 'https://pency.app/gruposimavm' },
  { id: 'uniblanc', nombre: 'Uniblanc', tipo: 'web', url: 'https://pedidos.uniblancsrl.com/#/' },
  {
    id: 'limplus',
    nombre: 'Limplus',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493533683320?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
  {
    id: 'garivo',
    nombre: 'Garivo',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493534179264?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
  {
    id: 'edden',
    nombre: 'Edden',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493534249624?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
  {
    id: 'mgm',
    nombre: 'MGM',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493534245678?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
  {
    id: 'jabon-maravilla',
    nombre: 'Jabón Maravilla',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493533680002?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
  {
    id: 'higia',
    nombre: 'Higia',
    tipo: 'whatsapp',
    url: 'https://wa.me/5493534066784?text=Hola%2C%20quiero%20consultar%20el%20cat%C3%A1logo%20para%20reposici%C3%B3n',
  },
]
