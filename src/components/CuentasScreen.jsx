import { useMemo, useState } from 'react'
import { dinero, fechaHumana } from '../lib/format.js'
import {
  etiquetaModo,
  movimientosDe,
  registrarCobro,
  resumenClientes,
  totalDeuda,
} from '../lib/cuentas.js'

export default function CuentasScreen({ tick }) {
  const [filtro, setFiltro] = useState('deben')
  const [abierto, setAbierto] = useState('')
  const [monto, setMonto] = useState('')
  const [aviso, setAviso] = useState('')
  const [rev, setRev] = useState(0)
  const refresh = () => setRev((n) => n + 1)

  const clientes = useMemo(() => resumenClientes(), [tick, rev])
  const deben = clientes.filter((row) => row.debe > 0.5)
  const lista = filtro === 'deben' ? deben : clientes
  const deuda = totalDeuda()

  const cobrar = (row) => {
    const valor = Number(String(monto).replace(',', '.')) || row.debe
    const ok = registrarCobro({ cliente: row.cliente, telefono: row.telefono, monto: valor })
    if (!ok) {
      setAviso('Ingresá un monto válido.')
      return
    }
    setMonto('')
    setAviso(`${row.cliente} pagó ${dinero(valor)}. ${valor >= row.debe - 0.5 ? 'Ya no debe.' : `Todavía debe ${dinero(Math.max(0, row.debe - valor))}.`}`)
    refresh()
  }

  return (
    <>
      <h1>Cuentas</h1>
      <p className="dash-sub">Acá ves quién pagó el precio, quién se llevó fiado y cuánto queda debiendo cuando vuelve.</p>
      <div className="kpi-row">
        <article className="kpi kpi--red">
          <span>Deben ahora</span>
          <strong>{dinero(deuda)}</strong>
        </article>
        <article className="kpi kpi--ink">
          <span>Clientes con fiado</span>
          <strong>{deben.length}</strong>
        </article>
        <article className="kpi kpi--teal">
          <span>Cuentas cargadas</span>
          <strong>{clientes.length}</strong>
        </article>
      </div>
      <div className="filtro-tipos">
        <button type="button" className={filtro === 'deben' ? 'is-on' : ''} onClick={() => setFiltro('deben')}>
          Deben
        </button>
        <button type="button" className={filtro === 'todos' ? 'is-on' : ''} onClick={() => setFiltro('todos')}>
          Todos
        </button>
      </div>
      {aviso ? <p className="ok-msg">{aviso}</p> : null}
      {lista.length === 0 ? (
        <article className="panel">
          <p className="vacio">
            {filtro === 'deben'
              ? 'Nadie debe por ahora. Cuando alguien se lleve fiado, aparece acá.'
              : 'Todavía no hay pagos ni fiados anotados. Se cargan al imprimir la factura o desde el pedido.'}
          </p>
        </article>
      ) : (
        lista.map((row) => {
          const key = row.cliente
          const abiertoEsta = abierto === key
          const movs = abiertoEsta ? movimientosDe(row.cliente) : []
          return (
            <article className="panel" key={key}>
              <button
                type="button"
                className="cuenta-top"
                onClick={() => setAbierto(abiertoEsta ? '' : key)}
              >
                <div>
                  <strong>{row.cliente}</strong>
                  <p>{row.telefono || 'sin teléfono'}</p>
                </div>
                <span className={`pill ${row.debe > 0.5 ? 'pill--alert' : 'pill--ok'}`}>
                  {row.debe > 0.5 ? `Debe ${dinero(row.debe)}` : 'Pagó bien'}
                </span>
              </button>
              <p className="cuenta-meta">
                Vendió {dinero(row.vendido)} · cobrado {dinero(row.cobrado)}
              </p>
              {row.debe > 0.5 ? (
                <div className="cuenta-cobro">
                  <label>
                    Cuando viene a pagar
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={abiertoEsta ? monto : ''}
                      onChange={(e) => {
                        setAbierto(key)
                        setMonto(e.target.value)
                      }}
                      placeholder={String(Math.round(row.debe))}
                    />
                  </label>
                  <button type="button" className="dash-btn dash-btn--navy" onClick={() => cobrar(row)}>
                    Anotar cobro
                  </button>
                </div>
              ) : null}
              {abiertoEsta ? (
                <ul className="cuenta-movs">
                  {movs.length === 0 ? (
                    <li>Sin movimientos</li>
                  ) : (
                    movs.map((mov) => (
                      <li key={mov.id}>
                        <span>
                          {fechaHumana(mov.fecha)} · {mov.tipo === 'cobro' ? 'Pagó' : etiquetaModo(mov.modo)}
                          {mov.pedidoId ? ` · pedido ${mov.pedidoId}` : ''}
                        </span>
                        <strong>{dinero(mov.tipo === 'cobro' ? mov.monto : mov.total)}</strong>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </article>
          )
        })
      )}
    </>
  )
}
