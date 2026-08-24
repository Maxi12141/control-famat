import { Component, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

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

async function boot() {
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Error al registrar el Service Worker:', err)
      })
    })
  }
}

boot()
