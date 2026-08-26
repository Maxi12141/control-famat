import { slugify } from './format.js'
import { buscarProductoPorNombre } from './catalog.js'
import { CLIENTE_CATALOGO, headersSupabase, SUPABASE_URL } from './supabase.js'
import { leerJSON } from './storage.js'

const KEYS_LOCAL = ['famat_pedidos', 'famat_pendientes']

export const ESTADOS_PEDIDO = [
  { id: 'en_preparacion', label: 'En preparación' },
  { id: 'listo', label: 'Listo' },
  { id: 'entregado', label: 'Entregado' },
]

export function esPedidoCatalogo(pedido) {
  return pedido.cliente === CLIENTE_CATALOGO || pedido.estado === 'catalogo' || pedido.notas === 'catalogo-famat'
}

function asArray(valor) {
  return Array.isArray(valor) ? valor : []
}

export function normalizarPedido(raw) {
  return {
    id: raw.id ?? Date.now(),
    cliente: String(raw.cliente || ''),
    telefono: String(raw.telefono || ''),
    productos: asArray(raw.productos),
    liquidos: asArray(raw.liquidos),
    granel: asArray(raw.granel),
    entrega: String(raw.fecha_entrega || raw.entrega || ''),
    metodoPago: String(raw.metodo_pago || raw.metodoPago || ''),
    notas: String(raw.notas || ''),
    fechaCreacion: String(raw.fecha_creacion || raw.fechaCreacion || ''),
    estado: String(raw.estado || 'pendiente'),
  }
}

function leerPedidosLocal(key) {
  const raw = leerJSON(key, [])
  return Array.isArray(raw) ? raw.map(normalizarPedido) : []
}

function actualizarEstadoLocal(id, estado) {
  for (const key of KEYS_LOCAL) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const lista = JSON.parse(raw)
      if (!Array.isArray(lista)) continue
      let cambio = false
      const next = lista.map((item) => {
        if (String(item?.id) !== String(id)) return item
        cambio = true
        return { ...item, estado }
      })
      if (cambio) localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
}

async function fetchPedidosRemotos() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?cliente=neq.${CLIENTE_CATALOGO}&select=*&order=id.desc`, {
      headers: headersSupabase(),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.map(normalizarPedido).filter((item) => !esPedidoCatalogo(item)) : []
  } catch {
    return []
  }
}

export function itemsPedido(pedido) {
  return [
    ...pedido.productos.map((item) => ({ ...item, tipo: item.tipo || 'producto' })),
    ...pedido.liquidos.map((item) => ({ ...item, tipo: item.tipo || 'liquido' })),
    ...pedido.granel.map((item) => ({ ...item, tipo: item.tipo || 'granel' })),
  ]
}

export function cantidadItem(item) {
  return Number(item.cantidad || item.litros || item.kilos || 0)
}

export function unidadItem(item) {
  if (item.tipo === 'liquido' || item.litros != null) return 'L'
  if (item.tipo === 'granel' || item.kilos != null) return 'kg'
  return 'u'
}

export function etiquetaEstado(estado) {
  if (estado === 'pendiente_confirmacion' || estado === 'pendiente') return 'Pendiente'
  if (estado === 'en_preparacion' || estado === 'preparacion') return 'En preparación'
  if (estado === 'listo') return 'Listo'
  if (estado === 'entregado') return 'Entregado'
  return estado || 'Pendiente'
}

export function claseEstado(estado) {
  const t = (estado || '').toLowerCase()
  if (t.includes('pendiente')) return 'pill--warn'
  if (t === 'en_preparacion' || t === 'preparacion') return 'pill--wait'
  if (t === 'listo') return 'pill--ready'
  if (t === 'entregado') return 'pill--ok'
  return 'pill--warn'
}

export function estaEntregado(estado) {
  return (estado || '').toLowerCase() === 'entregado'
}

export function estadoCanonico(estado) {
  const t = (estado || '').toLowerCase()
  if (t === 'en_preparacion' || t === 'preparacion') return 'en_preparacion'
  if (t === 'listo') return 'listo'
  if (t === 'entregado') return 'entregado'
  return ''
}

export function ordenarPedidos(a, b) {
  return String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
}

export async function guardarEstadoPedido(id, estado) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: headersSupabase({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ estado }),
    })
    if (res.ok) {
      actualizarEstadoLocal(id, estado)
      return { ok: true }
    }
    return { ok: false, error: 'No se pudo guardar el estado. Revisá la conexión e intentá de nuevo.' }
  } catch {
    return { ok: false, error: 'No se pudo guardar el estado. Revisá la conexión e intentá de nuevo.' }
  }
}

export function telefonoWa(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('54')) return digits
  if (digits.length === 10 || (digits.length === 11 && (digits.startsWith('9') || digits.startsWith('11')))) {
    return `54${digits}`
  }
  return digits
}

function mensajeWa(pedido) {
  const nombre = pedido.cliente.trim() || 'cliente'
  const estado = estadoCanonico(pedido.estado)
  if (estado === 'en_preparacion') return `Hola ${nombre}, tu pedido en Famat está en preparación.`
  if (estado === 'listo') return `Hola ${nombre}, tu pedido en Famat ya está listo.`
  if (estado === 'entregado') return `Hola ${nombre}, tu pedido en Famat fue entregado. ¡Gracias!`
  return `Hola ${nombre}, te escribimos de Famat por tu pedido.`
}

export function linkWhatsApp(pedido) {
  const tel = telefonoWa(pedido.telefono)
  if (tel.length < 8) return ''
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensajeWa(pedido))}`
}

export async function cargarPedidos() {
  const remotos = await fetchPedidosRemotos()
  const locales = [...leerPedidosLocal('famat_pedidos'), ...leerPedidosLocal('famat_pendientes')]
  const map = new Map()
  for (const pedido of [...locales, ...remotos]) {
    if (!esPedidoCatalogo(pedido)) map.set(String(pedido.id), pedido)
  }
  return [...map.values()].sort(ordenarPedidos)
}

export function slugDesdeNombrePedido(nombre) {
  return slugify(String(nombre || '').split(' - ')[0].trim())
}

export function productoDeItemPedido(item) {
  const encontrado = buscarProductoPorNombre(item.nombre)
  return item.slug || encontrado?.slug || slugDesdeNombrePedido(item.nombre)
}
