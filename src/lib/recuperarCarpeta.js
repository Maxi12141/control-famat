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

function guardarSiMejor(dest, key, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (!key || vacio(raw)) return
  if (!dest[key] || raw.length > String(dest[key]).length) dest[key] = raw
}

function extraerPorIds(text, dest) {
  const marcas = [
    { needle: '{"id":"v_', key: 'famat_ventas' },
    { needle: '{"id":"p_', key: 'famat_perdidas' },
    { needle: '{"id":"c_', key: 'famat_cuentas' },
    { needle: '{"id":"b_', key: 'famat_cuentas' },
  ]
  for (const marca of marcas) {
    let pos = 0
    while (pos < text.length) {
      const i = text.indexOf(marca.needle, pos)
      if (i < 0) break
      pos = i + marca.needle.length
      let start = i
      while (start > 0 && text[start] !== '[') start -= 1
      if (text[start] !== '[') continue
      if (i - start > 400) continue
      const parsed = parseJsonPrefix(text.slice(start))
      if (Array.isArray(parsed) && parsed.length) guardarSiMejor(dest, marca.key, parsed)
    }
  }
}

function extraerDesdeTexto(text, dest) {
  extraerPorIds(text, dest)
  for (const name of CLAVES) {
    let pos = 0
    while (pos < text.length) {
      const i = text.indexOf(name, pos)
      if (i < 0) break
      pos = i + name.length
      const slice = text.slice(pos, pos + 2000)
      const jsonAt = slice.search(/[\[{]/)
      if (jsonAt < 0 || jsonAt > 2000) continue
      const parsed = parseJsonPrefix(text.slice(pos + jsonAt))
      if (parsed == null) continue
      guardarSiMejor(dest, name, parsed)
    }
  }
}

function extraerDesdeBytes(bytes, dest) {
  extraerDesdeTexto(new TextDecoder('utf-8', { fatal: false }).decode(bytes), dest)
  extraerDesdeTexto(new TextDecoder('utf-16le', { fatal: false }).decode(bytes), dest)
  extraerDesdeTexto(new TextDecoder('latin1').decode(bytes), dest)
}

function mezclarJson(parsed, dest) {
  const datos = parsed?.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed
  if (!datos || typeof datos !== 'object') return
  if (Array.isArray(datos)) {
    if (datos.some((row) => String(row?.id || '').startsWith('v_'))) guardarSiMejor(dest, 'famat_ventas', datos)
    if (datos.some((row) => String(row?.id || '').startsWith('p_'))) guardarSiMejor(dest, 'famat_perdidas', datos)
    if (datos.some((row) => String(row?.id || '').startsWith('c_') || String(row?.id || '').startsWith('b_'))) {
      guardarSiMejor(dest, 'famat_cuentas', datos)
    }
    return
  }
  for (const [key, value] of Object.entries(datos)) {
    if (!key.startsWith('famat_') || value == null || value === '') continue
    guardarSiMejor(dest, key, typeof value === 'string' ? value : JSON.stringify(value))
  }
}

function pareceUtil(file) {
  const ruta = (file.webkitRelativePath || file.name || '').toLowerCase()
  if (file.size <= 0 || file.size > 25_000_000) return false
  if (ruta.includes('cache') || ruta.includes('gpu') || ruta.includes('code cache')) return false
  return true
}

export async function recuperarDesdeArchivos(files) {
  const dest = {}
  const lista = Array.from(files || []).filter(pareceUtil)
  for (const file of lista) {
    const ruta = (file.webkitRelativePath || file.name || '').toLowerCase()
    try {
      if (ruta.endsWith('.json')) {
        try {
          mezclarJson(JSON.parse(await file.text()), dest)
        } catch {
          extraerDesdeBytes(new Uint8Array(await file.arrayBuffer()), dest)
        }
        continue
      }
      extraerDesdeBytes(new Uint8Array(await file.arrayBuffer()), dest)
    } catch {
      /* ignore */
    }
  }
  const n = aplicarSnapshot(dest, { soloVacios: true, fusionar: true })
  return {
    n,
    archivos: lista.length,
    claves: Object.keys(dest).filter((key) => !vacio(dest[key])),
  }
}
