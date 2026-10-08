import { CATALOGO_LINEAS } from '../data/catalogSeed.js'
import { nombreLinea, slugify } from './format.js'
import { CLIENTE_CATALOGO, SUPABASE_ANON_KEY, SUPABASE_URL, fetchPedidos } from './supabase.js'
import { guardarJSON, leerJSON } from './storage.js'

const KEY_EXTRAS = 'famat_extras'
const KEY_FOTOS = 'famat_fotos'
const KEY_OCULTOS = 'famat_ocultos'
const KEY_CODIGOS = 'famat_codigos'
const KEY_REMOTO = 'famat_catalogo_remoto_id'

const lineas = CATALOGO_LINEAS.map((linea) => ({
  ...linea,
  items: linea.items.map((item) => ({ ...item })),
}))

const extrasAplicados = new Set()

function esExtraValido(item) {
  if (!item || typeof item !== 'object') return false
  return !!(item.nombre && item.slug && item.linea && item.tipo)
}

function leerExtras() {
  const extras = leerJSON(KEY_EXTRAS, [])
  return Array.isArray(extras) ? extras.filter(esExtraValido) : []
}

function guardarExtras(extras) {
  guardarJSON(KEY_EXTRAS, extras)
}

function urlFotoValida(foto) {
  return typeof foto === 'string' && /^https?:\/\//.test(foto)
}

function leerFotos() {
  const fotos = leerJSON(KEY_FOTOS, {})
  return fotos && typeof fotos === 'object' && !Array.isArray(fotos) ? fotos : {}
}

function compactarFotosLocales() {
  const fotos = leerFotos()
  let cambio = false
  for (const slug of Object.keys(fotos)) {
    if (urlFotoValida(fotos[slug])) continue
    delete fotos[slug]
    cambio = true
  }
  if (cambio) guardarJSON(KEY_FOTOS, fotos)
}

function leerOcultos() {
  const ocultos = leerJSON(KEY_OCULTOS, [])
  return Array.isArray(ocultos) ? ocultos.map(String).filter(Boolean) : []
}

function guardarOcultos(ocultos) {
  guardarJSON(KEY_OCULTOS, [...new Set(ocultos)])
}

function prefijoTipo(tipo) {
  return tipo === 'liquido' ? 'L' : tipo === 'granel' ? 'G' : 'P'
}

function normalizarCodigo(codigo) {
  return codigo.trim().toUpperCase().replace(/\s+/g, '')
}

function leerCodigos() {
  const codigos = leerJSON(KEY_CODIGOS, {})
  return codigos && typeof codigos === 'object' ? codigos : {}
}

function guardarCodigos(codigos, opts) {
  guardarJSON(KEY_CODIGOS, codigos, opts)
}

function asegurarCodigos(productos) {
  const codigos = leerCodigos()
  const usados = new Set(Object.values(codigos).map(normalizarCodigo).filter(Boolean))
  const siguiente = { P: 1, L: 1, G: 1 }

  for (const codigo of usados) {
    const match = codigo.match(/^([PLG])(\d+)$/)
    if (!match) continue
    const tipo = match[1]
    siguiente[tipo] = Math.max(siguiente[tipo], Number(match[2]) + 1)
  }

  let cambio = false
  for (const producto of productos) {
    if (codigos[producto.slug]) continue
    const letra = prefijoTipo(producto.tipo)
    let n = siguiente[letra]
    let codigo = `${letra}${String(n).padStart(3, '0')}`
    while (usados.has(codigo)) {
      n += 1
      codigo = `${letra}${String(n).padStart(3, '0')}`
    }
    codigos[producto.slug] = codigo
    usados.add(codigo)
    siguiente[letra] = n + 1
    cambio = true
  }

  if (cambio) guardarCodigos(codigos, { sinNube: true })
  return codigos
}

export function asignarCodigo(slug, codigo) {
  const limpio = normalizarCodigo(codigo)
  if (!limpio) throw new Error('Escribí un código.')
  const codigos = leerCodigos()
  if (Object.entries(codigos).find(([otro, valor]) => otro !== slug && normalizarCodigo(valor) === limpio)) {
    throw new Error('Ese código ya está en otro producto.')
  }
  codigos[slug] = limpio
  guardarCodigos(codigos)
  return limpio
}

