import { Component, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { prepararInstalacion } from './lib/instalar.js'
import { hidratarAlmacen } from './lib/storage.js'

const App = lazy(() => import('./App.jsx'))

function Crash({ error }) {
  const message = (error instanceof Error ? error.message : String(error)).replace(/[<>&]/g, '')
  return (
    <div className="crash">
      <p className="crash__eyebrow">Controlador Famat</p>
      <h1>Se cortó la pantalla</h1>
      <p>Recargá. Si sigue en blanco, avisá con este texto:</p>
      <pre>{message}</pre>
      <button type="button" onClick={() => location.reload()}>
        Recargar
      </button>
    </div>
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Famat UI', error, info.componentStack)
  }

  render() {
    if (this.state.error) return <Crash error={this.state.error} />
    return this.props.children
  }
}

function registrarAppInstalable() {
  if (!('serviceWorker' in navigator) || navigator.userAgent.includes('Electron')) return
  prepararInstalacion()
  let yaHabia = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!yaHabia) {
      yaHabia = true
      return
    }
    window.dispatchEvent(new CustomEvent('famat-cambios-nuevos', { detail: 'app' }))
  })
  const registrar = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      const avisar = () => {
        if (!reg.waiting) return
        if (!navigator.serviceWorker.controller) {
          reg.waiting.postMessage('actualizar')
          return
        }
        window.dispatchEvent(new CustomEvent('famat-cambios-nuevos', { detail: 'app' }))
      }
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', avisar)
      })
      avisar()
      window.setInterval(() => {
        reg.update().catch(() => {})
      }, 60000)
    }).catch((err) => {
      console.error('Error al registrar el Service Worker:', err)
    })
  }
  if (document.readyState === 'complete') registrar()
  else window.addEventListener('load', registrar)
}

async function boot() {
  registrarAppInstalable()
  await hidratarAlmacen()
  try {
    createRoot(document.getElementById('root')).render(
      <ErrorBoundary>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </ErrorBoundary>,
    )
  } catch (error) {
    console.error('Famat UI', error)
    document.getElementById('root').innerHTML = `
      <div class="crash">
        <p class="crash__eyebrow">Controlador Famat</p>
        <h1>Se cortó la pantalla</h1>
        <p>Recargá. Si sigue en blanco, avisá con este texto:</p>
        <pre>${(error instanceof Error ? error.message : String(error)).replace(/[<>&]/g, '')}</pre>
        <button type="button" onclick="location.reload()">Recargar</button>
      </div>
    `
  }

}

boot()
