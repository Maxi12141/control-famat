import { fechaCorta, hoyISO, nombreMes } from './format.js'
import { cantidadItem, itemsPedido, productoDeItemPedido, telefonoWa } from './pedidos.js'
import { precioCobroDe } from './precios.js'
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

function limpiarItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => ({
      slug: String(item?.slug || ''),
      nombre: String(item?.nombre || '').trim(),
      codigo: String(item?.codigo || ''),
      cantidad: Number(item?.cantidad) || 0,
      precio: Number(item?.precio) || 0,
      tipo: String(item?.tipo || ''),
    }))
    .filter((item) => item.nombre && item.cantidad > 0)
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
    return acc + (precioCobroDe(slug) || 0) * (cantidadItem(item) || 0)
  }, 0)
}

export function itemsDePedido(pedido) {
  if (!pedido) return []
  return itemsPedido(pedido).map((item) => {
    const slug = productoDeItemPedido(item)
    return {
      slug,
      nombre: item.nombre,
      cantidad: cantidadItem(item) || 0,
      precio: precioCobroDe(slug) || 0,
      tipo: item.tipo || '',
    }
  }).filter((item) => item.nombre && item.cantidad > 0)
}

export function cargoDePedido(pedidoId) {
  if (pedidoId == null || pedidoId === '') return null
  return leerMovimientos().find((mov) => mov.tipo === 'cargo' && String(mov.pedidoId) === String(pedidoId)) || null
}

export function registrarCargo({ cliente, telefono, pedidoId, total, modo, fecha, notas, items }) {
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
    items: limpiarItems(items),
  }
  guardarMovimientos([row, ...leerMovimientos()].slice(0, 400))
  return row
}

export function registrarCobro({ cliente, telefono, monto, notas, fecha }) {
  const nombre = String(cliente || '').trim()
  const valor = Math.max(0, Number(monto) || 0)
  if (!nombre || valor <= 0) return null
  const row = {
    id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tipo: 'cobro',
    cliente: nombre,
    telefono: String(telefono || '').trim(),
    monto: valor,
    fecha: fecha || hoyISO(),
    notas: String(notas || '').trim(),
  }
  guardarMovimientos([row, ...leerMovimientos()].slice(0, 400))
  return row
}

export function actualizarDatosCliente({ cliente, telefono, nuevoCliente }) {
  const key = claveCliente(cliente)
  if (!key) return null
  const lista = leerMovimientos()
  const tel = telefono == null ? null : String(telefono).trim()
  const nombreNuevo = nuevoCliente == null ? '' : String(nuevoCliente).trim()
  if (nombreNuevo && !claveCliente(nombreNuevo)) return null
  let n = 0
  const next = lista.map((mov) => {
    if (claveCliente(mov.cliente) !== key) return mov
    n += 1
    return {
      ...mov,
      ...(tel != null ? { telefono: tel } : {}),
      ...(nombreNuevo ? { cliente: nombreNuevo } : {}),
    }
  })
  if (!n) return null
  guardarMovimientos(next)
  const movs = next.filter((mov) => claveCliente(mov.cliente) === claveCliente(nombreNuevo || cliente))
  const telFinal = tel != null ? tel : (movs.find((mov) => mov.telefono)?.telefono || '')
  return { cliente: nombreNuevo || String(cliente || '').trim(), telefono: telFinal, actualizados: n }
}

export function detalleObjetos(items) {
  const lista = limpiarItems(items)
  if (!lista.length) return 'fiado'
  return lista
    .map((item) => {
      const cant = Number(item.cantidad) || 0
      return cant && cant !== 1 ? `${item.nombre} x${cant}` : item.nombre
    })
    .join(', ')
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
      compras: [],
      fechaPrimerFiado: '',
      fechaUltimoFiado: '',
      vecesFiado: 0,
    }
    if (mov.telefono) row.telefono = mov.telefono
    if (mov.tipo === 'cargo') {
      row.vendido += Number(mov.total) || 0
      if (mov.modo === 'pagado') row.cobrado += Number(mov.total) || 0
      else {
        row.debe += Number(mov.total) || 0
        row.tieneFiado = true
        row.vecesFiado += 1
        if (!row.fechaPrimerFiado) row.fechaPrimerFiado = mov.fecha
        row.fechaUltimoFiado = mov.fecha
        row.compras.push({
          id: mov.id,
          fecha: mov.fecha,
          total: Number(mov.total) || 0,
          items: limpiarItems(mov.items),
          notas: mov.notas || '',
        })
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

export function cargosPendientesDe(cliente) {
  const movs = [...movimientosDe(cliente)].reverse()
  const cargos = []
  let cobros = 0
  for (const mov of movs) {
    if (mov.tipo === 'cobro') cobros += Number(mov.monto) || 0
    else if (mov.tipo === 'cargo' && mov.modo === 'fiado') {
      cargos.push({
        ...mov,
        items: limpiarItems(mov.items),
        pendiente: Number(mov.total) || 0,
      })
    }
  }
  for (const cargo of cargos) {
    if (cobros <= 0) break
    const usa = Math.min(cargo.pendiente, cobros)
    cargo.pendiente -= usa
    cobros -= usa
  }
  return cargos.filter((cargo) => cargo.pendiente > 0.5)
}

export function textoWhatsAppDeuda(cliente, debe) {
  const pendientes = cargosPendientesDe(cliente)
  const ref = pendientes[pendientes.length - 1]?.fecha || hoyISO()
  const mes = nombreMes(ref)
  const lineas = pendientes.length
    ? pendientes.map((cargo) => `${fechaCorta(cargo.fecha)} $ ${Math.round(cargo.pendiente)} ${detalleObjetos(cargo.items)}`)
    : [`${fechaCorta(hoyISO())} $ ${Math.round(Number(debe) || 0)} fiado`]
  const total = Math.round(pendientes.reduce((acc, cargo) => acc + cargo.pendiente, 0) || Number(debe) || 0)
  return [
    'Hola buen dia!!!',
    `Su saldo del mes de ${mes} es de`,
    ...lineas,
    `Total $ ${total}`,
    'Muchas gracias!!!',
    'Famat Artículos de Limpieza',
  ].join('\n')
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
  const texto = textoWhatsAppDeuda(cliente, debe)
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
}