const PEDIDOS_IMG_BASE = 'https://pedidosfamat.vercel.app/images/productos'

export function fotoProducto(slug) {
  const fotos = leerFotos()
  if (fotos[slug]) return fotos[slug]
  // Mismas fotos que la página de pedidos Famat
  return `/images/productos/${slug}.jpg?v=21`
}

/** Si la foto local no carga, usar la de pedidosfamat.vercel.app */
export function fotoProductoFallback(slug) {
  return `${PEDIDOS_IMG_BASE}/${slug}.jpg?v=21`
}

function guardarFoto(slug, dataUrl) {
  const fotos = leerFotos()
  fotos[slug] = dataUrl
  guardarJSON(KEY_FOTOS, fotos)
}

const BUCKET_FOTOS = 'productos'

function dataUrlABlob(dataUrl) {
  const coma = String(dataUrl || '').indexOf(',')
  if (coma < 0) throw new Error('No se pudo leer la imagen.')
  const bin = atob(dataUrl.slice(coma + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

function urlFotoPublica(slug, version) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_FOTOS}/${encodeURIComponent(slug)}.jpg?v=${version}`
}

function conLimite(ms, trabajo) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), ms)
  return Promise.resolve(trabajo(controller.signal)).finally(() => window.clearTimeout(timer))
}

async function subirFotoStorage(slug, dataUrl) {
  const version = Date.now()
  let res
  try {
    res = await conLimite(20000, (signal) => fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_FOTOS}/${encodeURIComponent(slug)}.jpg`, {
      method: 'POST',
      signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
        'cache-control': '60',
      },
      body: dataUrlABlob(dataUrl),
    }))
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('La imagen tardó demasiado. Podés seguir con otra, sin salir.')
    throw err
  }
  if (!res.ok) throw new Error('No se pudo subir la imagen a la web de pedidos.')
  const url = urlFotoPublica(slug, version)
  guardarFoto(slug, url)
  return url
}

