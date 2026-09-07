const fs = require('fs')
const path = require('path')

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

function extraerDesdeBuffer(buf, dest) {
  extraerDesdeTexto(buf.toString('utf8'), dest)
  extraerDesdeTexto(buf.toString('utf16le'), dest)
}

function leerJsonRespaldo(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const datos = parsed?.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed
    if (!datos || typeof datos !== 'object') return null
    const out = {}
    for (const key of Object.keys(datos)) {
      if (key.startsWith('famat_') && datos[key] != null && datos[key] !== '') out[key] = String(datos[key])
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

function escanearLeveldb(dir, dest) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (!/^(LOG|CURRENT|MANIFEST-.*|.*\.(log|ldb|sst))$/i.test(name)) continue
    const file = path.join(dir, name)
    let stat
    try {
      stat = fs.statSync(file)
    } catch {
      continue
    }
    if (!stat.isFile() || stat.size > 25_000_000) continue
    try {
      extraerDesdeBuffer(fs.readFileSync(file), dest)
    } catch {
      /* ignore */
    }
  }
}

function caminar(dir, dest, profundidad) {
  if (profundidad < 0) return
  let names = []
  try {
    names = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of names) {
    const full = path.join(dir, entry.name)
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase()
      if (lower.endsWith('.json') && (lower.includes('famat') || lower.includes('respaldo'))) {
        const datos = leerJsonRespaldo(full)
        if (datos) Object.assign(dest, datos)
      }
    } else if (entry.isDirectory()) {
      if (entry.name === 'leveldb' && /local storage/i.test(path.basename(dir))) {
        escanearLeveldb(full, dest)
      } else if (profundidad > 0 && !['node_modules', 'Cache', 'Code Cache', 'GPUCache'].includes(entry.name)) {
        caminar(full, dest, profundidad - 1)
      }
    }
  }
}

function parecePerfil(dir) {
  try {
    return fs.existsSync(path.join(dir, 'Local Storage', 'leveldb'))
      || fs.existsSync(path.join(dir, 'famat-respaldo.json'))
  } catch {
    return false
  }
}

function dirsJuntoAlExe() {
  const out = []
  if (process.env.PORTABLE_EXECUTABLE_DIR) out.push(process.env.PORTABLE_EXECUTABLE_DIR)
  if (process.env.PORTABLE_EXECUTABLE_FILE) out.push(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE))
  try {
    out.push(path.dirname(process.execPath))
  } catch {
    /* ignore */
  }
  return [...new Set(out.filter(Boolean))]
}

function perfilesJuntoAlExe() {
  const perfiles = []
  for (const root of dirsJuntoAlExe()) {
    if (parecePerfil(root)) perfiles.push(root)
    let names = []
    try {
      names = fs.readdirSync(root)
    } catch {
      continue
    }
    for (const name of names) {
      const full = path.join(root, name)
      if (parecePerfil(full)) perfiles.push(full)
      let inner = []
      try {
        inner = fs.readdirSync(full)
      } catch {
        continue
      }
      for (const child of inner) {
        const nested = path.join(full, child)
        if (parecePerfil(nested)) perfiles.push(nested)
      }
    }
  }
  return [...new Set(perfiles)]
}

function carpetasCandidatas(app, amplio) {
  const appData = app.getPath('appData')
  const userData = app.getPath('userData')
  const home = app.getPath('home')
  const base = [
    userData,
    path.join(appData, 'Control Famat'),
    path.join(appData, 'control-famat'),
    path.join(appData, 'ControlFamat'),
    ...dirsJuntoAlExe(),
    ...perfilesJuntoAlExe(),
  ]
  if (!amplio) return [...new Set(base)]
  return [...new Set([
    ...base,
    path.join(home, 'Desktop'),
    path.join(home, 'Escritorio'),
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
  ])]
}

function buscarDatosEnDisco(app, { amplio = false } = {}) {
  const dest = {}
  for (const dir of carpetasCandidatas(app, amplio)) {
    const juntoAlExe = dirsJuntoAlExe().some((root) => dir === root || dir.startsWith(`${root}${path.sep}`))
    const famat = /famat/i.test(dir) || dir === app.getPath('userData') || parecePerfil(dir) || juntoAlExe
    caminar(dir, dest, famat ? 4 : 1)
  }
  return dest
}

module.exports = { buscarDatosEnDisco, vacio }
