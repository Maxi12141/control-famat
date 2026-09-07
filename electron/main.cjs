const { app, BrowserWindow, nativeTheme, net, session, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const isDev = !app.isPackaged
const APP_HOST = 'control-famat.vercel.app'
const APP_URL = `https://${APP_HOST}`
nativeTheme.themeSource = 'light'

function distDir() {
  return path.join(__dirname, '..', 'dist')
}

function archivoDist(pathname) {
  const dist = distDir()
  const limpio = decodeURIComponent(String(pathname || '/').split('?')[0].split('#')[0])
  const rel = limpio === '/' || limpio === '' ? 'index.html' : limpio.replace(/^\/+/, '')
  const file = path.normalize(path.join(dist, rel))
  const dentro = path.relative(dist, file)
  if (dentro.startsWith('..') || path.isAbsolute(dentro)) return path.join(dist, 'index.html')
  try {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  } catch {
    /* ignore */
  }
  return path.join(dist, 'index.html')
}

function servirAppLocal() {
  session.defaultSession.protocol.handle('https', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== APP_HOST) {
      return net.fetch(request, { bypassCustomProtocolHandlers: true })
    }
    if (url.pathname === '/sw.js') {
      return new Response('', { status: 404, headers: { 'content-type': 'text/javascript' } })
    }
    return net.fetch(pathToFileURL(archivoDist(url.pathname)).toString())
  })
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(`
      (async () => {
        if (!navigator.serviceWorker) return
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
        if (window.caches) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      })()
    `).catch(() => {})
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5174')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  const localIndex = path.join(distDir(), 'index.html')
  let usoLocal = false
  win.webContents.on('did-fail-load', (_event, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || usoLocal || code === -3) return
    usoLocal = true
    win.loadFile(localIndex)
  })
  win.loadURL(APP_URL)
}

app.whenReady().then(() => {
  if (!isDev) servirAppLocal()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
