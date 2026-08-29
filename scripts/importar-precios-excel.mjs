import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { CATALOGO_LINEAS } from '../src/data/catalogSeed.js'
import { slugify } from '../src/lib/format.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const XLSX_PATH = 'C:/Users/Maxi/Downloads/FAMAT 30 julio 2026.xlsm'
const OUT = new URL('../src/data/preciosSeed.js', import.meta.url)

const ALIAS = {
  'alfombra bano shaggy liviana': 'alfombra-p-bano',
  'alfombra semicirculo exterior 37x57': 'alfombra-exterior-semicircular',
  'alfombra de goma ventosa 35x65': 'alfombra-de-goma-ventosa',
  'comeder chico': 'comedero-chico',
  'broches plastico rayita': 'broches-plasticos-rayita',
  'cabo extrensibles 1 5 mts': 'cabo-extrensibles-1-50-mts',
  'canasto para ropa cuadrado': 'canasto-p-ropa-cuadrado-con-tapa',
  'cesto debasura c pedal 13lts': 'cesto-de-basura-c-pedal-13lts',
  'desinfectante aerosol lysofrm': 'desinfectante-aerosol-lysoform',
  'desodorante rexona odorono 60gr': 'desodorante-en-crema-rexona-60gr',
  'franela naranja mt': 'franela',
  'pulverizador multiuso 750 cc': 'pulverizador-multiuso-750cc',
  'limpia vidrios 20cm': 'limpia-vidrios-esponjas-make-20cm',
  'limpia vidrios 30cm': 'limpia-vidrios-esponjas-make-30cm',
  'mopa algodon blanca gris mr trapo': 'mopa-algodon-blanca-gris-mt',
  'fosforo x220 buenos dias': 'fosforos-x220',
  'cepillolimpiainodoro c base': 'cepillo-limpia-inodoro-c-base-extralimp',
  'cabo p balde centrifugo todo completo mopa 1 45m': 'cabo-p-balde-centrifugo-porta-mopa-1-45m',
  'shaapoo p autos': 'shaapoo-p-autos',
  'doy pack limpia vidrio': 'doy-pack-limpia-vidrio',
}

function clave(s) {
  return slugify(s).replace(/-/g, ' ').trim()
}

function num(v) {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/[$\s.]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function redondear(v) {
  return Math.round(num(v) || 0)
}

function esEncabezado(nombre) {
  const n = String(nombre || '').trim()
  if (!n) return true
  return /^(linea|articulos|art[ií]culos|codigos|actualizado)/i.test(n)
}

function extraerFilas(ws, cols) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  const out = []
  for (const row of rows) {
    const nom = String(row[cols.nombre] || '').trim()
    if (esEncabezado(nom)) continue
    const ini = redondear(row[cols.lista])
    const pub = redondear(row[cols.publico]) || (ini ? Math.round(ini * 1.4) : 0)
    if (!ini && !pub) continue
    out.push({ nombre: nom, lista: ini, publico: pub || ini })
  }
  return out
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i += 1) dp[i][0] = i
  for (let j = 0; j <= n; j += 1) dp[0][j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

const catalogo = []
for (const linea of CATALOGO_LINEAS) {
  for (const item of linea.items) catalogo.push(item)
}

const bySlug = new Map(catalogo.map((item) => [item.slug, item]))
const byClave = new Map(catalogo.map((item) => [clave(item.nombre), item]))

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true, raw: true })
const filas = [
  ...extraerFilas(wb.Sheets.Articulos, { nombre: 1, lista: 2, publico: 5 }).map((f) => ({ ...f, hoja: 'Articulos' })),
  ...extraerFilas(wb.Sheets.Liquidos, { nombre: 1, lista: 3, publico: 5 }).map((f) => ({ ...f, hoja: 'Liquidos' })),
]

function matchExact(nombre) {
  const slug = slugify(nombre)
  const k = clave(nombre)
  if (bySlug.has(slug)) return bySlug.get(slug)
  if (byClave.has(k)) return byClave.get(k)
  if (ALIAS[k]) return bySlug.get(ALIAS[k]) || null
  return null
}

function matchTypos(nombre) {
  const slug = slugify(nombre)
  const hits = catalogo.filter((item) => {
    const d = levenshtein(slug, item.slug)
    return d > 0 && d <= 2 && Math.abs(slug.length - item.slug.length) <= 3
  })
  return hits.length === 1 ? hits[0] : null
}

function matchContiene(nombre, ocupados) {
  const slug = slugify(nombre)
  const hits = catalogo.filter((item) => {
    if (ocupados.has(item.slug)) return false
    return slug.startsWith(`${item.slug}-`) || item.slug.startsWith(`${slug}-`) || slug === item.slug
  })
  return hits.length === 1 ? hits[0] : null
}

const seed = {}
const ok = []
const miss = []
const ocupados = new Set()

function asignar(fila, item, how) {
  if (!item || ocupados.has(item.slug)) return false
  ocupados.add(item.slug)
  seed[item.slug] = { venta: fila.lista, costo: fila.publico }
  ok.push({ slug: item.slug, catalogo: item.nombre, excel: fila.nombre, how, lista: fila.lista, publico: fila.publico, hoja: fila.hoja })
  return true
}

for (const fila of filas) {
  const item = matchExact(fila.nombre)
  if (item) asignar(fila, item, 'exacto')
}
for (const fila of filas) {
  if (ok.some((r) => r.excel === fila.nombre && r.hoja === fila.hoja)) continue
  const item = matchTypos(fila.nombre)
  if (!asignar(fila, item, 'typo')) miss.push(fila)
}

const still = []
for (const fila of miss) {
  const item = matchContiene(fila.nombre, ocupados)
  if (!asignar(fila, item, 'contiene')) still.push(fila)
}

writeFileSync(OUT, `export const PRECIOS_SEED = ${JSON.stringify(seed, null, 2)}\n`)
console.log(JSON.stringify({
  excel: filas.length,
  catalogo: catalogo.length,
  matched: ok.length,
  unmatched: still.length,
  seedKeys: Object.keys(seed).length,
  how: ok.reduce((acc, r) => { acc[r.how] = (acc[r.how] || 0) + 1; return acc }, {}),
  unmatched: still.map((f) => `${f.hoja}: ${f.nombre} → lista ${f.lista} / público ${f.publico}`),
}, null, 2))
