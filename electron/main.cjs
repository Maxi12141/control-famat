const { app, BrowserWindow, nativeTheme, session, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const APP_URL = 'https://control-famat.vercel.app'
nativeTheme.themeSource = 'light'

if (!isDev) app.commandLine.appendSwitch('disable-http-cache')

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

  const localIndex = path.join(__dirname, '..', 'dist', 'index.html')
  let usoLocal = false
  win.webContents.on('did-fail-load', (_event, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || usoLocal || code === -3) return
    usoLocal = true
    win.loadFile(localIndex)
  })
  win.loadURL(`${APP_URL}/?nocache=${Date.now()}`)
}

app.whenReady().then(async () => {
  if (!isDev) {
    try { await session.defaultSession.clearCache() } catch { /* ignore */ }
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