async function borrarFotoStorage(slug) {
  try {
    await conLimite(12000, (signal) => fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_FOTOS}/${encodeURIComponent(slug)}.jpg`, {
      method: 'DELETE',
      signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }))
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Tardó demasiado en quitar la imagen. Podés seguir, sin salir.')
    throw err
  }
  const fotos = leerFotos()
  delete fotos[slug]
  guardarJSON(KEY_FOTOS, fotos)
}

export function fotoEsPersonalizada(slug) {
  return Boolean(leerFotos()[slug])
}

function fotosDesdeRemoto(extras, granel) {
  const fotos = {}
  for (const extra of extras) {
    if (extra?.slug && urlFotoValida(extra.foto)) fotos[extra.slug] = extra.foto
  }
  for (const item of Array.isArray(granel) ? granel : []) {
    if (!item || item.tipo !== 'foto' || !item.slug || !urlFotoValida(item.foto)) continue
    fotos[item.slug] = item.foto
  }
  return fotos
}

function fotosParaPublicar() {
  return Object.entries(leerFotos())
    .filter(([, url]) => urlFotoValida(url))
    .map(([slug, foto]) => ({ slug, foto, tipo: 'foto' }))
}

function estaOculto(slug) {
  return leerOcultos().includes(slug)
}

export function aplicarExtrasAlCatalogo() {
  if (extrasAplicados.size) {
    for (const linea of lineas) {
      linea.items = linea.items.filter((item) => !extrasAplicados.has(item.slug))
    }
    extrasAplicados.clear()
  }

  const ocultos = new Set(leerOcultos())
  for (const extra of leerExtras()) {
    if (ocultos.has(extra.slug)) continue
    let linea = lineas.find((item) => item.linea === extra.linea && item.tipo === extra.tipo)
    if (!linea) {
      linea = { linea: extra.linea, tipo: extra.tipo, items: [] }
      lineas.push(linea)
    }
    if (!linea.items.some((item) => item.slug === extra.slug)) {
      linea.items.push({ nombre: extra.nombre, slug: extra.slug })
    }
    extrasAplicados.add(extra.slug)
  }
}

function extrasParaPublicar() {
  const fotos = leerFotos()
  return leerExtras().map((item) => ({ ...item, foto: item.foto || fotos[item.slug] || '' }))
}

function aplicarCatalogoRemoto(extras, ocultos, id, granel) {
  guardarExtras(extras)
  guardarOcultos(ocultos)
  if (id != null) localStorage.setItem(KEY_REMOTO, String(id))
  guardarJSON(KEY_FOTOS, fotosDesdeRemoto(extras, granel))
  aplicarExtrasAlCatalogo()
}

let marcaPropia = ''

export async function marcaCatalogoRemoto() {
  const res = await fetchPedidos(
    `?cliente=eq.${CLIENTE_CATALOGO}&select=id,fecha_creacion&order=id.desc&limit=1`,
  )
  if (!res.ok) return ''
  const data = await res.json()
  const row = Array.isArray(data) ? data[0] : null
  if (!row?.id) return ''
  return `${row.id}|${row.fecha_creacion || ''}`
}

export function marcaCatalogoLocal() {
  return marcaPropia
}

export async function hidratarCatalogoRemoto() {
  compactarFotosLocales()
  try {
    const res = await fetchPedidos(
      `?cliente=eq.${CLIENTE_CATALOGO}&select=id,productos,liquidos,granel,estado&order=id.desc&limit=1`,
    )
    if (!res.ok) return
    const data = await res.json()
    const remoto = Array.isArray(data) ? data[0] : null
    if (!remoto) return
    aplicarCatalogoRemoto(
      Array.isArray(remoto.productos) ? remoto.productos.filter(esExtraValido) : [],
      Array.isArray(remoto.liquidos)
        ? remoto.liquidos
            .map((item) => {
              if (!item || typeof item !== 'object') return ''
              return String(item.slug || item.nombre || '')
            })
            .filter(Boolean)
        : [],
      remoto.id,
      remoto.granel,
    )
  } catch {
    aplicarExtrasAlCatalogo()
  }
}

let colaCatalogo = Promise.resolve()

function encolarCatalogo(trabajo) {
  const tarea = colaCatalogo.catch(() => {}).then(trabajo)
  colaCatalogo = tarea.then(() => {}, () => {})
  return tarea
}

async function publicarCatalogo() {
  return encolarCatalogo(() => publicarCatalogoAhora())
}

async function publicarCatalogoAhora() {
  const fecha = new Date().toISOString()
  const payload = {
    cliente: CLIENTE_CATALOGO,
    telefono: '',
    productos: extrasParaPublicar().map((item) => ({
      ...item,
      foto: urlFotoValida(item.foto) ? item.foto : '',
    })),
    liquidos: leerOcultos().map((slug) => ({ nombre: slug, tipo: 'oculto' })),
    granel: fotosParaPublicar(),
    fecha_entrega: '',
    metodo_pago: '',
    notas: 'catalogo-famat',
    estado: 'entregado',
    fecha_creacion: fecha,
  }

  let remotoId = ''
  try {
    const actual = await fetchPedidos(
      `?cliente=eq.${CLIENTE_CATALOGO}&select=id&order=id.desc&limit=1`,
    )
    if (actual.ok) {
      const filas = await actual.json()
      if (Array.isArray(filas) && filas[0]?.id != null) remotoId = String(filas[0].id)
    }
  } catch {
    remotoId = ''
  }
  try {
    if (!remotoId) remotoId = localStorage.getItem(KEY_REMOTO) || ''
    if (remotoId) localStorage.setItem(KEY_REMOTO, remotoId)
    if (remotoId) {
      const patch = await fetchPedidos(`?id=eq.${encodeURIComponent(remotoId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      })
      if (patch.ok) {
        marcaPropia = `${remotoId}|${fecha}`
        return
      }
    }

    const res = await fetchPedidos('', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('No se pudo publicar el catálogo en la web de pedidos.')
    const data = await res.json()
    const row = Array.isArray(data) ? data[0] : data
    if (row?.id != null) {
      localStorage.setItem(KEY_REMOTO, String(row.id))
      marcaPropia = `${row.id}|${fecha}`
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('La publicación tardó demasiado. Podés seguir con otra imagen, sin salir.')
    }
    throw err
  }
}

export async function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('La imagen tardó demasiado. Elegí otra, sin salir.'))
    }, 12000)
    const listo = () => window.clearTimeout(timer)
    image.onload = () => {
      listo()
      const scale = Math.min(1, 480 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) {
        reject(new Error('No se pudo leer la imagen.'))
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.68))
    }
    image.onerror = () => {
      listo()
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    image.src = url
  })
}

