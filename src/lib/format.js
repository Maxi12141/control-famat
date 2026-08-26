export function slugify(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[°º]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

export function dinero(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0)
}

export function textoMonto(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return ''
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function hoyISO() {
  const fecha = new Date()
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

export function fechaHumana(valor) {
  const raw = String(valor || '').trim()
  if (!raw) return ''
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${anio}`
  }
  return raw
}

export function fechaCorta(valor) {
  const raw = String(valor || '').trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${Number(iso[3])}/${Number(iso[2])}`
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})/)
  if (dmy) return `${Number(dmy[1])}/${Number(dmy[2])}`
  return fechaHumana(valor)
}

export function nombreMes(valor) {
  const raw = String(valor || '').trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const mes = iso ? Number(iso[2]) : new Date().getMonth() + 1
  return (MESES[mes - 1] || '').toLowerCase()
}

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export function etiquetaTipo(tipo) {
  return tipo === 'liquido' ? 'Líquido' : tipo === 'granel' ? 'A granel' : 'Producto'
}

export function nombreLinea(linea) {
  return String(linea || '')
    .replace(/^LINEA\s+/i, '')
    .replace(/\s*\((LIQUIDO|GRANEL)\)\s*$/i, '')
    .trim()
}

export function cantidadMedia(valor) {
  const n = Math.round((Number(valor) || 0) * 2) / 2
  return Math.max(0.5, n)
}
