const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { buscarDatosEnDisco } = require('./recuperar.cjs')

const isDev = !app.isPackaged
const APP_URL = 'https://control-famat.vercel.app'
nativeTheme.themeSource = 'light'

if (!isDev) app.commandLine.appendSwitch('disable-http-cache')

const LISTAS_POR_ID = new Set([
  'famat_cuentas',
  'famat_ventas',
  'famat_perdidas',
  'famat_pedidos',
  'famat_pendientes',
  'famat_comprobantes',
])

const MAPAS = new Set([
  'famat_precios',
  'famat_stock',
  'famat_stock_min',
  'famat_fotos',
  'famat_codigos',
  'famat_empresa',
])

function archivoRespaldo() {
  return path.join(app.getPath('userData'), 'famat-respaldo.json')
}

function parseMaybe(raw, fallback) {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

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

function fusionarValor(key, actual, backup) {
  if (backup == null || backup === '') return actual
  if (LISTAS_POR_ID.has(key)) {
    const a = parseMaybe(actual, [])
    const b = parseMaybe(backup, [])
    if (!Array.isArray(b) || !b.length) return actual
    const lista = Array.isArray(a) ? a : []
    const ids = new Set(lista.map((item) => item && item.id).filter(Boolean))
    const extra = b.filter((item) => {
      if (item && item.id) return !ids.has(item.id)
      const raw = JSON.stringify(item)
      return !lista.some((row) => JSON.stringify(row) === raw)
    })
    if (!extra.length && lista.length) return actual
    return JSON.stringify([...extra, ...lista].slice(0, 800))
  }
  if (MAPAS.has(key)) {
    const a = parseMaybe(actual, {})
    const b = parseMaybe(backup, {})
    if (!b || typeof b !== 'object' || Array.isArray(b)) return actual
    const base = a && typeof a === 'object' && !Array.isArray(a) ? a : {}
    return JSON.stringify({ ...b, ...base })
  }
  if (vacio(actual)) return String(backup)
  return actual
}

function fusionarDatos(destino, fuente) {
  const out = { ...(destino || {}) }
  for (const [key, value] of Object.entries(fuente || {})) {
    if (!key.startsWith('famat_') || value == null || value === '') continue
    const next = fusionarValor(key, out[key], value)
    if (next != null && next !== '') out[key] = String(next)
  }
  return out
}

function tieneDatos(datos) {
  if (!datos || typeof datos !== 'object') return false
  return ['famat_cuentas', 'famat_precios', 'famat_ventas', 'famat_perdidas', 'famat_stock'].some((key) => !vacio(datos[key]))
}

function mismoMapa(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) {
    if (String((a || {})[key] ?? '') !== String((b || {})[key] ?? '')) return false
  }
  return true
}

function leerRespaldoDisco() {
  try {
    const raw = fs.readFileSync(archivoRespaldo(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed?.datos && typeof parsed.datos === 'object' ? parsed.datos : parsed
  } catch {
    return null
  }
}

function guardarRespaldoDisco(datos) {
  if (!tieneDatos(datos)) return
  try {
    fs.mkdirSync(path.dirname(archivoRespaldo()), { recursive: true })
    fs.writeFileSync(archivoRespaldo(), JSON.stringify({ fecha: new Date().toISOString(), datos }, null, 2))
  } catch {
    /* ignore */
  }
}

function scriptLeer() {
  return `(() => {
    const out = {}
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith('famat_')) out[k] = localStorage.getItem(k)
    }
    return out
  })()`
}

function scriptEscribir(datos) {
  return `(() => {
    const data = ${JSON.stringify(datos || {})}
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith('famat_') || v == null || v === '') continue
      localStorage.setItem(k, String(v))
    }
    return true
  })()`
}

async function leerDeArchivoLocal(localIndex) {
  const hidden = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  try {
    await hidden.loadFile(localIndex)
    return await hidden.webContents.executeJavaScript(scriptLeer())
  } catch {
    return {}
  } finally {
    hidden.destroy()
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Control Famat',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const localIndex = path.join(__dirname, '..', 'dist', 'index.html')
  let usoLocal = false
  win.webContents.on('did-fail-load', (_event, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || usoLocal || code === -3) return
    usoLocal = true
    win.loadFile(localIndex)
  })

  const persistir = async () => {
    try {
      const actual = await win.webContents.executeJavaScript(scriptLeer())
      guardarRespaldoDisco(actual)
    } catch {
      /* ignore */
    }
  }

  win.webContents.on('did-finish-load', async () => {
    try {
      const actual = await win.webContents.executeJavaScript(scriptLeer())
      const disco = leerRespaldoDisco() || {}
      const deArchivo = await leerDeArchivoLocal(localIndex)
      const dePc = buscarDatosEnDisco(app, { amplio: false })
      const merge = fusionarDatos(fusionarDatos(fusionarDatos(actual, disco), deArchivo), dePc)
      const cambio = !mismoMapa(merge, actual)
      if (cambio) {
        await win.webContents.executeJavaScript(scriptEscribir(merge))
        win.reload()
        return
      }
      guardarRespaldoDisco(merge)
    } catch {
      /* ignore */
    }
  })

  win.on('close', persistir)
  const timer = setInterval(persistir, 45000)
  win.on('closed', () => clearInterval(timer))

  win.loadURL(APP_URL)
}

ipcMain.handle('famat-info', () => ({
  carpeta: app.getPath('userData'),
  portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
}))

ipcMain.handle('famat-abrir-carpeta', async () => {
  const carpeta = app.getPath('userData')
  fs.mkdirSync(carpeta, { recursive: true })
  const error = await shell.openPath(carpeta)
  return { carpeta, error: error || '' }
})

ipcMain.handle('famat-buscar', () => buscarDatosEnDisco(app, { amplio: true }))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
