import { lazy, Suspense, useState } from 'react'
import {
  borrarRol,
  guardarPinJefe,
  guardarRol,
  hayPinJefe,
  leerRol,
  soloPin,
  verificarPinJefe,
} from './lib/auth.js'

const DashboardApp = lazy(() => import('./DashboardApp.jsx'))

function PinGate({ onOk, onVolver }) {
  const esAlta = !hayPinJefe()
  const [pin, setPin] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  return (
    <div className="gate">
      <div className="gate__glow" aria-hidden="true" />
      <form
        className="gate__card gate__card--pin"
        onSubmit={async (event) => {
          event.preventDefault()
          setCargando(true)
          setError('')
          try {
            if (esAlta) await guardarPinJefe(pin, repetir)
            else await verificarPinJefe(pin)
            onOk()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo entrar.')
          } finally {
            setCargando(false)
          }
        }}
      >
        <p className="gate__eyebrow">Jefe</p>
        <h1 className="gate__title">{esAlta ? 'Creá tu PIN' : 'Ingresá el PIN'}</h1>
        <p className="gate__texto">
          {esAlta
            ? 'La primera vez, elegí un PIN de 4 a 8 números. Queda en este celular.'
            : 'Solo el jefe entra con PIN. El empleado entra sin este paso.'}
        </p>
        <label className="gate__label">
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete={esAlta ? 'new-password' : 'current-password'}
            value={pin}
            onChange={(event) => {
              setPin(soloPin(event.target.value))
              setError('')
            }}
            placeholder="4 a 8 números"
            autoFocus
          />
        </label>
        {esAlta ? (
          <label className="gate__label">
            Repetir PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={repetir}
              onChange={(event) => {
                setRepetir(soloPin(event.target.value))
                setError('')
              }}
              placeholder="Confirmá el PIN"
            />
          </label>
        ) : null}
        {error ? <p className="gate__error">{error}</p> : null}
        <button type="submit" className="gate__submit" disabled={cargando}>
          {cargando ? 'Entrando…' : esAlta ? 'Guardar PIN y entrar' : 'Entrar'}
        </button>
        <button type="button" className="gate__link" onClick={onVolver}>
          Volver a elegir rol
        </button>
      </form>
    </div>
  )
}

function RoleGate({ onElegir }) {
  return (
    <div className="gate">
      <div className="gate__glow" aria-hidden="true" />
      <div className="gate__card">
        <p className="gate__eyebrow">Controlador Famat</p>
        <h1 className="gate__title">¿Qué rol sos?</h1>
        <p className="gate__texto">Elegí cómo entrar al panel. El jefe usa PIN; el empleado entra directo.</p>
        <div className="gate__roles">
          <button type="button" className="gate__rol gate__rol--jefe" onClick={() => onElegir('jefe')}>
            <span className="gate__rol-kicker">Acceso con PIN</span>
            <strong>Jefe</strong>
            <span>Panel de gestión. Pide un PIN de 4 a 8 números</span>
          </button>
          <button type="button" className="gate__rol gate__rol--empleado" onClick={() => onElegir('empleado')}>
            <span className="gate__rol-kicker">Sin PIN</span>
            <strong>Empleado</strong>
            <span>Entrar al panel para stock, pedidos y el día a día</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function CargandoPanel() {
  return (
    <div className="gate">
      <div className="gate__glow" aria-hidden="true" />
      <div className="gate__card">
        <p className="gate__eyebrow">Controlador Famat</p>
        <h1 className="gate__title">Cargando…</h1>
        <p className="gate__texto">Preparando el panel.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [rol, setRol] = useState(() => leerRol())
  const [pedirPin, setPedirPin] = useState(false)

  if (pedirPin && rol !== 'jefe') {
    return (
      <PinGate
        onOk={() => {
          guardarRol('jefe')
          setPedirPin(false)
          setRol('jefe')
        }}
        onVolver={() => setPedirPin(false)}
      />
    )
  }

  if (rol) {
    return (
      <Suspense fallback={<CargandoPanel />}>
        <DashboardApp
          role={rol}
          onSalir={() => {
            borrarRol()
            setPedirPin(false)
            setRol(null)
          }}
        />
      </Suspense>
    )
  }

  return (
    <RoleGate
      onElegir={(siguiente) => {
        if (siguiente === 'jefe') {
          setPedirPin(true)
          return
        }
        guardarRol(siguiente)
        setRol(siguiente)
      }}
    />
  )
}
