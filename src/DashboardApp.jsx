import { useEffect, useMemo, useState } from 'react'
import ComprobanteScreen from './components/ComprobanteScreen.jsx'
import CuentasScreen from './components/CuentasScreen.jsx'
import {
  IconClose,
  IconHome,
  IconInvoice,
  IconMenu,
  IconMoney,
  IconOrders,
  IconProducts,
  IconReposicion,
  IconSettings,
  IconStock,
  IconTrash,
} from './components/icons.jsx'
import { guardarEmpresa, leerEmpresa } from './lib/comprobantes.js'
import { etiquetaRol, guardarNombre, guardarPinJefe, hayPinJefe, iniciales, leerNombre } from './lib/auth.js'
import {
  asignarCodigo,
  borrarProducto,
  buscarProductos,
  comprimirImagen,
  crearProducto,
  fotoProductoFallback,
  hidratarCatalogoRemoto,
  listarLineas,
  listarProductos,
} from './lib/catalog.js'

function onFotoError(event, slug) {
  const img = event.currentTarget
  const remoto = slug ? fotoProductoFallback(slug) : ''
  if (remoto && img.dataset.fallback !== '1') {
    img.dataset.fallback = '1'
    img.src = remoto
    return
  }
  img.src = '/images/placeholder.svg'
}
import { cantidadMedia, dinero, etiquetaTipo, MESES, nombreLinea } from './lib/format.js'
import {
  cargarPedidos,
  cantidadItem,
  claseEstado,
  esPedidoCatalogo,
  estaEntregado,
  estadoCanonico,
  ESTADOS_PEDIDO,
  etiquetaEstado,
  guardarEstadoPedido,
  itemsPedido,
  linkWhatsApp,
  ordenarPedidos,
  unidadItem,
} from './lib/pedidos.js'
import { aumentarPrecios, guardarPrecio, guardarPreciosLote, parsearListadoPrecios, precioDe } from './lib/precios.js'
import { ajustarStock, conteoStock, esAlerta, sinStock, stockDe } from './lib/stock.js'
import {
  aplicarPedidosAlStock,
  guardarVentaLocal,
  periodosPerdidas,
  periodosVentas,
  PROVEEDORES,
  registrarReposicion,
  totalPerdidas,
  totalVentas,
} from './lib/ventas.js'
import {
  cargoDePedido,
  clientesConDeuda,
  registrarCargo,
  resumenDe,
  totalDeuda,
  totalPedido,
} from './lib/cuentas.js'

const NAV = [
  { id: 'inicio', label: 'Inicio', icon: IconHome },
  { id: 'pedidos', label: 'Pedidos', icon: IconOrders },
  { id: 'stock', label: 'Stock', icon: IconStock },
  { id: 'productos', label: 'Productos', icon: IconProducts },
  { id: 'facturero', label: 'Facturero', icon: IconInvoice },
  { id: 'cuentas', label: 'Cuentas', icon: IconMoney },
  { id: 'reposicion', label: 'Reposición', icon: IconReposicion },
  { id: 'importes', label: 'Importes', icon: IconMoney },
  { id: 'perdidas', label: 'Pérdidas', icon: IconTrash },
  { id: 'ajustes', label: 'Ajustes', icon: IconSettings },
]

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: IconHome },
  { id: 'pedidos', label: 'Pedidos', icon: IconOrders },
  { id: 'facturero', label: 'Facturación', icon: IconInvoice },
  { id: 'reposicion', label: 'Reposición', icon: IconReposicion },
  { id: 'stock', label: 'Stock', icon: IconStock },
]

const NAV_MORE = NAV.filter((item) => ['productos', 'cuentas', 'importes', 'perdidas', 'ajustes'].includes(item.id))

const FILTROS_TIPO = [
  { id: '', label: 'Todos' },
  { id: 'producto', label: 'Productos' },
  { id: 'liquido', label: 'Líquidos' },
  { id: 'granel', label: 'A granel' },
]

function InicioView({ pedidos, pendientes, ultimos, productos, alerta, deuda, deudores, onCuentas }) {
  return (
    <>
      <h1>Panel Principal</h1>
      <div className="kpi-row">
        <article className="kpi kpi--teal">
          <span>Pedidos web</span>
          <strong>{pedidos.length}</strong>
        </article>
        <article className="kpi kpi--ink">
          <span>Pendientes</span>
          <strong>{pendientes.length}</strong>
        </article>
        <article className="kpi kpi--purple">
          <span>Productos</span>
          <strong>{productos}</strong>
        </article>
        <article className="kpi kpi--red">
          <span>Stock bajo</span>
          <strong>{alerta}</strong>
        </article>
      </div>
      <div className="dash-grid">
        <article className="panel">
          <h2>Últimos Pedidos</h2>
          {ultimos.length === 0 ? (
            <p className="vacio">Todavía no hay pedidos en Supabase.</p>
          ) : (
            ultimos.map((pedido) => (
              <div className="pedido-row" key={String(pedido.id)}>
                <div>
                  <strong>{pedido.cliente || 'Sin nombre'}</strong>
                  <p>
                    {itemsPedido(pedido).length} ítems · {pedido.entrega || 'sin fecha'}
                  </p>
                </div>
                <span>{pedido.metodoPago || '—'}</span>
                <span className={`pill ${claseEstado(pedido.estado)}`}>{etiquetaEstado(pedido.estado)}</span>
              </div>
            ))
          )}
        </article>
        <article className="panel">
          <h2>Hoy</h2>
          <p>
            Ganancia acumulada: <strong>{dinero(totalVentas())}</strong>
          </p>
          <p>
            Pérdidas por reposición: <strong>{dinero(totalPerdidas())}</strong>
          </p>
          <p>
            Clientes que deben: <strong>{dinero(deuda)}</strong>
          </p>
          {deudores.length > 0 ? (
            <button type="button" className="dash-btn dash-btn--navy" onClick={onCuentas}>
              Ver {deudores.length} cuenta{deudores.length === 1 ? '' : 's'} con fiado
            </button>
          ) : (
            <p className="vacio">Nadie debe por fiado.</p>
          )}
        </article>
      </div>
    </>
  )
}

