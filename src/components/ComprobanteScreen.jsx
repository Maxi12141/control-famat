import { useEffect, useMemo, useRef, useState } from 'react'
import { IconClose, IconInvoice } from './icons.jsx'
import { buscarProductos, listarProductos } from '../lib/catalog.js'
import {
  IVA_CLIENTE,
  armarComprobante,
  descargarPdf,
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
import { dinero, etiquetaTipo, fechaHumana, hoyISO } from '../lib/format.js'
import { usePanel } from '../lib/panel.jsx'
import { precioCobroDe } from '../lib/precios.js'
import { registrarCargo } from '../lib/cuentas.js'

function pedidoLabel(pedido) {
  if (!pedido) return ''
  const nombre = pedido.cliente?.trim() || 'Sin nombre'
  return `${nombre} · pedido ${pedido.id}`
}

function lineaManual() {
  return {
    id: `l_${Math.random().toString(36).slice(2, 8)}`,
    slug: '',
    codigo: '',
    nombre: '',
    cantidad: '',
    unidad: '',
    tipo: '',
    precio: '',
  }
}

function renglonesVacios(n = 6) {
  return Array.from({ length: n }, lineaManual)
}

export default function ComprobanteScreen({ pedidos, pedidoInicial, onCerrar }) {
  const { verPrecios } = usePanel()
  const [tipo, setTipo] = useState('factura')
  const [pedidoId, setPedidoId] = useState('')
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [ivaCliente, setIvaCliente] = useState('cf')
  const [cuitCliente, setCuitCliente] = useState('')
  const [remitoNro, setRemitoNro] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pago, setPago] = useState('')
  const [cobro, setCobro] = useState('pagado')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState(() => renglonesVacios())
  const [empresa, setEmpresa] = useState(() => leerEmpresa())
  const [mostrarEmpresa, setMostrarEmpresa] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState('')
  const pedidoCargado = useRef('')

  const pedido = useMemo(
    () => (tipo === 'remito' ? pedidos.find((item) => String(item.id) === String(pedidoId)) || null : null),
    [pedidos, pedidoId, tipo],
  )

  const elegirTipo = (next) => {
    setTipo(next)
    setError('')
    setAviso('')
    pedidoCargado.current = ''
    if (next === 'factura') {
      setPedidoId('')
      setCliente('')
      setTelefono('')
      setDomicilio('')
      setLocalidad('')
      setIvaCliente('cf')
      setCuitCliente('')
      setRemitoNro('')
      setPago('')
      setCobro('pagado')
      setNotas('')
      setFecha(hoyISO())
      setLineas(renglonesVacios())
      return
    }
    setPedidoId(pedidoInicial ? String(pedidoInicial.id) : '')
    if (!pedidoInicial) setLineas([])
  }

  useEffect(() => {
    if (tipo !== 'remito') return
    if (!pedidoId) {
      pedidoCargado.current = ''
      setCliente('')
      setTelefono('')
      setDomicilio('')
      setLocalidad('')
      setPago('')
      setNotas('')
      setLineas([])
      return
    }
    if (!pedido || pedidoCargado.current === pedidoId) return
    pedidoCargado.current = pedidoId
    setCliente(pedido.cliente || '')
    setTelefono(pedido.telefono || '')
    setPago(pedido.metodoPago || '')
    setCobro(/fiado|cta\.?\s*cte|cuenta/i.test(pedido.metodoPago || '') ? 'fiado' : 'pagado')
    setNotas(pedido.notas || '')
    setFecha(pedido.entrega && /^\d{4}-\d{2}-\d{2}/.test(pedido.entrega) ? pedido.entrega.slice(0, 10) : hoyISO())
    setLineas(lineasDesdePedido(pedido))
    setError('')
    setAviso('')
  }, [pedido, pedidoId, tipo])

  const filasOk = lineas.filter((item) => String(item.nombre || '').trim() && Number(item.cantidad) > 0)
  const total = totalLineas(filasOk)
  const numeroVista = formatoNumero(empresa.puntoVenta, peekNumero(tipo))
  const sinPrecio = filasOk.some((item) => !Number(item.precio))

  const docActual = () =>
    armarComprobante({
      tipo,
      pedido: tipo === 'remito' ? pedido : null,
      cliente,
      telefono,
      domicilio,
      localidad,
      fecha,
      pago: cobro === 'fiado' ? (pago || 'Fiado') : pago,
      notas,
      lineas: filasOk,
      empresa,
      ivaCliente,
      cuitCliente,
      remitoNro,
    })

  const emitir = async (accion) => {
    if (ocupado) return
    setError('')
    setAviso('')
    if (tipo === 'remito' && !pedido) {
      setError('Elegí un pedido para armar el remito.')
      return
    }
    if (!filasOk.length) {
      setError(tipo === 'factura' ? 'Cargá al menos un artículo con cantidad.' : 'Elegí un pedido con objetos, o cargá al menos un producto.')
      return
    }
    if (tipo === 'factura' && !cliente.trim()) {
      setError('Poné el nombre del cliente (Señor/es).')
      return
    }
    guardarEmpresa(empresa)
    const doc = docActual()
    setOcupado(accion)
    try {
      if (accion === 'imprimir') imprimirHtml(doc)
      else await descargarPdf(doc)
      registrarEmision(doc)
      if (tipo === 'factura') {
        registrarCargo({
          cliente: doc.cliente,
          telefono: doc.telefono,
          pedidoId: '',
          total: doc.total,
          modo: cobro,
          fecha,
          notas: doc.notas,
          items: filasOk.map((item) => ({
            slug: item.slug,
            nombre: item.nombre,
            codigo: item.codigo,
            cantidad: item.cantidad,
            precio: item.precio,
            tipo: item.tipo,
          })),
        })
      }
      setAviso(
        cobro === 'fiado'
          ? `${etiquetaTipoDoc(tipo)} ${doc.numero} lista. Quedó anotado que ${doc.cliente || 'el cliente'} debe${verPrecios ? ` ${dinero(doc.total)}` : ''}.`
          : `${etiquetaTipoDoc(tipo)} ${doc.numero} lista. Quedó anotado que pagó${verPrecios ? ` ${dinero(doc.total)}` : ''}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el documento.')
    } finally {
      setOcupado('')
    }
  }

  const quitarObjeto = (id) => {
    setLineas((lista) => {
      const next = lista.filter((item) => item.id !== id)
      return tipo === 'factura' && next.length === 0 ? renglonesVacios(1) : next
    })
  }

  const etiquetaPrecio = (item) => {
    if (item.tipo === 'liquido' || item.unidad === 'L') return 'por litro'
    if (item.tipo === 'granel' || item.unidad === 'kg') return 'por kilo'
    return 'por unidad'
  }

  const setLinea = (id, campo, valor) => {
    setLineas((lista) =>
      lista.map((item) => {
        if (item.id !== id) return item
        if (campo === 'cantidad') return { ...item, cantidad: valor === '' ? '' : Math.max(0, Number(String(valor).replace(',', '.')) || 0) }
        if (campo === 'precio') return { ...item, precio: valor === '' ? '' : Math.max(0, Number(String(valor).replace(',', '.')) || 0) }
        if (campo === 'codigo') return { ...item, codigo: valor }
        if (campo === 'nombre') return { ...item, nombre: valor }
        return item
      }),
    )
  }

  const aplicarCodigo = (id, texto) => {
    const q = String(texto || '').trim()
    if (!q) return
    const hits = buscarProductos(q, listarProductos())
    const exactos = hits.filter((item) => item.codigo.toLowerCase() === q.toLowerCase())
    const prod = exactos[0] || (hits.length === 1 ? hits[0] : null)
    if (!prod) return
    setLineas((lista) =>
      lista.map((item) => (
        item.id === id
          ? {
              ...item,
              slug: prod.slug,
              codigo: prod.codigo,
              nombre: item.nombre || prod.nombre,
              tipo: prod.tipo || item.tipo,
              precio: item.precio === '' || item.precio == null ? (precioCobroDe(prod.slug) || '') : item.precio,
            }
          : item
      )),
    )
  }

  const ivaLabel = IVA_CLIENTE.find((op) => op.id === ivaCliente)?.label || 'Cons. Final'

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
      <p className="dash-sub">
        {tipo === 'factura'
          ? 'La Factura B la completa el jefe a mano: cliente, IVA, renglones, precios y total. No se carga desde un pedido.'
          : 'El remito se arma desde un pedido. Revisalo y después imprimilo o descargalo.'}
      </p>

      <article className="panel">
        <p className="comp__label">Tipo de documento</p>
        <div className="comp__tipos">
          <button type="button" className={tipo === 'factura' ? 'is-on' : ''} onClick={() => elegirTipo('factura')}>
            <IconInvoice size={18} />
            Factura B
            <small>Completá todos los datos a mano</small>
          </button>
          <button type="button" className={tipo === 'remito' ? 'is-on' : ''} onClick={() => elegirTipo('remito')}>
            <IconInvoice size={18} />
            Remito
            <small>Sale del pedido, con precios e importe</small>
          </button>
        </div>
        <p className="comp__nro">Próximo número: {numeroVista}</p>
      </article>

      <article className="panel">
        {tipo === 'remito' ? (
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
        ) : (
          <p className="comp__label">Datos de la factura</p>
        )}
        <div className="comp__grid">
          <label>
            {tipo === 'factura' ? 'Señor/es' : 'Cliente'}
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
              <label>
                Remito Nº
                <input value={remitoNro} onChange={(e) => setRemitoNro(e.target.value)} placeholder="Si hay remito, el número" />
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
                  <small>Contado</small>
                </button>
                <button type="button" className={cobro === 'fiado' ? 'is-on' : ''} onClick={() => setCobro('fiado')}>
                  Fiado
                  <small>Cta. Cte.</small>
                </button>
              </div>
            </div>
          ) : null}
          <label>
            Observaciones
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={tipo === 'factura' ? 'Notas de la factura' : 'Notas del pedido'} />
          </label>
        </div>
      </article>

      <article className="panel">
        <h2>{tipo === 'factura' ? 'Renglones de la factura' : 'Objetos'}</h2>
        {tipo === 'remito' && lineas.length === 0 ? (
          <p className="vacio">Elegí un pedido para cargar los productos.</p>
        ) : tipo === 'factura' ? (
          <>
            <div className="comp__renglones">
              <div className="comp__renglones-head">
                <span>Cód.</span>
                <span>Descripción</span>
                <span>Cant.</span>
                <span>P. unitario</span>
                <span>Importe</span>
                <span />
              </div>
              {lineas.map((item) => (
                <div className="comp__renglon" key={item.id}>
                  <label>
                    <span className="comp__renglon-lab">Cód.</span>
                    <input
                      value={item.codigo}
                      placeholder="Cód."
                      onChange={(e) => setLinea(item.id, 'codigo', e.target.value)}
                      onBlur={(e) => aplicarCodigo(item.id, e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="comp__renglon-lab">Descripción</span>
                    <input
                      value={item.nombre}
                      placeholder="Artículo"
                      onChange={(e) => setLinea(item.id, 'nombre', e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="comp__renglon-lab">Cant.</span>
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
                    <span className="comp__renglon-lab">P. unitario</span>
                    <input
                      className="precio-input"
                      type="number"
                      min="0"
                      step="1"
                      value={item.precio}
                      onChange={(e) => setLinea(item.id, 'precio', e.target.value)}
                    />
                  </label>
                  <strong className="comp__renglon-imp">
                    {Number(item.cantidad) && Number(item.precio) ? dinero(item.precio * item.cantidad) : '$'}
                  </strong>
                  <button type="button" className="comp__sacar" aria-label="Sacar renglón" onClick={() => quitarObjeto(item.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="dash-btn dash-btn--navy comp__agregar" onClick={() => setLineas((lista) => [...lista, lineaManual()])}>
              Agregar renglón
            </button>
          </>
        ) : (
          <ul className="comp__items">
            {lineas.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.nombre}</strong>
                  <p>
                    {[item.codigo, item.tipo ? etiquetaTipo(item.tipo) : ''].filter(Boolean).join(' · ')}
                    {verPrecios ? ` · ${dinero(item.precio)} ${etiquetaPrecio(item)}` : ''}
                  </p>
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
                {verPrecios ? (
                  <>
                    <label>
                      Precio unitario ({etiquetaPrecio(item)})
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
                  </>
                ) : null}
                <button type="button" className="comp__sacar" aria-label="Sacar objeto" onClick={() => quitarObjeto(item.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {filasOk.length > 0 && verPrecios ? <p className="total-caja">Total importe: {dinero(total)}</p> : null}
        {sinPrecio && verPrecios ? (
          <p className="pedido-error">Hay artículos sin precio. Completalos acá{tipo === 'remito' ? ' o cargalos en Productos' : ''}.</p>
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
                IVA {ivaLabel}
                {cuitCliente ? ` · CUIT ${cuitCliente}` : ''}
                {cobro === 'fiado' || esCuentaCorriente(pago) ? ' · Cta. Cte.' : ' · Contado'}
                {remitoNro ? ` · Remito Nº ${remitoNro}` : ''}
              </p>
              <ul>
                {filasOk.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <span>{item.cantidad} · {item.codigo ? `${item.codigo} — ` : ''}{item.nombre}</span>
                    <span>{dinero(item.precio * item.cantidad)}</span>
                  </li>
                ))}
              </ul>
              {filasOk.length > 8 ? <p className="vacio">+ {filasOk.length - 8} artículos más</p> : null}
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
                {filasOk.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <span>{item.cantidad} · {item.nombre}</span>
                    <span>{dinero(item.precio * item.cantidad)}</span>
                  </li>
                ))}
              </ul>
              {filasOk.length > 6 ? <p className="vacio">+ {filasOk.length - 6} objetos más</p> : null}
              <p className="comp__hoja-total">TOTAL $ {dinero(total)}</p>
            </>
          )}
        </div>
      </article>

      {error ? <p className="pedido-error">{error}</p> : null}
      {aviso ? <p className="ok-msg">{aviso}</p> : null}

      <div className="comp__acciones">
        <button type="button" className="dash-btn dash-btn--navy" disabled={Boolean(ocupado)} onClick={() => emitir('imprimir')}>
          Imprimir
        </button>
        <button type="button" className="dash-btn dash-btn--plus-wide" disabled={Boolean(ocupado)} onClick={() => emitir('descargar')}>
          {ocupado === 'descargar' ? 'Generando PDF…' : 'Descargar'}
        </button>
      </div>
    </div>
  )
}
