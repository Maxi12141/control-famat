import { aplicarSnapshot } from './storage.js'

const CLAVES = [
  'famat_cuentas',
  'famat_ventas',
  'famat_perdidas',
  'famat_precios',
  'famat_stock',
  'famat_stock_min',
  'famat_empresa',
]

function vacio(raw) {
  if (raw == null || raw === '' || raw === 'null' || raw === 'undefined') return true
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.length === 0
    if (v && typeof v === 'object') return Object.keys(v).length === 0
  } catch {
    return false
  }
  return false
}

function parseJsonPrefix(s) {
  if (s[0] !== '[' && s[0] !== '{') return null
  let depthSq = 0
  let depthCur = 0
  let inStr = false
  let esc = false
  const max = Math.min(s.length, 4_000_000)
  for (let i = 0; i < max; i += 1) {
    const c = s[i]
    if (inStr) {
      if (esc) {
        esc = false
        continue
      }
      if (c === '\\') {
        esc = true
        continue
      }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '[') depthSq += 1
    else if (c === ']') depthSq -= 1
    else if (c === '{') depthCur += 1
    else if (c === '}') depthCur -= 1
    if (i > 0 && depthSq === 0 && depthCur === 0) {
      try {
        return JSON.parse(s.slice(0, i + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

function extraerDesdeTexto(text, dest) {
  for (const name of CLAVES) {
    let pos = 0
    while (pos < text.length) {
      const i = text.indexOf(name, pos)
      if (i < 0) break
      pos = i + name.length
      const slice = text.slice(pos, pos + 80)
      const jsonAt = slice.search(/[\[{]/)
      if (jsonAt < 0 || jsonAt > 80) continue
      const parsed = parseJsonPrefix(text.slice(pos + jsonAt))
      if (parsed == null) continue
      const raw = JSON.stringify(parsed)
      if (vacio(raw)) continue
      const actual = dest[name]
      if (!actual || raw.length > String(actual).length) dest[name] = raw
    }
  }
}

function extraerDesdeBytes(bytes, dest) {
  extraerDesdeTexto(new TextDecoder('utf-8', { fatal: false }).decode(bytes), dest)
  extraerDesdeTexto(new TextDecoder('utf-16le', { fatal: false }).decode(bytes), dest)
}

function esJsonRespaldo(ruta) {
  const lower = ruta.toLowerCase()
  return lower.endsWith('.json') && (lower.includes('famat') || lower.includes('respaldo'))
}

function esLeveldb(ruta) {
  const lower = ruta.toLowerCase().replace(/\\/g, '/')
  if (!lower.includes('leveldb')) return false
  return /\/(log|current|manifest-[^/]*|[^/]+\.(log|ldb|sst))$/i.test(lower)
}

function mezclarJson(parsed, dest) {
  const datos = parsed?.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed
  if (!datos || typeof datos !== 'object') return
  for (const [key, value] of Object.entries(datos)) {
    if (!key.startsWith('famat_') || value == null || value === '') continue
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    if (vacio(raw)) continue
    if (!dest[key] || raw.length > String(dest[key]).length) dest[key] = raw
  }
}

export async function recuperarDesdeArchivos(files) {
  const dest = {}
  const lista = Array.from(files || [])
  for (const file of lista) {
    const ruta = file.webkitRelativePath || file.name
    if (file.size > 25_000_000) continue
    if (esJsonRespaldo(ruta)) {
      try {
        mezclarJson(JSON.parse(await file.text()), dest)
      } catch {
        /* ignore */
      }
      continue
    }
    if (!esLeveldb(ruta)) continue
    try {
      extraerDesdeBytes(new Uint8Array(await file.arrayBuffer()), dest)
    } catch {
      /* ignore */
    }
  }
  const n = aplicarSnapshot(dest, { soloVacios: true, fusionar: true })
  return { n, claves: Object.keys(dest).filter((key) => !vacio(dest[key])) }
}
