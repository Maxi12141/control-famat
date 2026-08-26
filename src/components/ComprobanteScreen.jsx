import { useEffect, useMemo, useState } from 'react'
import { IconClose, IconInvoice } from './icons.jsx'
import {
  IVA_CLIENTE,
  armarComprobante,
  descargarHtml,
  esCuentaCorriente,
  etiquetaTipoDoc,
  formatoNumero,
  guardarEmpresa,
  imprimirHtml,
  leerEmpresa,
  lineasDesdePedido,
  partesFecha,
  peekNumero,
  registrarEmision,
  totalLineas,
} from '../lib/comprobantes.js'
import { dinero, fechaHumana, hoyISO } from '../lib/format.js'
import { registrarCargo } from '../lib/cuentas.js'

function pedidoLabel(pedido) {
  if (!pedido) return ''
  const nombre = pedido.cliente?.trim() || 'Sin nombre'
  return `${nombre} · pedido ${pedido.id}`
}

export default function ComprobanteScreen({ pedidos, pedidoInicial, onCerrar }) {
  const [tipo, setTipo] = useState('factura')
  const [pedidoId, setPedidoId] = useState(() => (pedidoInicial ? String(pedidoInicial.id) : ''))
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [ivaCliente, setIvaCliente] = useState('cf')
  const [cuitCliente, setCuitCliente] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pago, setPago] = useState('')
  const [cobro, setCobro] = useState('pagado')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([])
  const [empresa, setEmpresa] = useState(() => leerEmpresa())
  const [mostrarEmpresa, setMostrarEmpresa] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  const pedido = useMemo(
    () => pedidos.find((item) => String(item.id) === String(pedidoId)) || null,
    [pedidos, pedidoId],
  )

  useEffect(() => {
    if (!pedido) {
      if (!pedidoId) {
        setCliente('')
        setTelefono('')
        setDomicilio('')
        setLocalidad('')
        setIvaCliente('cf')
        setCuitCliente('')
        setPago('')
        setNotas('')
        setLineas([])
      }
      return
    }
    setCliente(pedido.cliente || '')
    setTelefono(pedido.telefono || '')
    setPago(pedido.metodoPago || '')
    setCobro(/fiado|cta\.?\s*cte|cuenta/i.test(pedido.metodoPago || '') ? 'fiado' : 'pagado')
    setNotas(pedido.notas || '')
    setFecha(pedido.entrega && /^\d{4}-\d{2}-\d{2}/.test(pedido.entrega) ? pedido.entrega.slice(0, 10) : hoyISO())
    setLineas(lineasDesdePedido(pedido))
    setError('')
    setAviso('')
  }, [pedido, pedidoId])

  const total = totalLineas(lineas)
  const numeroVista = formatoNumero(empresa.puntoVenta, peekNumero(tipo))
  const sinPrecio = lineas.some((item) => !Number(item.precio))

  const docActual = () =>
    armarComprobante({
      tipo,
      pedido,
      cliente,
      telefono,
      domicilio,
      localidad,
      fecha,
      pago: cobro === 'fiado' ? (pago || 'Fiado') : pago,
      notas,
      lineas,
      empresa,
      ivaCliente,
      cuitCliente,
    })

  const emitir = (accion) => {
    setError('')
    setAviso('')
    if (!lineas.length) {
      setError('Elegí un pedido con ítems, o cargá al menos un producto.')
      return
    }
    guardarEmpresa(empresa)
    const doc = docActual()
    try {
      if (accion === 'imprimir') imprimirHtml(doc)
      else descargarHtml(doc)
      registrarEmision(doc)
      if (tipo === 'factura') {
        registrarCargo({
          cliente: doc.cliente,
          telefono: doc.telefono,
          pedidoId: doc.pedidoId,
          total: doc.total,
          modo: cobro,
          fecha,
          notas: doc.notas,
        })
      }
      setAviso(
        cobro === 'fiado'
          ? `${etiquetaTipoDoc(tipo)} ${doc.numero} lista. Quedó anotado que ${doc.cliente || 'el cliente'} debe ${dinero(doc.total)}.`
          : `${etiquetaTipoDoc(tipo)} ${doc.numero} lista. Quedó anotado que pagó ${dinero(doc.total)}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el documento.')
    }
  }

  const setLinea = (id, campo, valor) => {
    setLineas((lista) =>
      lista.map((item) => {
        if (item.id !== id) return item
        if (campo === 'cantidad') return { ...item, cantidad: Math.max(0, Number(String(valor).replace(',', '.')) || 0) }
        if (campo === 'precio') return { ...item, precio: Math.max(0, Number(String(valor).replace(',', '.')) || 0) }
        return item
      }),
    )
  }

  return (
    <div className="comp">
      <div className="comp__bar">
        <button type="button" className="prod-back" onClick={onCerrar}>
          ← Volver a pedidos
        </button>
        <button type="button" className="comp__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          <IconClose />
        </button>
      </div>
      <h1>Factura o remito</h1>
      <p className="dash-sub">Armalo desde un pedido, revisalo y después imprimilo o descargalo. Ya no hace falta hacerlo a mano.</p>

      <article className="panel">
        <p className="comp__label">Tipo de documento</p>
        <div className="comp__tipos">
          <button type="button" className={tipo === 'factura' ? 'is-on' : ''} onClick={() => setTipo('factura')}>
            <IconInvoice size={18} />
            Factura B
            <small>Modelo tipo B · con precios y total</small>
          </button>
          <button type="button" className={tipo === 'remito' ? 'is-on' : ''} onClick={() => setTipo('remito')}>
            <IconInvoice size={18} />
            Remito
            <small>Precio unitario por litros e importe</small>
          </button>
        </div>
        <p className="comp__nro">Próximo número: {numeroVista}</p>
      </article>

      <article className="panel">
        <label>
          Pedido
          <select value={pedidoId} onChange={(e) => setPedidoId(e.target.value)}>
            <option value="">Elegí un pedido…</option>
            {pedidos.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {pedidoLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <div className="comp__grid">
          <label>
            Cliente
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" />
          </label>
          <label>
            Teléfono
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="WhatsApp" />
          </label>
          <label>
            Dirección
            <input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} placeholder="Calle y número" />
          </label>
          <label>
            Localidad
            <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Ciudad o barrio" />
          </label>
          {tipo === 'factura' ? (
            <>
              <label>
                IVA del cliente
                <select value={ivaCliente} onChange={(e) => setIvaCliente(e.target.value)}>
                  {IVA_CLIENTE.map((op) => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>
              </label>
              <label>
                CUIT del cliente
                <input value={cuitCliente} onChange={(e) => setCuitCliente(e.target.value)} placeholder="Opcional" />
              </label>
            </>
          ) : null}
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label>
            Forma de pago
            <input value={pago} onChange={(e) => setPago(e.target.value)} placeholder="Efectivo, transferencia…" />
          </label>
          {tipo === 'factura' ? (
            <div className="comp__cobro">
              <p className="comp__label">¿Pagó o se lleva fiado?</p>
              <div className="comp__tipos">
                <button type="button" className={cobro === 'pagado' ? 'is-on' : ''} onClick={() => setCobro('pagado')}>
                  Pagó
                  <small>Dejó el dinero del precio</small>
                </button>
                <button type="button" className={cobro === 'fiado' ? 'is-on' : ''} onClick={() => setCobro('fiado')}>
                  Fiado
                  <small>Se lleva ahora y paga después</small>
                </button>
              </div>
            </div>
          ) : null}
          <label>
            Observaciones
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas del pedido" />
          </label>
        </div>
      </article>

      <article className="panel">
        <h2>Ítems</h2>
        {lineas.length === 0 ? (
          <p className="vacio">Elegí un pedido para cargar los productos.</p>
        ) : (
          <ul className="comp__items">
            {lineas.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.nombre}</strong>
                  <p>{item.codigo ? `${item.codigo} · ` : ''}{dinero(item.precio)} por litro</p>
                </div>
                <label>
                  Cant.
                  <input
                    className="precio-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.cantidad}
                    onChange={(e) => setLinea(item.id, 'cantidad', e.target.value)}
                  />
                </label>
                <label>
                  Precio unitario (por litros)
                  <input
                    className="precio-input"
                    type="number"
                    min="0"
                    step="1"
                    value={item.precio || ''}
                    onChange={(e) => setLinea(item.id, 'precio', e.target.value)}
                  />
                </label>
                <strong>{dinero(item.precio * item.cantidad)}</strong>
              </li>
            ))}
          </ul>
        )}
        {lineas.length > 0 ? <p className="total-caja">Total importe: {dinero(total)}</p> : null}
        {sinPrecio ? (
          <p className="pedido-error">Hay ítems sin precio. Completalos acá o cargalos en Productos.</p>
        ) : null}
      </article>

      <article className="panel">
        <button type="button" className="comp__toggle" onClick={() => setMostrarEmpresa((v) => !v)}>
          {mostrarEmpresa ? 'Ocultar datos de Famat' : 'Datos de Famat (CUIT, domicilio…)'}
        </button>
        {mostrarEmpresa ? (
          <div className="comp__grid">
            <label>
              Razón social
              <input value={empresa.razonSocial} onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })} />
            </label>
            <label>
              Rubro / matrícula
              <input value={empresa.rubro} onChange={(e) => setEmpresa({ ...empresa, rubro: e.target.value })} placeholder="Opcional" />
            </label>
            <label>
              CUIT
              <input value={empresa.cuit} onChange={(e) => setEmpresa({ ...empresa, cuit: e.target.value })} placeholder="XX-XXXXXXXX-X" />
            </label>
            <label>
              Ingresos brutos
              <input value={empresa.ingresosBrutos} onChange={(e) => setEmpresa({ ...empresa, ingresosBrutos: e.target.value })} />
            </label>
            <label>
              Inicio de actividades
              <input value={empresa.inicioActividades} onChange={(e) => setEmpresa({ ...empresa, inicioActividades: e.target.value })} placeholder="10/2014" />
            </label>
            <label>
              Domicilio
              <input value={empresa.domicilio} onChange={(e) => setEmpresa({ ...empresa, domicilio: e.target.value })} />
            </label>
            <label>
              Teléfono
              <input value={empresa.telefono} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} />
            </label>
            <label>
              E-mail
              <input value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} />
            </label>
            <label>
              Web
              <input value={empresa.web} onChange={(e) => setEmpresa({ ...empresa, web: e.target.value })} />
            </label>
            <label>
              Condición IVA
              <input value={empresa.condicionIva} onChange={(e) => setEmpresa({ ...empresa, condicionIva: e.target.value })} placeholder="IVA Responsable Inscripto" />
            </label>
            <label>
              Punto de venta
              <input value={empresa.puntoVenta} onChange={(e) => setEmpresa({ ...empresa, puntoVenta: e.target.value })} />
            </label>
          </div>
        ) : null}
      </article>

      <article className="panel comp__preview">
        <h2>Vista previa</h2>
        <div className={tipo === 'factura' ? 'comp__hoja comp__hoja--b' : 'comp__hoja'} aria-hidden="true">
          {tipo === 'factura' ? (
            <>
              <div className="fb-prev__head">
                <div>
                  <strong>{empresa.razonSocial || 'Famat'}</strong>
                  {empresa.rubro ? <p>{empresa.rubro}</p> : null}
                  {empresa.domicilio ? <p>{empresa.domicilio}</p> : null}
                  <p>{empresa.condicionIva || 'IVA Responsable Inscripto'}</p>
                </div>
                <div className="fb-prev__letra">
                  <b>B</b>
                  <small>Código Nº 06</small>
                </div>
                <div className="fb-prev__doc">
                  <span>FACTURA</span>
                  <strong>Nº {numeroVista.replace('-', ' - ')}</strong>
                  <p>FECHA {partesFecha(fecha).dia}/{partesFecha(fecha).mes}/{partesFecha(fecha).anio}</p>
                  <p>C.U.I.T. {empresa.cuit}</p>
                </div>
              </div>
              <p><b>Señor/es:</b> {cliente || '—'}</p>
              <p><b>Dirección:</b> {domicilio || '—'} · {localidad || '—'}</p>
              <p>
                IVA {IVA_CLIENTE.find((op) => op.id === ivaCliente)?.label || 'Cons. Final'}
                {cobro === 'fiado' || esCuentaCorriente(pago) ? ' · Fiado / Cta. Cte.' : ' · Pagó'}
              </p>
              <ul>
                {lineas.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <span>{item.cantidad} · {item.nombre}</span>
                    <span>{dinero(item.precio * item.cantidad)}</span>
                  </li>
                ))}
              </ul>
              {lineas.length > 6 ? <p className="vacio">+ {lineas.length - 6} ítems más</p> : null}
              <p className="comp__hoja-total">TOTAL $ {dinero(total)}</p>
            </>
          ) : (
            <>
              <div className="comp__hoja-top">
                <div>
                  <strong>{empresa.razonSocial || 'Famat'}</strong>
                  {empresa.cuit ? <p>CUIT {empresa.cuit}</p> : null}
                </div>
                <div className="comp__hoja-nro">
                  <span>{etiquetaTipoDoc(tipo)}</span>
                  <b>N° {numeroVista}</b>
                  <small>{fechaHumana(fecha)}</small>
                </div>
              </div>
              <p><b>Cliente:</b> {cliente || '—'}</p>
              <ul>
                {lineas.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <span>{item.cantidad} · {item.nombre}</span>
                    <span>{dinero(item.precio * item.cantidad)}</span>
                  </li>
                ))}
              </ul>
              {lineas.length > 6 ? <p className="vacio">+ {lineas.length - 6} ítems más</p> : null}
              <p className="comp__hoja-total">TOTAL $ {dinero(total)}</p>
            </>
          )}
        </div>
      </article>

      {error ? <p className="pedido-error">{error}</p> : null}
      {aviso ? <p className="ok-msg">{aviso}</p> : null}

      <div className="comp__acciones">
        <button type="button" className="dash-btn dash-btn--navy" onClick={() => emitir('imprimir')}>
          Imprimir
        </button>
        <button type="button" className="dash-btn dash-btn--plus-wide" onClick={() => emitir('descargar')}>
          Descargar
        </button>
      </div>
    </div>
  )
}