export async function crearProducto({ nombre, tipo, linea, lineaNueva, foto }) {
  const nombreLimpio = nombre.trim()
  if (!nombreLimpio) throw new Error('Escribí el nombre del producto.')
  const lineaFinal = (lineaNueva || linea).trim()
  if (!lineaFinal) throw new Error('Elegí o creá una línea.')
  const slug = slugify(nombreLimpio)
  const fotoUrl = foto ? await subirFotoStorage(slug, foto) : ''
  const extra = { nombre: nombreLimpio, slug, linea: lineaFinal, tipo, foto: fotoUrl }
  const extras = leerExtras().filter((item) => item.slug !== slug)
  extras.push(extra)
  guardarExtras(extras)
  guardarOcultos(leerOcultos().filter((item) => item !== slug))
  aplicarExtrasAlCatalogo()
  await publicarCatalogo()
  return extra
}

export async function cambiarFotoProducto(slug, foto) {
  const clave = String(slug || '').trim()
  if (!clave) throw new Error('Elegí un producto.')
  if (!foto) throw new Error('Elegí una imagen.')
  const url = await subirFotoStorage(clave, foto)
  guardarExtras(leerExtras().map((item) => (item.slug === clave ? { ...item, foto: url } : item)))
  aplicarExtrasAlCatalogo()
  await publicarCatalogo()
  return url
}

export async function quitarFotoProducto(slug) {
  const clave = String(slug || '').trim()
  if (!clave) throw new Error('Elegí un producto.')
  await borrarFotoStorage(clave)
  guardarExtras(leerExtras().map((item) => (item.slug === clave ? { ...item, foto: '' } : item)))
  aplicarExtrasAlCatalogo()
  await publicarCatalogo()
}

export async function borrarProducto(slug) {
  const eraExtra = leerExtras().some((item) => item.slug === slug)
  guardarExtras(leerExtras().filter((item) => item.slug !== slug))
  await borrarFotoStorage(slug)
  guardarOcultos(eraExtra ? leerOcultos().filter((item) => item !== slug) : [...leerOcultos(), slug])
  aplicarExtrasAlCatalogo()
  await publicarCatalogo()
}

export function listarLineas(tipo) {
  aplicarExtrasAlCatalogo()
  const set = new Set()
  for (const linea of lineas) {
    if (tipo && linea.tipo !== tipo) continue
    set.add(linea.linea)
  }
  return [...set].sort((a, b) => nombreLinea(a).localeCompare(nombreLinea(b), 'es'))
}

export function listarProductos() {
  aplicarExtrasAlCatalogo()
  const map = new Map()
  for (const linea of lineas) {
    for (const item of linea.items) {
      if (estaOculto(item.slug)) continue
      const key = item.nombre.trim().toLowerCase()
      if (map.has(key)) continue
      map.set(key, {
        nombre: item.nombre,
        slug: item.slug,
        linea: nombreLinea(linea.linea),
        tipo: linea.tipo,
        foto: fotoProducto(item.slug),
      })
    }
  }
  const productos = [...map.values()]
  const codigos = asegurarCodigos(productos)
  return productos
    .map((item) => ({ ...item, codigo: codigos[item.slug] || '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

export function buscarProductoPorNombre(nombre) {
  const crudo = String(nombre || '').split(' - ')[0].trim()
  if (!crudo) return null
  const key = crudo.toLowerCase()
  const slug = slugify(crudo)
  return listarProductos().find((item) => item.nombre.toLowerCase() === key || item.slug === slug) || null
}

export function buscarProductos(query, productos) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const exactos = productos.filter((item) => item.codigo.toLowerCase() === q)
  if (exactos.length) return exactos
  const compacto = q.replace(/^([plg])0+/, '$1')
  const porCodigo = productos.filter((item) => {
    const codigo = item.codigo.toLowerCase()
    return codigo.includes(q) || codigo.replace(/^([plg])0+/, '$1') === compacto
  })
  const porTexto = productos.filter(
    (item) => item.nombre.toLowerCase().includes(q) || item.linea.toLowerCase().includes(q),
  )
  const map = new Map()
  for (const item of [...porCodigo, ...porTexto]) map.set(item.slug, item)
  return [...map.values()]
}
