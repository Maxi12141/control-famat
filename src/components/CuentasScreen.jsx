import { useMemo, useState } from 'react'
import { dinero, fechaHumana } from '../lib/format.js'
import { usePanel } from '../lib/panel.jsx'
import {
  actualizarDatosCliente,
  detalleObjetos,
  etiquetaModo,
  linkWhatsAppDeuda,
  movimientosDe,
  registrarCobro,
  resumenClientes,
  totalDeuda,
} from '../lib/cuentas.js'

function rekey(prev, from, to) {
  if (!(from in prev) || from === to) return prev
  const next = { ...prev }
  next[to] = next[from]
  delete next[from]
  return next
}

export default function CuentasScreen({ tick }) {
  const { verPrecios, esJefe } = usePanel()
  const [filtro, setFiltro] = useState('deben')
  const [abierto, setAbierto] = useState('')
  const [montos, setMontos] = useState({})
  const [datos, setDatos] = useState({})
  const [aviso, setAviso] = useState('')
  const [rev, setRev] = useState(0)
  const refresh = () => setRev((n) => n + 1)

  const clientes = useMemo(() => resumenClientes(), [tick, rev])
  const fiados = clientes.filter((row) => row.tieneFiado)
  const deben = fiados.filter((row) => row.debe > 0.5)
  const lista = filtro === 'deben' ? deben : fiados
  const deuda = totalDeuda()

  const draftDe = (row) => ({
    nombre: datos[row.cliente]?.nombre ?? row.cliente,
    telefono: datos[row.cliente]?.telefono ?? (row.telefono || ''),
  })

  const setDraft = (row, campo, valor) => {
    setDatos((prev) => ({
      ...prev,
      [row.cliente]: {
        nombre: campo === 'nombre' ? valor : (prev[row.cliente]?.nombre ?? row.cliente),
        telefono: campo === 'telefono' ? valor : (prev[row.cliente]?.telefono ?? (row.telefono || '')),
      },
    }))
  }

  const guardarDatos = (row) => {
    const draft = draftDe(row)
    const nombre = String(draft.nombre || '').trim()
    const telefono = String(draft.telefono || '').trim()
    if (!nombre) {
      setAviso('Poné el nombre del cliente.')
      return
    }
    const ok = actualizarDatosCliente({
      cliente: row.cliente,
      telefono,
      nuevoCliente: nombre !== row.cliente ? nombre : '',
    })
    if (!ok) {
      setAviso('No se pudieron guardar los datos.')
      return
    }
    setDatos((prev) => {
      const next = { ...prev }
      delete next[row.cliente]
      delete next[ok.cliente]
      return next
    })
    if (abierto === row.cliente) setAbierto(ok.cliente)
    setMontos((prev) => rekey(prev, row.cliente, ok.cliente))
    setAviso(
      telefono
        ? `Datos de ${ok.cliente} actualizados.`
        : `Datos de ${ok.cliente} actualizados. Cuando tengas el teléfono, cargalo acá para avisarle.`,
    )
    refresh()
  }

  const cobrar = (row) => {
    const raw = String(montos[row.cliente] ?? '').trim().replace(',', '.')
    const valor = Number(raw) || 0
    const tel = String(draftDe(row).telefono || row.telefono || '').trim()
    const ok = registrarCobro({ cliente: row.cliente, telefono: tel, monto: valor })
    if (!ok) {
      setAviso('Poné cuánto entregó ahora.')
      return
    }
    setMontos((prev) => {
      const next = { ...prev }
      delete next[row.cliente]
      return next
    })
    setAviso(`${row.cliente} pagó ${dinero(valor)} el ${fechaHumana(ok.fecha)}. ${valor >= row.debe - 0.5 ? 'Ya no debe: el cobro quedó en Importes.' : `Todavía debe ${dinero(Math.max(0, row.debe - valor))}.`}`)
    refresh()
  }

  return (
    <>
      <h1>Cuentas</h1>
      <p className="dash-sub">Tocá el nombre para ver qué compró cada uno, el día que fió y si volvió a deber. Si falta el teléfono, cargalo en la ficha para avisarle. Cuando pagan, el cobro pasa a Importes con el nombre y la fecha.</p>
      <div className="kpi-row">
        {verPrecios ? (
          <article className="kpi kpi--red">
            <span>Deben ahora</span>
            <strong>{dinero(deuda)}</strong>
          </article>
        ) : null}
        <article className="kpi kpi--ink">
          <span>Personas que deben</span>
          <strong>{deben.length}</strong>
        </article>
        <article className="kpi kpi--teal">
          <span>Fiados cargados</span>
          <strong>{fiados.length}</strong>
        </article>
      </div>
      <div className="filtro-tipos">
        <button type="button" className={filtro === 'deben' ? 'is-on' : ''} onClick={() => setFiltro('deben')}>
          Deben
        </button>
        <button type="button" className={filtro === 'todos' ? 'is-on' : ''} onClick={() => setFiltro('todos')}>
          Todos los fiados
        </button>
      </div>
      {aviso ? <p className="ok-msg">{aviso}</p> : null}
      {lista.length === 0 ? (
        <article className="panel">
          <p className="vacio">
            {filtro === 'deben'
              ? 'Nadie debe por ahora. Cuando alguien se lleve fiado, aparece acá con nombre y teléfono. Si no lo cargaron en Facturación, lo podés completar acá.'
              : 'Todavía no hay fiados anotados. Se cargan en Facturación o desde el pedido.'}
          </p>
        </article>
      ) : (
        lista.map((row) => {
          const key = row.cliente
          const abiertoEsta = abierto === key
          const movs = abiertoEsta ? movimientosDe(row.cliente) : []
          const wa = row.debe > 0.5 ? linkWhatsAppDeuda(row.cliente, row.telefono, row.debe) : ''
          const texto = montos[key] ?? '0'
          const entrega = Math.max(0, Number(String(texto).replace(',', '.')) || 0)
          const queda = Math.max(0, row.debe - entrega)
          const draft = draftDe(row)
          return (
            <article className="panel cuenta-card" key={key}>
              <button
                type="button"
                className="cuenta-top"
                onClick={() => setAbierto(abiertoEsta ? '' : key)}
              >
                <span className="cuenta-id">
                  <strong>{row.cliente}</strong>
                  <span className="cuenta-tel">{row.telefono || 'Sin teléfono'}</span>
                </span>
                {verPrecios ? (
                  <span className="cuenta-meta">
                    {row.fechaUltimoFiado ? (row.vecesFiado > 1 ? `Volvió a deber el ${fechaHumana(row.fechaUltimoFiado)}` : `Fió el ${fechaHumana(row.fechaUltimoFiado)}`) : ''}
                    {row.fechaUltimoFiado ? ' · ' : ''}
                    Vendió {dinero(row.vendido)} · cobrado {dinero(row.cobrado)}
                  </span>
                ) : (
                  row.fechaUltimoFiado ? (
                    <span className="cuenta-meta">
                      {row.vecesFiado > 1 ? `Volvió a deber el ${fechaHumana(row.fechaUltimoFiado)}` : `Fió el ${fechaHumana(row.fechaUltimoFiado)}`}
                    </span>
                  ) : null
                )}
                <span className={`pill ${row.debe > 0.5 ? 'pill--alert' : 'pill--ok'}`}>
                  {row.debe > 0.5 ? (verPrecios ? `Debe ${dinero(row.debe)}` : 'Debe') : 'Ya pagó el fiado'}
                </span>
              </button>
              <div className="cuenta-datos">
                <label>
                  Nombre
                  <input
                    value={draft.nombre}
                    onChange={(e) => setDraft(row, 'nombre', e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    type="tel"
                    value={draft.telefono}
                    onChange={(e) => setDraft(row, 'telefono', e.target.value)}
                    placeholder="Para avisarle si debe"
                  />
                </label>
                <button type="button" className="dash-btn dash-btn--navy" onClick={() => guardarDatos(row)}>
                  Guardar datos
                </button>
              </div>
              {row.debe > 0.5 ? (
                <div className="cuenta-acciones-row">
                  {wa ? (
                    <a className="pedido-wa" href={wa} target="_blank" rel="noopener noreferrer">
                      Avisar por WhatsApp
                    </a>
                  ) : (
                    <p className="vacio">Falta un teléfono válido para avisarle lo que debe.</p>
                  )}
                  {esJefe ? (
                    <>
                      <label className="cuenta-entrega">
                        Entregó ahora
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={texto}
                          placeholder="0"
                          onChange={(e) => setMontos((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </label>
                      {verPrecios ? (
                        <p className="cuenta-resta">Queda {dinero(queda)}</p>
                      ) : null}
                      <button type="button" className="dash-btn dash-btn--navy" onClick={() => cobrar(row)}>
                        Anotar cobro
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {abiertoEsta ? (
                <div className="cuenta-detalle">
                  {(row.compras || []).length ? (
                    <ul className="cuenta-compras">
                      {row.compras.map((compra) => (
                        <li key={compra.id}>
                          <span>
                            {fechaHumana(compra.fecha)} · Fió · {detalleObjetos(compra.items)}
                          </span>
                          <strong>{verPrecios ? dinero(compra.total) : ''}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="cuenta-movs">
                    {movs.length === 0 ? (
                      <li>Sin movimientos</li>
                    ) : (
                      movs.map((mov) => (
                        <li key={mov.id}>
                          <span>
                            {fechaHumana(mov.fecha)} · {mov.tipo === 'cobro' ? 'Pagó' : etiquetaModo(mov.modo)}
                            {mov.tipo === 'cargo' && mov.items?.length ? ` · ${detalleObjetos(mov.items)}` : ''}
                          </span>
                          <strong>{verPrecios ? dinero(mov.tipo === 'cobro' ? mov.monto : mov.total) : ''}</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </article>
          )
        })
      )}
    </>
  )
}
