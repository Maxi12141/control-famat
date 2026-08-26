import { dinero, hoyISO } from './format.js'
import { cantidadItem, itemsPedido, productoDeItemPedido, telefonoWa } from './pedidos.js'
import { precioDe } from './precios.js'
import { guardarJSON, leerJSON } from './storage.js'

const KEY = 'famat_cuentas'

function leerMovimientos() {
  const data = leerJSON(KEY, [])
  return Array.isArray(data) ? data : []
}

function guardarMovimientos(lista) {
  guardarJSON(KEY, lista)
  return lista
}

export function claveCliente(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function totalPedido(pedido) {
  if (!pedido) return 0
  return itemsPedido(pedido).reduce((acc, item) => {
    const slug = productoDeItemPedido(item)
    return acc + (precioDe(slug).venta || 0) * (cantidadItem(item) || 0)
  }, 0)
}

export function cargoDePedido(pedidoId) {
  if (pedidoId == null || pedidoId === '') return null
  return leerMovimientos().find((mov) => mov.tipo === 'cargo' && String(mov.pedidoId) === String(pedidoId)) || null
}

export function registrarCargo({ cliente, telefono, pedidoId, total, modo, fecha, notas }) {
  const nombre = String(cliente || '').trim()
  const monto = Math.max(0, Number(total) || 0)
  if (!nombre || monto <= 0) return null
  const existente = pedidoId != null && pedidoId !== '' ? cargoDePedido(pedidoId) : null
  if (existente) return existente
  const row = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tipo: 'cargo',
    cliente: nombre,
    telefono: String(telefono || '').trim(),
    pedidoId: pedidoId != null && pedidoId !== '' ? String(pedidoId) : '',
    total: monto,
    modo: modo === 'fiado' ? 'fiado' : 'pagado',
    fecha: fecha || hoyISO(),
    notas: String(notas || '').trim(),
  }
  guardarMovimientos([row, ...leerMovimientos()].slice(0, 400))
  return row
}

export function registrarCobro({ cliente, telefono, monto, notas }) {
  const nombre = String(cliente || '').trim()
  const valor = Math.max(0, Number(monto) || 0)
  if (!nombre || valor <= 0) return null
  const row = {
    id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tipo: 'cobro',
    cliente: nombre,
    telefono: String(telefono || '').trim(),
    monto: valor,
    fecha: hoyISO(),
    notas: String(notas || '').trim(),
  }
  guardarMovimientos([row, ...leerMovimientos()].slice(0, 400))
  return row
}

export function resumenClientes() {
  const map = new Map()
  const crono = [...leerMovimientos()].reverse()
  for (const mov of crono) {
    const key = claveCliente(mov.cliente)
    if (!key) continue
    const row = map.get(key) || {
      cliente: mov.cliente,
      telefono: '',
      vendido: 0,
      cobrado: 0,
      debe: 0,
      tieneFiado: false,
    }
    if (mov.telefono) row.telefono = mov.telefono
    if (mov.tipo === 'cargo') {
      row.vendido += Number(mov.total) || 0
      if (mov.modo === 'pagado') row.cobrado += Number(mov.total) || 0
      else {
        row.debe += Number(mov.total) || 0
        row.tieneFiado = true
      }
    } else if (mov.tipo === 'cobro') {
      const pago = Number(mov.monto) || 0
      row.cobrado += pago
      row.debe = Math.max(0, row.debe - pago)
    }
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.debe - a.debe || a.cliente.localeCompare(b.cliente, 'es'))
}

export function movimientosDe(cliente) {
  const key = claveCliente(cliente)
  return leerMovimientos().filter((mov) => claveCliente(mov.cliente) === key)
}

export function resumenDe(cliente) {
  const key = claveCliente(cliente)
  return resumenClientes().find((row) => claveCliente(row.cliente) === key) || null
}

export function totalDeuda() {
  return resumenClientes().reduce((acc, row) => acc + row.debe, 0)
}

export function clientesConDeuda() {
  return resumenClientes().filter((row) => row.debe > 0.5)
}

export function clientesConFiado() {
  return resumenClientes().filter((row) => row.tieneFiado)
}

export function etiquetaModo(modo) {
  return modo === 'fiado' ? 'Fiado' : 'Pagó'
}

export function linkWhatsAppDeuda(cliente, telefono, debe) {
  const tel = telefonoWa(telefono)
  if (tel.length < 8) return ''
  const texto = `Hola ${cliente}, te escribimos de Famat. Quedás debiendo ${dinero(debe)}.`
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
}
