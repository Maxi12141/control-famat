import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const famatBuild = String(Date.now())

function versionFamat() {
  const publicar = (dir) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ build: famatBuild }))
    const sw = path.join(dir, 'sw.js')
    if (!fs.existsSync(sw)) return
    const texto = fs.readFileSync(sw, 'utf8').replaceAll('__FAMAT_BUILD__', famatBuild)
    fs.writeFileSync(sw, texto)
  }
  return {
    name: 'famat-version',
    config() {
      return { define: { __FAMAT_BUILD__: JSON.stringify(famatBuild) } }
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ build: famatBuild }))
      })
    },
    closeBundle() {
      publicar(path.resolve('dist'))
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), versionFamat()],
  server: {
    port: 5174,
    strictPort: false,
  },
})