function PedidoCard({ pedido, abierto, guardando, onToggle, onEstado, onDocumento, onCuentas }) {
  const [sinTel, setSinTel] = useState(false)
  const estado = estadoCanonico(pedido.estado)
  const items = itemsPedido(pedido)
  const wa = linkWhatsApp(pedido)

  return (
    <article className={`panel pedido-card${abierto ? ' is-open' : ''}`}>
      <div className="pedido-card__top">
        <button type="button" className="pedido-card__abrir" aria-expanded={abierto} onClick={onToggle}>
          <strong>{pedido.cliente || 'Sin nombre'}</strong>
          <p>
            {pedido.telefono || 'sin WhatsApp'} · {items.length} ítems · entrega {pedido.entrega || '—'}
          </p>
          <span className="pedido-card__hint">{abierto ? 'Ocultar detalle' : 'Ver detalle'}</span>
        </button>
        <span className={`pill ${claseEstado(pedido.estado)}`}>{etiquetaEstado(pedido.estado)}</span>
      </div>
      <div className="pedido-estados">
        {ESTADOS_PEDIDO.map((item) => (
          <button
            key={item.id}
            type="button"
            className={estado === item.id ? 'is-on' : ''}
            disabled={guardando}
            onClick={() => onEstado(pedido, item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {abierto ? (
        <div className="pedido-card__detalle">
          <p className="pedido-card__meta">
            Pago: {pedido.metodoPago || '—'}
            {pedido.notas ? ` · Notas: ${pedido.notas}` : ''}
          </p>
          {(() => {
            const cargo = cargoDePedido(pedido.id)
            const total = totalPedido(pedido)
            const tieneCliente = Boolean(String(pedido.cliente || '').trim())
            if (cargo) {
              const debe = resumenDe(pedido.cliente)?.debe || 0
              const pagoFiado = cargo.modo === 'fiado' && debe <= 0.5
              return (
                <p className={`cuenta-estado ${cargo.modo === 'fiado' && !pagoFiado ? 'is-deuda' : 'is-ok'}`}>
                  {cargo.modo === 'pagado'
                    ? `Pagó bien ${dinero(cargo.total)}`
                    : pagoFiado
                      ? `Se llevó fiado y después pagó ${dinero(cargo.total)}`
                      : `Fiado: todavía debe ${dinero(debe)}`}
                </p>
              )
            }
            return (
              <div className="cuenta-acciones">
                <p>Total según precio: <strong>{dinero(total)}</strong></p>
                <div className="pedido-estados">
                  <button
                    type="button"
                    disabled={!total || !tieneCliente}
                    onClick={() => {
                      registrarCargo({
                        cliente: pedido.cliente,
                        telefono: pedido.telefono,
                        pedidoId: pedido.id,
                        total,
                        modo: 'pagado',
                        fecha: pedido.entrega,
                      })
                      onCuentas?.()
                    }}
                  >
                    Pagó
                  </button>
                  <button
                    type="button"
                    disabled={!total || !tieneCliente}
                    onClick={() => {
                      registrarCargo({
                        cliente: pedido.cliente,
                        telefono: pedido.telefono,
                        pedidoId: pedido.id,
                        total,
                        modo: 'fiado',
                        fecha: pedido.entrega,
                      })
                      onCuentas?.()
                    }}
                  >
                    Se lleva fiado
                  </button>
                </div>
                {!tieneCliente ? <p className="vacio">Falta el nombre del cliente para anotar si pagó o quedó debiendo.</p> : null}
                {tieneCliente && !total ? <p className="vacio">Cargá el precio en Productos para anotar si pagó o quedó debiendo.</p> : null}
              </div>
            )
          })()}
          <ul className="pedido-items">
            {items.length === 0 ? (
              <li>
                <span>Sin ítems</span>
              </li>
            ) : (
              items.map((item, index) => (
                <li key={`${pedido.id}-${index}`}>
                  <span>{item.nombre}</span>
                  <strong>
                    {cantidadItem(item)} {unidadItem(item)}
                  </strong>
                </li>
              ))
            )}
          </ul>
          <div className="pedido-acciones">
            {wa ? (
              <a className="pedido-wa" href={wa} target="_blank" rel="noopener noreferrer">
                Enviar WhatsApp
              </a>
            ) : (
              <button type="button" className="pedido-wa" onClick={() => setSinTel(true)}>
                Enviar WhatsApp
              </button>
            )}
            <button type="button" className="pedido-doc" onClick={() => onDocumento(pedido)}>
              Factura o remito
            </button>
          </div>
          {sinTel ? (
            <p className="pedido-error">Este pedido no tiene un teléfono válido. Pedile el WhatsApp al cliente.</p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function PedidosView({ pedidos, onPedidos, onCuentas }) {
  const [abierto, setAbierto] = useState(null)
  const [verEntregados, setVerEntregados] = useState(false)
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')
  const [documento, setDocumento] = useState(null)
  const activos = useMemo(() => pedidos.filter((item) => !estaEntregado(item.estado)).sort(ordenarPedidos), [pedidos])
  const entregados = useMemo(() => pedidos.filter((item) => estaEntregado(item.estado)).sort(ordenarPedidos), [pedidos])

  const cambiarEstado = async (pedido, estado) => {
    if (esPedidoCatalogo(pedido) || pedido.estado === estado) return
    const id = String(pedido.id)
    const previo = pedido.estado
    setError('')
    setGuardando(id)
    onPedidos((lista) => lista.map((item) => (String(item.id) === id ? { ...item, estado } : item)))
    const res = await guardarEstadoPedido(pedido.id, estado)
    setGuardando(null)
    if (!res.ok) {
      onPedidos((lista) => lista.map((item) => (String(item.id) === id ? { ...item, estado: previo } : item)))
      setError(res.error)
    }
  }

  if (documento) {
    return (
      <ComprobanteScreen
        pedidos={pedidos}
        pedidoInicial={documento.pedido || null}
        onCerrar={() => {
          setDocumento(null)
          onCuentas?.()
        }}
      />
    )
  }

  return (
    <>
      <h1>Pedidos</h1>
      <p className="dash-sub">Activos primero (pendiente, en preparación y listo). Los entregados quedan archivados.</p>
      <div className="pedido-toolbar">
        <button type="button" className="dash-btn dash-btn--navy" onClick={() => setDocumento({})}>
          Factura o remito
        </button>
      </div>
      {error ? <p className="pedido-error">{error}</p> : null}
      {pedidos.length === 0 ? (
        <article className="panel">
          <p className="vacio">No hay pedidos en la base.</p>
        </article>
      ) : (
        <>
          {activos.length === 0 ? (
            <article className="panel">
              <p className="vacio">No hay pedidos activos. Los entregados están abajo.</p>
            </article>
          ) : (
            activos.map((pedido) => (
              <PedidoCard
                key={String(pedido.id)}
                pedido={pedido}
                abierto={abierto === String(pedido.id)}
                guardando={guardando === String(pedido.id)}
                onToggle={() => setAbierto((actual) => (actual === String(pedido.id) ? null : String(pedido.id)))}
                onEstado={cambiarEstado}
                onDocumento={(item) => setDocumento({ pedido: item })}
                onCuentas={onCuentas}
              />
            ))
          )}
          {entregados.length > 0 ? (
            <section className="pedido-archivados">
              <div className="pedido-archivados__bar">
                <button type="button" className="dash-btn dash-btn--navy" onClick={() => setVerEntregados((v) => !v)}>
                  {verEntregados ? 'Ocultar entregados' : `Ver entregados (${entregados.length})`}
                </button>
              </div>
              {verEntregados ? (
                <div className="pedido-archivados__lista">
                  <h2>Entregados</h2>
                  {entregados.map((pedido) => (
                    <PedidoCard
                      key={String(pedido.id)}
                      pedido={pedido}
                      abierto={abierto === String(pedido.id)}
                      guardando={guardando === String(pedido.id)}
                      onToggle={() => setAbierto((actual) => (actual === String(pedido.id) ? null : String(pedido.id)))}
                      onEstado={cambiarEstado}
                      onDocumento={(item) => setDocumento({ pedido: item })}
                      onCuentas={onCuentas}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </>
  )
}

function StockKpis({ conteo }) {
  return (
    <>
      <h1>Control de Stock</h1>
      <p className="dash-sub">Monitoreo y ajuste de inventario</p>
      <div className="stock-kpis">
        <article className="stock-kpi">
          <strong className="is-ok">{conteo.normal}</strong>
          <span>Normal</span>
        </article>
        <article className="stock-kpi">
          <strong className="is-alert">{conteo.alerta}</strong>
          <span>Alerta</span>
        </article>
        <article className="stock-kpi">
          <strong className="is-bad">{conteo.sin}</strong>
          <span>Sin stock</span>
        </article>
      </div>
    </>
  )
}

function StockView({ items, total, busqueda, onBusqueda, onCambio, conteo }) {
  return (
    <>
      <StockKpis conteo={conteo} />
      <input
        className="dash-search"
        type="search"
        placeholder="Buscar para ajustar stock…"
        value={busqueda}
        onChange={(event) => onBusqueda(event.target.value)}
      />
      <article className="panel">
        {items.map((item) => {
          const stock = stockDe(item.slug)
          return (
            <div className="stock-edit" key={item.slug}>
              <img src={item.foto} alt="" onError={(event) => onFotoError(event, item.slug)} />
              <div>
                <strong>{item.nombre}</strong>
                <p>
                  {item.codigo} · {item.linea}
                </p>
              </div>
              <div className="stock-edit__meta">
                <span className={`pill ${stock <= 0 ? 'pill--alert' : stock <= 5 ? 'pill--warn' : 'pill--ok'}`}>{stock}</span>
                <div className="stock-edit__btns">
                  <button type="button" onClick={() => { ajustarStock(item.slug, -1); onCambio() }}>−</button>
                  <button type="button" onClick={() => { ajustarStock(item.slug, 1); onCambio() }}>+</button>
                </div>
              </div>
            </div>
          )
        })}
        <p className="vacio">{total} productos</p>
      </article>
    </>
  )
}

function ProductoPrecioCard({
  item,
  index,
  tablaKey,
  precio,
  mostrarFoto = false,
  mostrarBorrar = false,
  onCodigo,
  onBlurPrecio,
  onKeyPrecio,
  onBorrar,
  cargando,
}) {
  return (
    <article className={`prod-card${precio.venta ? '' : ' is-sin-precio'}`}>
      <div className="prod-card__head">
        {mostrarFoto ? (
          <img className="prod-card__foto" src={item.foto} alt="" onError={(e) => onFotoError(e, item.slug)} />
        ) : null}
        <div className="prod-card__info">
          <input
            className="precio-input precio-input--codigo"
            defaultValue={item.codigo}
            onBlur={onCodigo}
            aria-label="Código"
          />
          <strong>{item.nombre}</strong>
          <p>{etiquetaTipo(item.tipo)} · {item.linea}</p>
        </div>
        {mostrarBorrar ? (
          <button type="button" className="prod-table__borrar" onClick={onBorrar} disabled={cargando}>
            Borrar
          </button>
        ) : null}
      </div>
      <div className="prod-card__precios">
        <label>
          Venta
          <input
            className="precio-input"
            type="number"
            min="0"
            inputMode="decimal"
            data-precio={`${index}-venta`}
            defaultValue={precio.venta || ''}
            onBlur={(e) => onBlurPrecio(item.slug, 'venta', e.target.value)}
            onKeyDown={(e) => onKeyPrecio(e, index, 'venta', item.slug)}
            key={`${item.slug}-venta-${tablaKey}`}
          />
        </label>
        <label>
          Cobro
          <input
            className="precio-input"
            type="number"
            min="0"
            inputMode="decimal"
            data-precio={`${index}-cobro`}
            defaultValue={precio.costo || ''}
            onBlur={(e) => onBlurPrecio(item.slug, 'cobro', e.target.value)}
            onKeyDown={(e) => onKeyPrecio(e, index, 'cobro', item.slug)}
            key={`${item.slug}-cobro-${tablaKey}`}
          />
        </label>
      </div>
    </article>
  )
}

function ProductosView({ productos, onCambio }) {
  const [panel, setPanel] = useState(null)
  const [tipo, setTipo] = useState('producto')
  const [linea, setLinea] = useState('')
  const [lineaNueva, setLineaNueva] = useState('')
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [venta, setVenta] = useState('')
  const [cobro, setCobro] = useState('')
  const [foto, setFoto] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroLinea, setFiltroLinea] = useState('')
  const [soloSinPrecio, setSoloSinPrecio] = useState(false)
  const [porcentaje, setPorcentaje] = useState('')
  const [listado, setListado] = useState('')
  const [tablaKey, setTablaKey] = useState(0)

  const volver = () => {
    setPanel(null)
    setError('')
    setOk('')
  }

  const lineasAlta = listarLineas(tipo)
  const lineasFiltro = listarLineas(filtroTipo || undefined)
  const visibles = productos.filter((item) => {
    if (filtroTipo && item.tipo !== filtroTipo) return false
    if (filtroLinea && item.linea !== nombreLinea(filtroLinea)) return false
    if (soloSinPrecio && precioDe(item.slug).venta > 0) return false
    const q = busqueda.trim().toLowerCase()
    return !q || item.nombre.toLowerCase().includes(q) || item.codigo.toLowerCase().includes(q) || item.linea.toLowerCase().includes(q)
  })
  const sinPrecio = productos.filter((item) => !precioDe(item.slug).venta).length

  const leerFoto = (file) => {
    if (!file) return
    comprimirImagen(file).then(setFoto).catch(() => setError('No se pudo leer la imagen.'))
  }

  const alta = async () => {
    setError('')
    setOk('')
    setCargando(true)
    try {
      const creado = await crearProducto({ nombre, tipo, linea, lineaNueva, foto })
      guardarPrecio(creado.slug, Number(venta) || 0, Number(cobro) || 0)
      if (codigo.trim()) {
        try { asignarCodigo(creado.slug, codigo) } catch { /* ignore */ }
      }
      setNombre('')
      setCodigo('')
      setVenta('')
      setCobro('')
      setFoto('')
      setLineaNueva('')
      setOk('Producto cargado.')
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.')
    } finally {
      setCargando(false)
    }
  }

  const borrar = async (item) => {
    if (!window.confirm(`¿Borrar "${item.nombre}" de la web de pedidos?`)) return
    setError('')
    setCargando(true)
    try {
      await borrarProducto(item.slug)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    } finally {
      setCargando(false)
    }
  }

  const blurPrecio = (slug, campo, valor) => {
    const n = Number(valor) || 0
    if (campo === 'venta') guardarPrecio(slug, n)
    else guardarPrecio(slug, precioDe(slug).venta, n)
  }

  const focoSiguiente = (index, campo) => {
    const sel = campo === 'venta' ? `[data-precio="${index}-cobro"]` : `[data-precio="${index + 1}-venta"]`
    const el = document.querySelector(sel)
    el?.focus()
    el?.select()
  }

  const onKeyPrecio = (e, index, campo, slug) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    blurPrecio(slug, campo, e.target.value)
    focoSiguiente(index, campo)
  }

  const onCodigo = (item) => (e) => {
    try {
      if (e.target.value.trim() && e.target.value.trim().toUpperCase() !== item.codigo) {
        asignarCodigo(item.slug, e.target.value)
        onCambio()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.')
      e.target.value = item.codigo
    }
  }

  const listaPrecios = (opts = {}) => (
    <div className="prod-cards">
      {visibles.map((item, index) => {
        const precio = precioDe(item.slug)
        return (
          <ProductoPrecioCard
            key={item.slug}
            item={item}
            index={index}
            tablaKey={tablaKey}
            precio={precio}
            mostrarFoto={opts.mostrarFoto}
            mostrarBorrar={opts.mostrarBorrar}
            onCodigo={onCodigo(item)}
            onBlurPrecio={blurPrecio}
            onKeyPrecio={onKeyPrecio}
            onBorrar={() => borrar(item)}
            cargando={cargando}
          />
        )
      })}
      <p className="vacio">{visibles.length} de {productos.length} productos</p>
    </div>
  )

  if (panel === 'alta') {
    return (
      <>
        <h1>Cargar producto</h1>
        <p className="dash-sub">Alta de un producto nuevo en el catálogo.</p>
        <button type="button" className="prod-back" onClick={volver}>← Volver a productos</button>
        {error ? <p className="gate__error">{error}</p> : null}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        <article className="panel form-alta">
          <div className="form-alta__grid">
            <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
            <label>Código (opcional)<input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Si lo dejás vacío se asigna solo" /></label>
            <label>
              Tipo
              <select value={tipo} onChange={(e) => { setTipo(e.target.value); setLinea('') }}>
                <option value="producto">Producto</option>
                <option value="liquido">Líquido</option>
                <option value="granel">A granel</option>
              </select>
            </label>
            <label>
              Línea de la web
              <select value={linea} onChange={(e) => setLinea(e.target.value)}>
                <option value="">Elegí una línea</option>
                {lineasAlta.map((item) => (
                  <option key={item} value={item}>{item.replace(/^LINEA\s+/i, '')}</option>
                ))}
              </select>
            </label>
            <label>O nueva línea<input value={lineaNueva} onChange={(e) => setLineaNueva(e.target.value)} placeholder="Si no está en la lista" /></label>
            <label>Precio venta<input type="number" min="0" value={venta} onChange={(e) => setVenta(e.target.value)} /></label>
            <label>Precio cobro<input type="number" min="0" value={cobro} onChange={(e) => setCobro(e.target.value)} /></label>
            <label>Imagen<input type="file" accept="image/*" onChange={(e) => leerFoto(e.target.files?.[0])} /></label>
          </div>
          {foto ? <img className="form-alta__preview" src={foto} alt="" /> : null}
          <button type="button" className="dash-btn dash-btn--navy" onClick={alta} disabled={cargando}>
            {cargando ? 'Publicando…' : 'Cargar'}
          </button>
        </article>
      </>
    )
  }

  if (panel === 'precios') {
    return (
      <>
        <h1>Carga rápida de precios</h1>
        <p className="dash-sub">Código, precio venta y precio cobro. Filtrá, aumentá un % o pegá un listado.</p>
        <button type="button" className="prod-back" onClick={volver}>← Volver a productos</button>
        {error ? <p className="gate__error">{error}</p> : null}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        <article className="panel">
          <div className="carga-rapida">
            <label>Aumentar % a esta lista<input type="number" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} placeholder="10" /></label>
            <button
              type="button"
              className="dash-btn dash-btn--navy"
              onClick={() => {
                const n = Number(String(porcentaje).replace(',', '.'))
                if (!n) { setError('Poné un porcentaje, por ejemplo 10.'); return }
                aumentarPrecios(visibles.map((item) => item.slug), n)
                setOk(`Aumento del ${n}% aplicado a ${visibles.length} productos de esta lista.`)
                setError('')
                setTablaKey((v) => v + 1)
              }}
            >
              Aplicar aumento
            </button>
          </div>
          <label className="listado-precios">
            Pegar listado (codigo,venta,cobro)
            <textarea value={listado} onChange={(e) => setListado(e.target.value)} rows={4} placeholder={'P001,2500,1800\nL012,1800,1200'} />
          </label>
          <button
            type="button"
            className="dash-btn dash-btn--navy"
            onClick={() => {
              const filas = parsearListadoPrecios(listado)
              if (!filas.length) { setError('No se leyeron filas. Usá codigo,venta,cobro.'); return }
              const lote = []
              let miss = 0
              for (const fila of filas) {
                const match = productos.find((item) => item.codigo.toLowerCase() === fila.codigo.trim().toLowerCase())
                if (!match) { miss += 1; continue }
                lote.push({ slug: match.slug, venta: fila.venta, costo: fila.costo })
              }
              guardarPreciosLote(lote)
              setOk(`Se actualizaron ${lote.length} precios${miss ? ` · ${miss} códigos no coincidieron` : ''}.`)
              setError('')
              setListado('')
              setTablaKey((v) => v + 1)
            }}
          >
            Importar listado
          </button>
        </article>
        <div className="filtro-tipos">
          {FILTROS_TIPO.map((item) => (
            <button key={item.id || 'todos'} type="button" className={filtroTipo === item.id ? 'is-on' : ''} onClick={() => { setFiltroTipo(item.id); setFiltroLinea('') }}>
              {item.label}
            </button>
          ))}
          <button type="button" className={soloSinPrecio ? 'is-on' : ''} onClick={() => setSoloSinPrecio((v) => !v)}>
            Solo sin precio ({sinPrecio})
          </button>
        </div>
        <div className="prod-toolbar">
          <input className="dash-search" type="search" placeholder="Buscar por nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="dash-search" value={filtroLinea} onChange={(e) => setFiltroLinea(e.target.value)}>
            <option value="">Todas las líneas</option>
            {lineasFiltro.map((item) => (
              <option key={item} value={item}>{item.replace(/^LINEA\s+/i, '')}</option>
            ))}
          </select>
        </div>
        <article className="panel panel--tabla">
          {listaPrecios()}
        </article>
      </>
    )
  }

  return (
    <>
      <h1>Productos</h1>
      <p className="dash-sub">
        {productos.length} productos · {sinPrecio} sin precio de venta. Los precios no se ven en la web de pedidos.
      </p>
      <div className="prod-tiles">
        <button type="button" className="prod-tile" onClick={() => setPanel('alta')}>
          <span className="prod-tile__kicker">Alta</span>
          <strong>Cargar producto</strong>
          <p>Nombre, código, tipo, línea, precios e imagen.</p>
        </button>
        <button type="button" className="prod-tile" onClick={() => setPanel('precios')}>
          <span className="prod-tile__kicker">Precios</span>
          <strong>Carga rápida de precios</strong>
          <p>Código, venta y cobro. Listado, aumento % o edición en tabla.</p>
        </button>
      </div>
      <div className="filtro-tipos">
        {FILTROS_TIPO.map((item) => (
          <button key={item.id || 'todos'} type="button" className={filtroTipo === item.id ? 'is-on' : ''} onClick={() => { setFiltroTipo(item.id); setFiltroLinea('') }}>
            {item.label}
          </button>
        ))}
        <button type="button" className={soloSinPrecio ? 'is-on' : ''} onClick={() => setSoloSinPrecio((v) => !v)}>
          Solo sin precio ({sinPrecio})
        </button>
      </div>
      <div className="prod-toolbar">
        <input className="dash-search" type="search" placeholder="Buscar por nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select className="dash-search" value={filtroLinea} onChange={(e) => setFiltroLinea(e.target.value)}>
          <option value="">Todas las líneas</option>
          {lineasFiltro.map((item) => (
            <option key={item} value={item}>{item.replace(/^LINEA\s+/i, '')}</option>
          ))}
        </select>
      </div>
      {error ? <p className="gate__error">{error}</p> : null}
      {ok ? <p className="ok-msg">{ok}</p> : null}
      <article className="panel panel--tabla">
        {listaPrecios({ mostrarFoto: true, mostrarBorrar: true })}
      </article>
    </>
  )
}

function FactureroView({ productos, onGuardar }) {
  const [query, setQuery] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [elegido, setElegido] = useState(null)
  const [cliente, setCliente] = useState('')
  const [recibido, setRecibido] = useState('')
  const [cobro, setCobro] = useState('pagado')
  const [lineas, setLineas] = useState([])
  const [error, setError] = useState('')
  const sugeridos = buscarProductos(query, productos).slice(0, 8)
  const qty = cantidadMedia(Number(String(cantidad).replace(',', '.')) || 1)
  const precio = elegido ? precioDe(elegido.slug).venta : 0
  const total = lineas.reduce((acc, item) => acc + item.precio * item.cantidad, 0)
  const plata = Number(String(recibido).replace(',', '.')) || 0
  const vuelto = plata - total

  const agregar = (producto, extra = qty) => {
    const venta = precioDe(producto.slug).venta
    if (!venta) {
      setError('Ese producto no tiene precio de venta. Cargalo en Productos.')
      return
    }
    setError('')
    setLineas((lista) =>
      lista.find((item) => item.slug === producto.slug)
        ? lista.map((item) => (item.slug === producto.slug ? { ...item, cantidad: cantidadMedia(item.cantidad + extra) } : item))
        : [...lista, { slug: producto.slug, nombre: producto.nombre, codigo: producto.codigo, cantidad: extra, precio: venta }],
    )
    setQuery('')
    setCantidad('1')
    setElegido(null)
  }

  const agregarActual = () => {
    const first = buscarProductos(query, productos)[0]
    if (first && (first.codigo.toLowerCase() === query.trim().toLowerCase() || sugeridos.length === 1)) {
      agregar(first)
      return
    }
    if (elegido) {
      agregar(elegido)
      return
    }
    setError('Elegí un producto de la lista o escribí el código.')
  }

  const setCant = (slug, valor) => {
    if (valor < 0.5) {
      setLineas((lista) => lista.filter((item) => item.slug !== slug))
      return
    }
    setLineas((lista) => lista.map((item) => (item.slug === slug ? { ...item, cantidad: cantidadMedia(valor) } : item)))
  }

  return (
    <>
      <h1>Facturero</h1>
      <p className="dash-sub">Buscá por código o nombre, poné cuánto se llevan y marcá si pagó o se lo lleva fiado. El importe se carga igual; en Cuentas queda si debe.</p>
      <article className="panel">
        <label className="ajustes-panel">
          Cliente {cobro === 'fiado' ? '(obligatorio si es fiado)' : '(opcional)'}
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre de quien compra" />
        </label>
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
        <div className="caja-carga">
          <label>
            Código o nombre
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setElegido(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarActual() } }}
              placeholder="P014 o lavandina"
            />
          </label>
          <label>
            Cantidad
            <input type="number" min="0.5" step="0.5" value={cantidad} onChange={(e) => setCantidad(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarActual() } }} />
          </label>
          <div className="caja-carga__valor">
            <span>{elegido ? elegido.nombre : 'Producto'}</span>
            <strong>{elegido && precio ? dinero(precio * qty) : '—'}</strong>
            <small>{elegido && precio ? `${dinero(precio)} c/u` : 'Elegí un ítem'}</small>
          </div>
          <button type="button" className="dash-btn dash-btn--navy" onClick={agregarActual}>Agregar</button>
        </div>
        {query
          ? sugeridos.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`sugerido ${elegido?.slug === item.slug ? 'is-on' : ''}`}
                onClick={() => { setElegido(item); setQuery(item.codigo) }}
                onDoubleClick={() => agregar(item)}
              >
                {item.codigo} · {item.nombre} · {dinero(precioDe(item.slug).venta)}
              </button>
            ))
          : null}
        {lineas.map((item) => (
          <div className="caja-linea" key={item.slug}>
            <div>
              <strong>{item.nombre}</strong>
              <p>{item.codigo} · {dinero(item.precio)} c/u</p>
            </div>
            <div className="stock-edit__btns">
              <button type="button" onClick={() => setCant(item.slug, item.cantidad - 0.5)}>−</button>
              <input className="precio-input" type="number" min="0.5" step="0.5" value={item.cantidad} onChange={(e) => setCant(item.slug, Number(String(e.target.value).replace(',', '.')) || 0)} />
              <button type="button" onClick={() => setCant(item.slug, item.cantidad + 0.5)}>+</button>
            </div>
            <strong>{dinero(item.precio * item.cantidad)}</strong>
            <button type="button" className="prod-table__borrar" onClick={() => setLineas((lista) => lista.filter((row) => row.slug !== item.slug))}>Quitar</button>
          </div>
        ))}
        <p className="total-caja">Total: {dinero(total)}</p>
        {cobro === 'pagado' ? (
          <div className="caja-vuelto">
            <label>Plata que recibís<input type="number" min="0" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="0" /></label>
            <div className={`caja-vuelto__dato ${plata && vuelto < 0 ? 'is-falta' : ''}`}>
              <span>{plata && vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
              <strong>{plata ? dinero(Math.abs(vuelto)) : '—'}</strong>
            </div>
          </div>
        ) : (
          <p className="vacio">Queda anotado que {cliente.trim() || 'el cliente'} debe {dinero(total)} hasta que vuelva a pagar.</p>
        )}
        {error ? <p className="gate__error">{error}</p> : null}
        <button
          type="button"
          className="dash-btn dash-btn--navy"
          onClick={() => {
            if (!lineas.length) { setError('Agregá al menos un producto.'); return }
            const nombre = String(cliente || '').trim()
            if (cobro === 'fiado' && !nombre) {
              setError('Si se lleva fiado, poné el nombre del cliente para saber quién debe.')
              return
            }
            if (cobro === 'pagado' && plata && vuelto < 0) {
              setError('Falta plata. Si se lo lleva y paga después, tocá Fiado.')
              return
            }
            guardarVentaLocal({ origen: 'local', cliente: nombre, items: lineas })
            if (nombre) {
              registrarCargo({ cliente: nombre, total, modo: cobro })
            }
            setLineas([])
            setCliente('')
            setRecibido('')
            setCobro('pagado')
            setError('')
            onGuardar()
          }}
        >
          {cobro === 'fiado' ? 'Anotar fiado' : 'Guardar importe'}
        </button>
      </article>
    </>
  )
}

function ReposicionView({ items, onCambio }) {
  return (
    <>
      <h1>Reposición</h1>
      <p className="dash-sub">Elegí proveedor y cargá lo que entra. El costo se anota solo en Pérdidas.</p>
      <div className="proveedores">
        {PROVEEDORES.map((item) => (
          <a key={item.id} className="proveedor-btn" href={item.url} target="_blank" rel="noreferrer">
            {item.nombre}
            <small>{item.tipo === 'whatsapp' ? 'WhatsApp' : 'Página'}</small>
          </a>
        ))}
      </div>
      <article className="panel">
        {items.length === 0 ? (
          <p className="vacio">No hay productos en alerta o sin stock.</p>
        ) : (
          items.map((item) => {
            const costo = precioDe(item.slug).costo
            return (
              <div className="stock-edit" key={item.slug}>
                <img src={item.foto} alt="" onError={(e) => onFotoError(e, item.slug)} />
                <div>
                  <strong>{item.nombre}</strong>
                  <p>Quedan {stockDe(item.slug)} · cobro {dinero(costo)}</p>
                </div>
                <button
                  type="button"
                  className="dash-btn dash-btn--plus-wide"
                  onClick={() => {
                    registrarReposicion({ slug: item.slug, nombre: item.nombre, cantidad: 10, costo, proveedor: 'Reposición' })
                    onCambio()
                  }}
                >
                  Reponer +10
                </button>
              </div>
            )
          })
        )}
      </article>
    </>
  )
}

function PeriodosView({ titulo, subtitulo, total, anios, color }) {
  const [abierto, setAbierto] = useState(new Date().getFullYear())
  return (
    <>
      <h1>{titulo}</h1>
      <p className="dash-sub">{subtitulo}</p>
      <article className="panel total-periodo">
        <span>Total hasta hoy</span>
        <strong className={color === 'ok' ? 'is-ok' : 'is-bad'}>{dinero(total)}</strong>
      </article>
      {anios.length === 0 ? (
        <article className="panel">
          <p className="vacio">Todavía no hay movimientos.</p>
        </article>
      ) : (
        anios.map((anio) => (
          <article className="panel" key={anio.anio}>
            <button type="button" className="anio-btn" onClick={() => setAbierto(abierto === anio.anio ? 0 : anio.anio)}>
              <strong>{anio.anio}</strong>
              <span>{dinero(anio.total)}</span>
            </button>
            {abierto === anio.anio ? (
              <div>
                {anio.meses.map((mes) => (
                  <div className="mes-row" key={`${anio.anio}-${mes.mes}`}>
                    <span>{MESES[mes.mes - 1]}</span>
                    <strong>{dinero(mes.total)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))
      )}
    </>
  )
}

function AjustesView({ role, nombre, onNombre, onSalir }) {
  const [pin, setPin] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ok, setOk] = useState('')
  const [error, setError] = useState('')
  const [empresa, setEmpresa] = useState(() => leerEmpresa())

  return (
    <>
      <h1>Ajustes</h1>
      <article className="panel ajustes-panel">
        <label>
          Nombre que se ve en el panel
          <input value={nombre} onChange={(e) => onNombre(e.target.value)} placeholder="Ej: Juan Fernández" />
        </label>
        <button type="button" className="dash-btn dash-btn--navy" onClick={() => { guardarNombre(nombre); setOk('Nombre guardado.') }}>
          Guardar nombre
        </button>
        <hr />
        <p>Datos que salen en la factura y el remito</p>
        <label>Razón social<input value={empresa.razonSocial} onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })} /></label>
        <label>Rubro / matrícula<input value={empresa.rubro} onChange={(e) => setEmpresa({ ...empresa, rubro: e.target.value })} /></label>
        <label>CUIT<input value={empresa.cuit} onChange={(e) => setEmpresa({ ...empresa, cuit: e.target.value })} placeholder="XX-XXXXXXXX-X" /></label>
        <label>Ingresos brutos<input value={empresa.ingresosBrutos} onChange={(e) => setEmpresa({ ...empresa, ingresosBrutos: e.target.value })} /></label>
        <label>Inicio de actividades<input value={empresa.inicioActividades} onChange={(e) => setEmpresa({ ...empresa, inicioActividades: e.target.value })} placeholder="10/2014" /></label>
        <label>Domicilio<input value={empresa.domicilio} onChange={(e) => setEmpresa({ ...empresa, domicilio: e.target.value })} /></label>
        <label>Teléfono<input value={empresa.telefono} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} /></label>
        <label>E-mail<input value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} /></label>
        <label>Web<input value={empresa.web} onChange={(e) => setEmpresa({ ...empresa, web: e.target.value })} /></label>
        <label>Condición IVA<input value={empresa.condicionIva} onChange={(e) => setEmpresa({ ...empresa, condicionIva: e.target.value })} placeholder="IVA Responsable Inscripto" /></label>
        <button type="button" className="dash-btn dash-btn--navy" onClick={() => { guardarEmpresa(empresa); setOk('Datos de Famat guardados.') }}>
          Guardar datos del documento
        </button>
        {role === 'jefe' ? (
          <>
            <hr />
            <p>PIN de jefe (4 a 8 números)</p>
            <label>Nuevo PIN<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></label>
            <label>Repetir PIN<input type="password" inputMode="numeric" value={repetir} onChange={(e) => setRepetir(e.target.value.replace(/\D/g, '').slice(0, 8))} /></label>
            <button
              type="button"
              className="dash-btn dash-btn--navy"
              onClick={async () => {
                setError('')
                try {
                  await guardarPinJefe(pin, repetir)
                  setPin('')
                  setRepetir('')
                  setOk(hayPinJefe() ? 'PIN actualizado.' : 'PIN creado.')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo guardar el PIN.')
                }
              }}
            >
              Guardar PIN
            </button>
          </>
        ) : (
          <p className="vacio">El PIN solo lo cambia el jefe.</p>
        )}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        {error ? <p className="gate__error">{error}</p> : null}
        <hr />
        <button type="button" className="dash-btn dash-btn--salir" onClick={onSalir}>Cerrar sesión</button>
      </article>
    </>
  )
}

export default function DashboardApp({ role, onSalir }) {
  const [vista, setVista] = useState('inicio')
  const [pedidos, setPedidos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [tick, setTick] = useState(0)
  const [nombre, setNombre] = useState(() => leerNombre())
  const [menu, setMenu] = useState(false)
  const productos = useMemo(() => listarProductos(), [tick])

  useEffect(() => {
    let alive = true
    hidratarCatalogoRemoto().then(() => { if (alive) setTick((n) => n + 1) })
    cargarPedidos().then((lista) => {
      if (!alive) return
      aplicarPedidosAlStock(lista)
      setPedidos(lista)
      setTick((n) => n + 1)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('dash-menu-open', menu)
    if (!menu) return
    const onKey = (event) => { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('dash-menu-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  // Ya no forzamos el menú abierto en desktop: en PC también es drawer con hamburguesa.
  const visibles = pedidos.filter((item) => !esPedidoCatalogo(item))
  const pendientes = visibles.filter((item) => item.estado.includes('pendiente') || item.estado === '')
  const ultimos = visibles.filter((item) => !estaEntregado(item.estado)).slice(0, 8)
  const conteo = conteoStock(productos.map((item) => item.slug))
  const alertaItems = productos.filter((item) => esAlerta(item.slug) || sinStock(item.slug))
  const filtrados = productos.filter((item) => {
    const q = busqueda.trim().toLowerCase()
    return !q || item.nombre.toLowerCase().includes(q) || item.linea.toLowerCase().includes(q) || item.codigo.toLowerCase().includes(q)
  })
  const rolLabel = etiquetaRol(role)
  const displayName = nombre.trim() || (role === 'jefe' ? 'Juan Fernández' : 'Empleado')
  const refresh = () => setTick((n) => n + 1)
  const actual = NAV.find((item) => item.id === vista)
  const ir = (id) => { setBusqueda(''); setVista(id); setMenu(false) }
  const deudores = clientesConDeuda()
  const badge = (id) => (id === 'pedidos' ? pendientes.length : id === 'stock' ? conteo.alerta : id === 'cuentas' ? deudores.length : 0)

  return (
    <div className={`dash ${menu ? 'is-menu' : ''}`}>
      <button type="button" className="dash-overlay" aria-label="Cerrar menú" hidden={!menu} onClick={() => setMenu(false)} />
      <aside className="dash-side" id="dash-drawer">
        <div className="dash-side__brand">
          <span className="dash-side__logo"><IconHome size={18} /></span>
          <div>
            <strong>famat</strong>
            <span>Controlador Famat</span>
          </div>
          <button type="button" className="dash-side__close" aria-label="Cerrar menú" onClick={() => setMenu(false)}>
            <IconClose />
          </button>
        </div>
        <hr className="dash-side__hr" />
        <nav className="dash-nav dash-nav--all" aria-label="Secciones">
          {NAV.map((item) => {
            const Icon = item.icon
            const n = badge(item.id)
            return (
              <button key={item.id} type="button" className={vista === item.id ? 'is-on' : ''} onClick={() => ir(item.id)}>
                <Icon />
                {item.label}
                {n > 0 ? <span className="dash-nav__badge">{n}</span> : null}
              </button>
            )
          })}
        </nav>
        <nav className="dash-nav dash-nav--more" aria-label="Más secciones">
          {NAV_MORE.map((item) => {
            const Icon = item.icon
            const n = badge(item.id)
            return (
              <button key={item.id} type="button" className={vista === item.id ? 'is-on' : ''} onClick={() => ir(item.id)}>
                <Icon />
                {item.label}
                {n > 0 ? <span className="dash-nav__badge">{n}</span> : null}
              </button>
            )
          })}
        </nav>
        <div className="dash-side__foot">
          <span className="dash-side__avatar">{iniciales(displayName, role)}</span>
          <div className="dash-side__who">
            <strong>{displayName}</strong>
            <small>{rolLabel}</small>
          </div>
        </div>
      </aside>
      <section className="dash-main">
        <header className="dash-top">
          <div className="dash-top__left">
            <button type="button" className="dash-menu-btn" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} aria-controls="dash-drawer" onClick={() => setMenu((open) => !open)}>
              <IconMenu />
            </button>
            <div>
              <p className="dash-top__crumb">Inicio{vista === 'inicio' ? '' : ` / ${actual?.label}`}</p>
              <strong className="dash-top__titulo">{actual?.label || 'Inicio'}</strong>
            </div>
          </div>
          <div className="dash-top__actions">
            <button type="button" className="alerta-chip" onClick={() => ir('stock')}>
              <span>Alerta</span>
              <strong>{conteo.alerta}</strong>
            </button>
            <button type="button" className="dash-btn dash-btn--salir" onClick={onSalir}>Salir</button>
            <button type="button" className="dash-top__avatar" aria-label="Ajustes" onClick={() => ir('ajustes')}>
              {iniciales(displayName, role)}
              {conteo.alerta > 0 ? <span className="dash-top__dot">{conteo.alerta}</span> : null}
            </button>
          </div>
        </header>
        <div className="dash-body">
          <div className="dash-view" key={vista}>
            {vista === 'inicio' && (
              <InicioView
                pedidos={visibles}
                pendientes={pendientes}
                ultimos={ultimos}
                productos={productos.length}
                alerta={conteo.alerta}
                deuda={totalDeuda()}
                deudores={deudores}
                onCuentas={() => ir('cuentas')}
              />
            )}
            {vista === 'pedidos' && <PedidosView pedidos={visibles} onPedidos={setPedidos} onCuentas={refresh} />}
            {vista === 'stock' && <StockView items={filtrados} total={filtrados.length} busqueda={busqueda} onBusqueda={setBusqueda} onCambio={refresh} conteo={conteo} />}
            {vista === 'productos' && <ProductosView productos={productos} onCambio={refresh} />}
            {vista === 'facturero' && <FactureroView productos={productos} onGuardar={refresh} />}
            {vista === 'cuentas' && <CuentasScreen tick={tick} />}
            {vista === 'reposicion' && <ReposicionView items={alertaItems} onCambio={refresh} />}
            {vista === 'importes' && <PeriodosView titulo="Importes" subtitulo="Plata que entra de la página y del facturero" total={totalVentas()} anios={periodosVentas()} color="ok" />}
            {vista === 'perdidas' && <PeriodosView titulo="Pérdidas" subtitulo="Gastos de reposición, agrupados por mes y año" total={totalPerdidas()} anios={periodosPerdidas()} color="bad" />}
            {vista === 'ajustes' && <AjustesView role={role} nombre={nombre} onNombre={setNombre} onSalir={onSalir} />}
          </div>
        </div>
      </section>
      <nav className="dash-tabs" aria-label="Secciones principales">
        {TABS.map((item) => {
          const Icon = item.icon
          const n = badge(item.id)
          const main = item.id === 'facturero'
          return (
            <button key={item.id} type="button" className={`dash-tabs__btn${vista === item.id ? ' is-on' : ''}${main ? ' dash-tabs__btn--main' : ''}`} onClick={() => ir(item.id)}>
              <span className={main ? 'dash-tabs__fab' : 'dash-tabs__icon'}>
                <Icon size={main ? 26 : 20} />
                {n > 0 ? <span className="dash-tabs__badge">{n}</span> : null}
              </span>
              <span className="dash-tabs__label">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
