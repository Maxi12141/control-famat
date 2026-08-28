import { useEffect, useMemo, useRef, useState } from 'react'
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
import { PanelContext, usePanel } from './lib/panel.jsx'
import { dinero, etiquetaTipo, fechaHumana, hoyISO, MESES, nombreLinea } from './lib/format.js'
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
import { aumentarPrecios, aplicarPorcentajeACobro, cobroDesdeVenta, guardarPrecio, guardarPreciosLote, parsearCodigos, parsearListadoPrecios, precioCobroDe, precioDe } from './lib/precios.js'
import { ajustarStock, conteoStock, esAlerta, etiquetaUnidad, formatoStock, pasoStock, setMinimoAlerta, sinStock, stockDe, umbralAlerta, unidadDeTipo } from './lib/stock.js'
import {
  aplicarPedidosAlStock,
  guardarVentaLocal,
  marcarVentaPagada,
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
  itemsDePedido,
  registrarCargo,
  registrarCobro,
  resumenDe,
  totalDeuda,
  totalPedido,
} from './lib/cuentas.js'

const NAV = [
  { id: 'inicio', label: 'Inicio', icon: IconHome },
  { id: 'pedidos', label: 'Pedidos', icon: IconOrders },
  { id: 'stock', label: 'Stock', icon: IconStock },
  { id: 'productos', label: 'Productos', icon: IconProducts },
  { id: 'facturero', label: 'Facturación', icon: IconInvoice },
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

const NAV_SOLO_JEFE = new Set(['importes', 'perdidas'])
const NAV_MORE = NAV.filter((item) => ['productos', 'cuentas', 'importes', 'perdidas', 'ajustes'].includes(item.id))

const FILTROS_TIPO = [
  { id: '', label: 'Todos' },
  { id: 'producto', label: 'Productos' },
  { id: 'liquido', label: 'Líquidos' },
  { id: 'granel', label: 'A granel' },
]

function InicioView({ pedidos, pendientes, ultimos, productos, alerta, deuda, deudores, onCuentas }) {
  const { verPrecios } = usePanel()
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
        <article className="panel panel-centro">
          <h2>Hoy</h2>
          {verPrecios ? (
            <>
              <p>
                Ganancia acumulada: <strong>{dinero(totalVentas())}</strong>
              </p>
              <p>
                Pérdidas por reposición: <strong>{dinero(totalPerdidas())}</strong>
              </p>
              <p>
                Clientes que deben: <strong>{dinero(deuda)}</strong>
              </p>
            </>
          ) : (
            <p className="vacio">Los importes los ve solo el jefe.</p>
          )}
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
  const { verPrecios } = usePanel()
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
                    ? (verPrecios ? `Pagó bien ${dinero(cargo.total)}` : 'Pagó bien')
                    : pagoFiado
                      ? (verPrecios ? `Se llevó fiado y después pagó ${dinero(cargo.total)}` : 'Se llevó fiado y después pagó')
                      : (verPrecios ? `Fiado: todavía debe ${dinero(debe)}` : 'Fiado: todavía debe')}
                </p>
              )
            }
            return (
              <div className="cuenta-acciones">
                {verPrecios ? <p>Total según precio: <strong>{dinero(total)}</strong></p> : null}
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
                        items: itemsDePedido(pedido),
                      })
                      marcarVentaPagada({ pedidoId: pedido.id, cliente: pedido.cliente, fecha: hoyISO() })
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
                        items: itemsDePedido(pedido),
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
      <p className="dash-sub">Activos primero. Lo que pidan en pedidosfamat se descuenta del stock (líquidos en litros, granel en kilos).</p>
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
      <p className="dash-sub">Líquidos en litros, granel en kilos y el resto en unidades. Lo que sale de la web se descuenta solo.</p>
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
  const [filtroTipo, setFiltroTipo] = useState('')
  const [minimos, setMinimos] = useState({})
  const visibles = filtroTipo ? items.filter((item) => item.tipo === filtroTipo) : items
  const valorMin = (item) => minimos[item.slug] ?? String(umbralAlerta(item.tipo, item.slug))
  const guardarMinimo = (item, raw) => {
    const texto = String(raw ?? '').trim().replace(',', '.')
    if (texto === '') {
      setMinimos((mapa) => {
        const next = { ...mapa }
        delete next[item.slug]
        return next
      })
      return
    }
    const n = Number(texto)
    if (!Number.isFinite(n) || n < 0) return
    setMinimoAlerta(item.slug, n)
    setMinimos((mapa) => ({ ...mapa, [item.slug]: String(n) }))
    onCambio()
  }
  return (
    <>
      <StockKpis conteo={conteo} />
      <p className="dash-sub stock-minimos">
        En cada producto poné el mínimo. Si el stock llega a ese número o menos, aparece en Alerta.
      </p>
      <div className="filtro-tipos">
        {FILTROS_TIPO.map((item) => (
          <button key={item.id || 'todos'} type="button" className={filtroTipo === item.id ? 'is-on' : ''} onClick={() => setFiltroTipo(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <input
        className="dash-search"
        type="search"
        placeholder="Buscar para ajustar stock…"
        value={busqueda}
        onChange={(event) => onBusqueda(event.target.value)}
      />
      <article className="panel">
        {visibles.map((item) => {
          const stock = stockDe(item.slug)
          const paso = pasoStock(item.tipo)
          return (
            <div className="stock-edit" key={item.slug}>
              <img src={item.foto} alt="" onError={(event) => onFotoError(event, item.slug)} />
              <div>
                <strong>{item.nombre}</strong>
                <p>
                  {item.codigo} · {etiquetaTipo(item.tipo)} · {etiquetaUnidad(item.tipo)}
                </p>
              </div>
              <div className="stock-edit__meta">
                <span className={`pill ${stock <= 0 ? 'pill--alert' : esAlerta(item.slug, item.tipo) ? 'pill--warn' : 'pill--ok'}`}>{formatoStock(stock, item.tipo)}</span>
                <label className="stock-min">
                  Mín. alerta
                  <span className="stock-min__row">
                    <input
                      type="number"
                      min="0"
                      step={paso}
                      value={valorMin(item)}
                      onChange={(e) => {
                        const v = e.target.value
                        setMinimos((mapa) => ({ ...mapa, [item.slug]: v }))
                        const n = Number(String(v).replace(',', '.'))
                        if (v.trim() === '' || !Number.isFinite(n) || n < 0) return
                        setMinimoAlerta(item.slug, n)
                        onCambio()
                      }}
                      onBlur={(e) => guardarMinimo(item, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      aria-label={`Mínimo de alerta de ${item.nombre} en ${etiquetaUnidad(item.tipo)}`}
                    />
                    <small>{unidadDeTipo(item.tipo)}</small>
                  </span>
                </label>
                <div className="stock-edit__btns">
                  <button type="button" onClick={() => { ajustarStock(item.slug, -paso); onCambio() }}>−</button>
                  <button type="button" onClick={() => { ajustarStock(item.slug, paso); onCambio() }}>+</button>
                </div>
              </div>
            </div>
          )
        })}
        <p className="vacio">{visibles.length} de {total}</p>
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
  verPrecios = true,
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
      {verPrecios ? (
      <div className="prod-card__precios">
        <label>
          Precio lista
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
          Venta
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
      ) : null}
    </article>
  )
}

function ProductosView({ productos, onCambio }) {
  const { esJefe, verPrecios } = usePanel()
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
  const [codigoRapido, setCodigoRapido] = useState('')
  const codigoRapidoRef = useRef(null)

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

  const buscarPorCodigo = (texto) => {
    const q = String(texto || '').trim()
    if (!q) return null
    const hits = buscarProductos(q, productos)
    const exactos = hits.filter((item) => item.codigo.toLowerCase() === q.toLowerCase())
    return exactos[0] || (hits.length === 1 ? hits[0] : null)
  }

  const hitsRapidos = parsearCodigos(codigoRapido).map((codigo) => {
    const item = buscarPorCodigo(codigo)
    const lista = item ? precioDe(item.slug).venta : 0
    return {
      codigo,
      item,
      lista,
      venta: lista ? cobroDesdeVenta(lista, porcentaje) : 0,
    }
  })

  const ponerVentaPorCodigos = () => {
    const filas = hitsRapidos.length ? hitsRapidos : parsearCodigos(codigoRapido).map((codigo) => {
      const item = buscarPorCodigo(codigo)
      const lista = item ? precioDe(item.slug).venta : 0
      return { codigo, item, lista, venta: lista ? cobroDesdeVenta(lista, porcentaje) : 0 }
    })
    if (!filas.length) {
      setError('Poné uno o más códigos, separados por coma o uno por renglón.')
      return
    }
    const raw = String(porcentaje).trim().replace(',', '.')
    if (raw === '' || Number.isNaN(Number(raw))) {
      setError('Poné el porcentaje, por ejemplo 40.')
      return
    }
    const pct = Number(raw)
    const okItems = []
    const miss = []
    for (const fila of filas) {
      if (!fila.item) {
        miss.push(fila.codigo)
        continue
      }
      if (!fila.lista) {
        miss.push(`${fila.codigo} (sin precio lista)`)
        continue
      }
      guardarPrecio(fila.item.slug, fila.lista, cobroDesdeVenta(fila.lista, pct))
      okItems.push(`${fila.item.codigo} venta ${dinero(cobroDesdeVenta(fila.lista, pct))}`)
    }
    if (!okItems.length) {
      setError(miss.length ? `No se pudo actualizar: ${miss.join(', ')}.` : 'Poné códigos válidos.')
      return
    }
    setOk(`Venta actualizada (${pct}% sobre precio lista): ${okItems.join(' · ')}${miss.length ? ` · no coincidieron ${miss.join(', ')}` : ''}`)
    setError('')
    setTablaKey((v) => v + 1)
    setCodigoRapido('')
    onCambio()
    window.setTimeout(() => codigoRapidoRef.current?.focus(), 0)
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
            verPrecios={verPrecios}
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
            {verPrecios ? (
              <>
                <label>Precio lista<input type="number" min="0" value={venta} onChange={(e) => setVenta(e.target.value)} /></label>
                <label>Venta<input type="number" min="0" value={cobro} onChange={(e) => setCobro(e.target.value)} /></label>
              </>
            ) : null}
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
    if (!esJefe) {
      return (
        <>
          <h1>Carga rápida de precios</h1>
          <p className="vacio">Los precios los carga solo el jefe.</p>
          <button type="button" className="prod-back" onClick={volver}>← Volver a productos</button>
        </>
      )
    }
    return (
      <>
        <h1>Carga rápida de precios</h1>
        <p className="dash-sub">Pegá varios códigos. El precio lista ya tiene que estar cargado: con tu % se actualiza la venta.</p>
        <button type="button" className="prod-back" onClick={volver}>← Volver a productos</button>
        {error ? <p className="gate__error">{error}</p> : null}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        <article className="panel">
          <div className="carga-codigo">
            <label>
              Códigos
              <textarea
                ref={codigoRapidoRef}
                value={codigoRapido}
                autoComplete="off"
                spellCheck={false}
                rows={3}
                placeholder={'L001\nL012\nP001'}
                onChange={(e) => {
                  setCodigoRapido(e.target.value)
                  setOk('')
                  setError('')
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  if (e.shiftKey) return
                  e.preventDefault()
                  ponerVentaPorCodigos()
                }}
              />
            </label>
            <label>
              Porcentaje %
              <input
                type="number"
                min="0"
                step="0.1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="40"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  ponerVentaPorCodigos()
                }}
              />
            </label>
            <button type="button" className="dash-btn dash-btn--navy" onClick={ponerVentaPorCodigos}>
              Poner en venta
            </button>
          </div>
          {hitsRapidos.length ? (
            <div className="carga-codigo__visto">
              {hitsRapidos.map((fila) => (
                <p key={fila.codigo}>
                  <strong>{fila.codigo}</strong>
                  {fila.item ? ` · ${fila.item.nombre}` : ' · no encontrado'}
                  {fila.item ? ` · lista ${fila.lista ? dinero(fila.lista) : 'sin cargar'} · venta ${fila.lista ? dinero(fila.venta) : '—'}` : ''}
                </p>
              ))}
            </div>
          ) : (
            <p className="vacio">Poné uno o más códigos (coma o un renglón cada uno). Se ve el precio lista y, con tu %, la venta.</p>
          )}
          <div className="carga-rapida">
            <button
              type="button"
              className="dash-btn dash-btn--navy"
              onClick={() => {
                const raw = String(porcentaje).trim().replace(',', '.')
                if (raw === '' || Number.isNaN(Number(raw))) { setError('Poné un porcentaje, por ejemplo 40.'); return }
                const n = Number(raw)
                const cant = aplicarPorcentajeACobro(visibles.map((item) => item.slug), n)
                setOk(`Venta = precio lista + ${n}% en ${cant} productos de esta lista.`)
                setError('')
                setTablaKey((v) => v + 1)
                onCambio()
              }}
            >
              Aplicar este % a la venta de la lista
            </button>
            <button
              type="button"
              className="dash-btn"
              onClick={() => {
                const n = Number(String(porcentaje).replace(',', '.'))
                if (!n) { setError('Poné un porcentaje, por ejemplo 10.'); return }
                aumentarPrecios(visibles.map((item) => item.slug), n)
                setOk(`Aumento del ${n}% en precio lista y venta de ${visibles.length} productos de esta lista.`)
                setError('')
                setTablaKey((v) => v + 1)
                onCambio()
              }}
            >
              Aumentar precio lista y venta
            </button>
          </div>
          <label className="listado-precios">
            Pegar listado: un renglón por producto, solo código y precio lista
            <textarea value={listado} onChange={(e) => setListado(e.target.value)} rows={4} placeholder={'P001,2500\nL012,1800'} />
          </label>
          <button
            type="button"
            className="dash-btn dash-btn--navy"
            onClick={() => {
              const filas = parsearListadoPrecios(listado)
              if (!filas.length) { setError('No se leyeron filas. Poné codigo,precio lista. Ejemplo: L001,2500'); return }
              const lote = []
              let miss = 0
              for (const fila of filas) {
                const match = productos.find((item) => item.codigo.toLowerCase() === fila.codigo.trim().toLowerCase())
                if (!match) { miss += 1; continue }
                lote.push({ slug: match.slug, venta: fila.venta })
              }
              guardarPreciosLote(lote)
              setOk(`Se actualizó el precio lista de ${lote.length} productos${miss ? ` · ${miss} códigos no coincidieron` : ''}. La venta se actualiza después con los códigos y el %.`)
              setError('')
              setListado('')
              setTablaKey((v) => v + 1)
              onCambio()
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
        {productos.length} productos{verPrecios ? ` · ${sinPrecio} sin precio lista` : ''}. Los precios no se ven en la web de pedidos.
      </p>
      <div className="prod-tiles">
        <button type="button" className="prod-tile" onClick={() => setPanel('alta')}>
          <span className="prod-tile__kicker">Alta</span>
          <strong>Cargar producto</strong>
          <p>Nombre, código, tipo, línea{verPrecios ? ', precios' : ''} e imagen.</p>
        </button>
        {esJefe ? (
          <button type="button" className="prod-tile" onClick={() => setPanel('precios')}>
            <span className="prod-tile__kicker">Precios</span>
            <strong>Carga rápida de precios</strong>
            <p>Varios códigos, ves el precio lista y con tu % queda la venta.</p>
          </button>
        ) : null}
      </div>
      <div className="filtro-tipos">
        {FILTROS_TIPO.map((item) => (
          <button key={item.id || 'todos'} type="button" className={filtroTipo === item.id ? 'is-on' : ''} onClick={() => { setFiltroTipo(item.id); setFiltroLinea('') }}>
            {item.label}
          </button>
        ))}
        {verPrecios ? (
          <button type="button" className={soloSinPrecio ? 'is-on' : ''} onClick={() => setSoloSinPrecio((v) => !v)}>
            Solo sin precio ({sinPrecio})
          </button>
        ) : null}
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

function filaFacturaVacia() {
  return {
    id: `f_${Math.random().toString(36).slice(2, 10)}`,
    codigo: '',
    slug: '',
    nombre: '',
    tipo: '',
    cantidad: '',
    precio: 0,
  }
}

function precioPorLitroDe(slug) {
  return precioCobroDe(slug)
}

function FactureroView({ productos, onGuardar }) {
  const { verPrecios } = usePanel()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [entidad, setEntidad] = useState('')
  const [recibido, setRecibido] = useState('')
  const [cobro, setCobro] = useState('pagado')
  const [lineas, setLineas] = useState(() => Array.from({ length: 5 }, filaFacturaVacia))
  const [sugerencias, setSugerencias] = useState({ id: '', items: [] })
  const [error, setError] = useState('')
  const filasOk = lineas.filter((fila) => fila.slug && Number(fila.cantidad) > 0)
  const total = filasOk.reduce((acc, fila) => acc + Number(fila.precio || 0) * Number(fila.cantidad || 0), 0)
  const plata = Number(String(recibido).replace(',', '.')) || 0
  const vuelto = plata - total
  const cliente = [nombre, apellido].map((parte) => parte.trim()).filter(Boolean).join(' ')

  const aplicarCodigo = (id, codigo, elegido) => {
    const texto = String(codigo || '').trim()
    if (!texto) {
      setLineas((lista) => lista.map((fila) => (fila.id === id ? { ...filaFacturaVacia(), id } : fila)))
      setSugerencias({ id: '', items: [] })
      setError('')
      return
    }
    const hits = elegido ? [elegido] : buscarProductos(texto, productos)
    const exactos = hits.filter((item) => item.codigo.toLowerCase() === texto.toLowerCase())
    const prod = elegido || exactos[0] || (hits.length === 1 ? hits[0] : null)
    if (!prod) {
      setLineas((lista) => lista.map((fila) => (
        fila.id === id ? { ...fila, codigo: texto, slug: '', nombre: '', tipo: '', precio: 0 } : fila
      )))
      setSugerencias({ id, items: hits.slice(0, 8) })
      setError(hits.length ? '' : 'No hay un producto con ese código.')
      return
    }
    const precio = precioPorLitroDe(prod.slug)
    setError(precio ? '' : (verPrecios ? 'Ese producto no tiene precio de venta. Cargalo en Productos.' : 'Ese producto no está listo. Avisale al jefe.'))
    setLineas((lista) => {
      const next = lista.map((fila) => (
        fila.id === id
          ? { ...fila, codigo: prod.codigo, slug: prod.slug, nombre: prod.nombre, tipo: prod.tipo, precio }
          : fila
      ))
      return next.some((fila) => !fila.slug) ? next : [...next, filaFacturaVacia()]
    })
    setSugerencias({ id: '', items: [] })
    window.setTimeout(() => document.querySelector(`[data-fact-l="${id}"]`)?.focus(), 0)
  }

  const pasarANuevaFila = (id) => {
    setLineas((lista) => {
      const i = lista.findIndex((fila) => fila.id === id)
      const haySiguiente = i >= 0 && i < lista.length - 1
      const next = haySiguiente ? lista : [...lista, filaFacturaVacia()]
      const destino = next[i + 1] || next[next.length - 1]
      window.setTimeout(() => document.querySelector(`[data-fact-c="${destino.id}"]`)?.focus(), 0)
      return next
    })
  }

  const setLitros = (id, valor) => {
    const n = Math.max(0, Number(String(valor).replace(',', '.')) || 0)
    setLineas((lista) => lista.map((fila) => (
      fila.id === id ? { ...fila, cantidad: valor === '' ? '' : n } : fila
    )))
  }

  const limpiarFila = (id) => {
    setLineas((lista) => lista.map((fila) => (fila.id === id ? { ...filaFacturaVacia(), id } : fila)))
    setSugerencias({ id: '', items: [] })
  }

  return (
    <div className="fact-page">
      <h1>Facturación</h1>
      <p className="dash-sub">{verPrecios ? 'Poné el código: aparece el producto y el precio. Cargás litros, kilos o unidades según el producto.' : 'Poné el código: aparece el producto. Cargás litros, kilos o unidades según el producto.'}</p>
      <article className="panel fact-panel">
        <div className="fact-banner">FAMAT</div>
        <p className="fact-cli-tit">DATOS DEL CLIENTE</p>
        <div className="fact-cli">
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" /></label>
          <label>Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Apellido" /></label>
          <label>Dirección<input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
          <label>
            Teléfono
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Para avisar si debe" />
            <small>Opcional. Si se lleva fiado y no lo tenés, lo podés completar después en Cuentas.</small>
          </label>
          <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <label>Entidad<input value={entidad} onChange={(e) => setEntidad(e.target.value)} /></label>
        </div>
        {cliente ? <p className="fact-cliente-ok">Cliente: {cliente}</p> : null}
        <div className="fact-titulo">FACTURA DE COMPRA</div>
        <div className="fact-wrap">
          <table className="fact-planilla">
            <colgroup>
              <col className="fact-col-cod" />
              <col className="fact-col-nom" />
              <col className="fact-col-cant" />
              {verPrecios ? (
                <>
                  <col className="fact-col-pre" />
                  <col className="fact-col-imp" />
                </>
              ) : null}
              <col className="fact-col-x" />
            </colgroup>
            <thead>
              <tr>
                <th>Código</th>
                <th>Artículo(s)</th>
                <th>Cant.</th>
                {verPrecios ? (
                  <>
                    <th>Precio</th>
                    <th>Total</th>
                  </>
                ) : null}
                <th className="fact-planilla__x"> </th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((fila) => (
                <tr key={fila.id}>
                  <td data-label="Código" className={`fact-planilla__cod${sugerencias.id === fila.id && sugerencias.items.length ? ' is-sug' : ''}`}>
                    <input
                      value={fila.codigo}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Cód."
                      data-fact-c={fila.id}
                      aria-label="Código"
                      onChange={(e) => {
                        const v = e.target.value
                        setLineas((lista) => lista.map((row) => (row.id === fila.id ? { ...row, codigo: v } : row)))
                        setSugerencias({ id: fila.id, items: buscarProductos(v, productos).slice(0, 8) })
                      }}
                      onBlur={(e) => {
                        window.setTimeout(() => {
                          const texto = e.target.value
                          const hits = buscarProductos(texto, productos)
                          const exactos = hits.filter((item) => item.codigo.toLowerCase() === String(texto || '').trim().toLowerCase())
                          const prod = exactos[0] || (hits.length === 1 ? hits[0] : null)
                          if (prod) aplicarCodigo(fila.id, texto, prod)
                          else setSugerencias({ id: '', items: [] })
                        }, 120)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        const primera = sugerencias.id === fila.id ? sugerencias.items[0] : null
                        aplicarCodigo(fila.id, primera?.codigo || fila.codigo, primera || undefined)
                      }}
                    />
                    {sugerencias.id === fila.id && sugerencias.items.length ? (
                      <div className="fact-sug">
                        {sugerencias.items.map((item) => (
                          <button
                            key={item.slug}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => aplicarCodigo(fila.id, item.codigo, item)}
                          >
                            <b>{item.codigo}</b>
                            <span title={item.nombre}>{item.nombre}</span>
                            {verPrecios ? <em>{dinero(precioPorLitroDe(item.slug))}</em> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Artículo" className="fact-planilla__nom">{fila.nombre || '—'}</td>
                  <td data-label="Cant." className="fact-planilla__cant">
                    <input
                      className="fact-planilla__num"
                      type="number"
                      min="0"
                      step={fila.tipo ? pasoStock(fila.tipo) : 0.5}
                      data-fact-l={fila.id}
                      aria-label={fila.tipo ? etiquetaUnidad(fila.tipo) : 'Cantidad'}
                      value={fila.cantidad}
                      disabled={!fila.slug}
                      placeholder={fila.slug ? unidadDeTipo(fila.tipo) : ' '}
                      onChange={(e) => setLitros(fila.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        if (verPrecios) document.querySelector(`[data-fact-p="${fila.id}"]`)?.focus()
                        else pasarANuevaFila(fila.id)
                      }}
                    />
                  </td>
                  {verPrecios ? (
                    <>
                      <td data-label="Precio" className="fact-planilla__precio">
                        {fila.slug && verPrecios ? (
                          <input
                            className="fact-planilla__num"
                            type="number"
                            min="0"
                            data-fact-p={fila.id}
                            value={fila.precio || ''}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              pasarANuevaFila(fila.id)
                            }}
                            onChange={(e) => {
                              const v = e.target.value
                              setLineas((lista) => lista.map((row) => (
                                row.id === fila.id ? { ...row, precio: v === '' ? 0 : Number(String(v).replace(',', '.')) || 0 } : row
                              )))
                            }}
                          />
                        ) : (fila.slug ? dinero(fila.precio) : '$')}
                      </td>
                      <td data-label="Total" className="fact-planilla__imp">{fila.slug && Number(fila.cantidad) ? dinero(fila.precio * Number(fila.cantidad)) : '$'}</td>
                    </>
                  ) : null}
                  <td className="fact-planilla__del-cell">
                    {fila.slug ? (
                      <button type="button" className="fact-planilla__del" onClick={() => limpiarFila(fila.id)}>×</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="fact-planilla__total-lab" colSpan={3}>TOTAL</td>
                {verPrecios ? (
                  <>
                    <td />
                    <td className="fact-planilla__total">{dinero(total)}</td>
                  </>
                ) : null}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="fact-pie">
          {cobro === 'pagado' ? (
            verPrecios ? (
              <>
                <label className="fact-abono">
                  Dinero abonó
                  <input type="number" min="0" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="0" />
                </label>
                <div className={`fact-vuelto ${plata && vuelto < 0 ? 'is-falta' : ''}`}>
                  <span>{plata && vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
                  <strong>{plata ? dinero(Math.abs(vuelto)) : '$'}</strong>
                </div>
              </>
            ) : (
              <p className="vacio">Registrá si pagó o se lleva fiado.</p>
            )
          ) : verPrecios ? (
            <>
                <label className="fact-abono">
                  Entregó ahora
                  <input
                    type="number"
                    min="0"
                    value={recibido}
                    onChange={(e) => setRecibido(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <div className="fact-vuelto is-falta">
                  <span>Queda debiendo</span>
                  <strong>{dinero(Math.max(0, total - plata))}</strong>
                </div>
                <p className="fact-pie__nota">
                  {plata > 0 && plata < total
                    ? `${cliente || 'El cliente'} entrega ${dinero(plata)} y queda debiendo ${dinero(total - plata)}.`
                    : `Queda anotado que ${cliente || 'el cliente'} debe ${dinero(total)}.`}
                </p>
            </>
          ) : (
            <p className="vacio">Queda anotado el fiado de {cliente || 'el cliente'}.</p>
          )}
        </div>
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
        {error ? <p className="gate__error">{error}</p> : null}
        <button
          type="button"
          className="dash-btn dash-btn--navy fact-guardar"
          onClick={() => {
            if (!filasOk.length) {
              setError('Agregá al menos un producto.')
              return
            }
            if (!nombre.trim() || !apellido.trim()) {
              setError('Poné el nombre y el apellido del cliente.')
              return
            }
            if (cobro === 'pagado' && plata && vuelto < 0) {
              setError('Falta plata. Si se lo lleva y paga después, tocá Fiado.')
              return
            }
            const entregaFiado = cobro === 'fiado' ? Math.min(Math.max(0, plata), total) : 0
            const pagoCompleto = cobro === 'pagado' || (entregaFiado > 0 && entregaFiado >= total)
            const notas = [direccion && `Dir. ${direccion}`, telefono && `Tel. ${telefono}`, entidad && `Entidad ${entidad}`, cobro === 'fiado' && entregaFiado > 0 && `Entregó ${dinero(entregaFiado)}`]
              .filter(Boolean)
              .join(' · ')
            guardarVentaLocal({
              origen: 'local',
              cliente,
              telefono,
              fecha,
              pagado: pagoCompleto,
              items: filasOk.map((fila) => ({
                slug: fila.slug,
                nombre: fila.nombre,
                codigo: fila.codigo,
                cantidad: Number(fila.cantidad),
                precio: fila.precio,
                tipo: fila.tipo,
              })),
            })
            registrarCargo({
              cliente,
              telefono,
              total,
              modo: pagoCompleto ? 'pagado' : 'fiado',
              fecha,
              notas,
              items: filasOk.map((fila) => ({
                slug: fila.slug,
                nombre: fila.nombre,
                codigo: fila.codigo,
                cantidad: Number(fila.cantidad),
                precio: fila.precio,
                tipo: fila.tipo,
              })),
            })
            if (!pagoCompleto && entregaFiado > 0) {
              registrarCobro({ cliente, telefono, monto: entregaFiado, notas: 'Seña / entregó ahora', fecha })
            }
            setLineas(Array.from({ length: 5 }, filaFacturaVacia))
            setNombre('')
            setApellido('')
            setDireccion('')
            setTelefono('')
            setEntidad('')
            setFecha(hoyISO())
            setRecibido('')
            setCobro('pagado')
            setError('')
            setSugerencias({ id: '', items: [] })
            onGuardar()
          }}
        >
          {cobro === 'fiado' ? 'Anotar fiado' : 'Guardar importe'}
        </button>
      </article>
    </div>
  )
}

function filaRepoVacia() {
  return { id: `r_${Math.random().toString(36).slice(2, 8)}`, codigo: '', slug: '', nombre: '', tipo: 'producto', cantidad: '' }
}

function ReposicionView({ productos, alerta, onCambio }) {
  const { verPrecios } = usePanel()
  const [lineas, setLineas] = useState(() => [filaRepoVacia()])
  const [sugerencias, setSugerencias] = useState({ id: '', items: [] })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cantAlerta, setCantAlerta] = useState({})

  const aplicarCodigo = (id, codigo, elegido) => {
    const texto = String(codigo || '').trim()
    if (!texto) {
      setLineas((lista) => lista.map((fila) => (fila.id === id ? { ...filaRepoVacia(), id } : fila)))
      setSugerencias({ id: '', items: [] })
      return
    }
    const hits = elegido ? [elegido] : buscarProductos(texto, productos)
    const exactos = hits.filter((item) => item.codigo.toLowerCase() === texto.toLowerCase())
    const prod = elegido || exactos[0] || (hits.length === 1 ? hits[0] : null)
    if (!prod) {
      setSugerencias({ id, items: hits.slice(0, 8) })
      setError(hits.length ? '' : 'No hay un producto con ese código.')
      return
    }
    setError('')
    setLineas((lista) => {
      const next = lista.map((fila) => (
        fila.id === id
          ? { ...fila, codigo: prod.codigo, slug: prod.slug, nombre: prod.nombre, tipo: prod.tipo }
          : fila
      ))
      return next.some((fila) => !fila.slug) ? next : [...next, filaRepoVacia()]
    })
    setSugerencias({ id: '', items: [] })
  }

  const guardarPedido = () => {
    const filasOk = lineas.filter((fila) => fila.slug && Number(fila.cantidad) > 0)
    if (!filasOk.length) {
      setError('Cargá al menos un producto y la cantidad que pediste.')
      return
    }
    for (const fila of filasOk) {
      registrarReposicion({
        slug: fila.slug,
        nombre: fila.nombre,
        cantidad: Number(fila.cantidad),
        costo: precioDe(fila.slug).costo || precioDe(fila.slug).venta,
        proveedor: 'Reposición',
      })
    }
    setOk(`Entraron ${filasOk.map((fila) => `${fila.nombre} ${formatoStock(fila.cantidad, fila.tipo)}`).join(', ')}.`)
    setError('')
    setLineas([filaRepoVacia()])
    onCambio()
  }

  const reponerAlerta = (item) => {
    const cantidad = Number(String(cantAlerta[item.slug] ?? '').replace(',', '.'))
    if (!(cantidad > 0)) {
      setError(`Poné cuánto entra de ${item.nombre} (${etiquetaUnidad(item.tipo)}).`)
      return
    }
    registrarReposicion({
      slug: item.slug,
      nombre: item.nombre,
      cantidad,
      costo: precioDe(item.slug).costo || precioDe(item.slug).venta,
      proveedor: 'Reposición',
    })
    setCantAlerta((mapa) => ({ ...mapa, [item.slug]: '' }))
    setOk(`Entró ${formatoStock(cantidad, item.tipo)} de ${item.nombre}.`)
    setError('')
    onCambio()
  }

  return (
    <>
      <h1>Reposición</h1>
      <p className="dash-sub">Anotá lo que pediste al proveedor: entra al stock esa cantidad (litros, kilos o unidades).</p>
      <div className="proveedores">
        {PROVEEDORES.map((item) => (
          <a key={item.id} className="proveedor-btn" href={item.url} target="_blank" rel="noreferrer">
            {item.nombre}
            <small>{item.tipo === 'whatsapp' ? 'WhatsApp' : 'Página'}</small>
          </a>
        ))}
      </div>
      {error ? <p className="gate__error">{error}</p> : null}
      {ok ? <p className="ok-msg">{ok}</p> : null}
      <article className="panel">
        <h2>Lo que pediste</h2>
        <div className="repo-lineas">
          {lineas.map((fila) => (
            <div className="repo-linea" key={fila.id}>
              <label className={`repo-linea__cod${sugerencias.id === fila.id && sugerencias.items.length ? ' is-sug' : ''}`}>
                Código
                <input
                  value={fila.codigo}
                  autoComplete="off"
                  placeholder="Cód."
                  onChange={(e) => {
                    const v = e.target.value
                    setLineas((lista) => lista.map((row) => (row.id === fila.id ? { ...row, codigo: v } : row)))
                    setSugerencias({ id: fila.id, items: buscarProductos(v, productos).slice(0, 8) })
                  }}
                  onBlur={() => window.setTimeout(() => aplicarCodigo(fila.id, fila.codigo), 120)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      aplicarCodigo(fila.id, fila.codigo)
                    }
                  }}
                />
                {sugerencias.id === fila.id && sugerencias.items.length ? (
                  <div className="fact-sug">
                    {sugerencias.items.map((item) => (
                      <button
                        key={item.slug}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => aplicarCodigo(fila.id, item.codigo, item)}
                      >
                        <b>{item.codigo}</b>
                        <span>{item.nombre}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
              <p className="repo-linea__nom">{fila.nombre || '—'}</p>
              <label>
                Cantidad ({fila.slug ? unidadDeTipo(fila.tipo) : 'u'})
                <input
                  type="number"
                  min="0"
                  step={pasoStock(fila.tipo)}
                  value={fila.cantidad}
                  disabled={!fila.slug}
                  placeholder={fila.slug ? unidadDeTipo(fila.tipo) : ''}
                  onChange={(e) => setLineas((lista) => lista.map((row) => (row.id === fila.id ? { ...row, cantidad: e.target.value } : row)))}
                />
              </label>
            </div>
          ))}
        </div>
        <button type="button" className="dash-btn dash-btn--navy" onClick={guardarPedido}>
          Entró al depósito
        </button>
      </article>
      <article className="panel">
        <h2>Faltantes</h2>
        {alerta.length === 0 ? (
          <p className="vacio">No hay productos en alerta o sin stock.</p>
        ) : (
          alerta.map((item) => {
            const costo = precioDe(item.slug).costo
            return (
              <div className="stock-edit" key={item.slug}>
                <img src={item.foto} alt="" onError={(e) => onFotoError(e, item.slug)} />
                <div>
                  <strong>{item.nombre}</strong>
                  <p>
                    Quedan {formatoStock(stockDe(item.slug), item.tipo)}
                    {verPrecios && costo ? ` · venta ${dinero(costo)}` : ''}
                  </p>
                </div>
                <div className="repo-alerta">
                  <input
                    type="number"
                    min="0"
                    step={pasoStock(item.tipo)}
                    value={cantAlerta[item.slug] ?? ''}
                    placeholder={unidadDeTipo(item.tipo)}
                    onChange={(e) => setCantAlerta((mapa) => ({ ...mapa, [item.slug]: e.target.value }))}
                    aria-label={`Cantidad en ${etiquetaUnidad(item.tipo)}`}
                  />
                  <button type="button" className="dash-btn dash-btn--navy" onClick={() => reponerAlerta(item)}>
                    Entró
                  </button>
                </div>
              </div>
            )
          })
        )}
      </article>
    </>
  )
}

function PeriodosView({ titulo, subtitulo, total, anios, color, conClientes = false }) {
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
          <p className="vacio">{conClientes ? 'Todavía no hay cobros. Cuando alguien pague, aparece acá con nombre y apellido.' : 'Todavía no hay movimientos.'}</p>
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
                  <div className="mes-block" key={`${anio.anio}-${mes.mes}`}>
                    <div className="mes-row">
                      <span>{MESES[mes.mes - 1]}</span>
                      <strong>{dinero(mes.total)}</strong>
                    </div>
                    {conClientes
                      ? [...(mes.items || [])]
                          .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
                          .map((item) => (
                          <div className="importe-linea" key={item.id}>
                            <span>
                              {fechaHumana(item.fecha)} · {item.cliente?.trim() || 'Sin nombre'}
                            </span>
                            <strong>{dinero(item.total)}</strong>
                          </div>
                        ))
                      : null}
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
  const [avisoAlerta, setAvisoAlerta] = useState(false)
  const productos = useMemo(() => listarProductos(), [tick])

  useEffect(() => {
    let alive = true
    const traerPedidos = () => {
      cargarPedidos().then((lista) => {
        if (!alive) return
        aplicarPedidosAlStock(lista)
        setPedidos(lista)
      })
    }
    hidratarCatalogoRemoto().then(() => { if (alive) setTick((n) => n + 1) })
    traerPedidos()
    const timer = window.setInterval(traerPedidos, 20000)
    const onFocus = () => traerPedidos()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
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
  const conteo = conteoStock(productos)
  const alertaItems = productos.filter((item) => esAlerta(item.slug, item.tipo) || sinStock(item.slug))
  const filtrados = productos.filter((item) => {
    const q = busqueda.trim().toLowerCase()
    return !q || item.nombre.toLowerCase().includes(q) || item.linea.toLowerCase().includes(q) || item.codigo.toLowerCase().includes(q)
  })
  const rolLabel = etiquetaRol(role)
  const displayName = nombre.trim() || (role === 'jefe' ? 'Juan Fernández' : 'Empleado')
  const esJefe = role === 'jefe'
  const verPrecios = esJefe
  const navAll = NAV.filter((item) => esJefe || !NAV_SOLO_JEFE.has(item.id))
  const navMore = NAV_MORE.filter((item) => esJefe || !NAV_SOLO_JEFE.has(item.id))
  const refresh = () => setTick((n) => n + 1)
  const actual = NAV.find((item) => item.id === vista)
  const ir = (id) => { setBusqueda(''); setVista(id); setMenu(false) }
  const deudores = clientesConDeuda()
  const badge = (id) => (id === 'pedidos' ? pendientes.length : id === 'stock' ? conteo.alerta : id === 'cuentas' ? deudores.length : 0)

  useEffect(() => {
    if (!avisoAlerta) return
    const cerrar = (event) => {
      if (event.key === 'Escape') setAvisoAlerta(false)
    }
    const click = (event) => {
      if (!event.target.closest('.alerta-wrap')) setAvisoAlerta(false)
    }
    window.addEventListener('keydown', cerrar)
    window.addEventListener('mousedown', click)
    return () => {
      window.removeEventListener('keydown', cerrar)
      window.removeEventListener('mousedown', click)
    }
  }, [avisoAlerta])

  return (
    <PanelContext.Provider value={{ role, verPrecios, esJefe }}>
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
          {navAll.map((item) => {
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
          {navMore.map((item) => {
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
            <div className="alerta-wrap">
              <button
                type="button"
                className="alerta-chip"
                aria-expanded={avisoAlerta}
                onClick={() => setAvisoAlerta((v) => !v)}
              >
                <span>Alerta</span>
                <strong>{alertaItems.length}</strong>
              </button>
              {avisoAlerta ? (
                <>
                  <button type="button" className="alerta-fondo" aria-label="Cerrar aviso" onClick={() => setAvisoAlerta(false)} />
                  <div className="alerta-aviso" role="status">
                    <p className="alerta-aviso__tit">Aviso de stock</p>
                    {alertaItems.length === 0 ? (
                      <p className="vacio">No falta nada por ahora.</p>
                    ) : (
                      <ul>
                        {alertaItems.map((item) => (
                          <li key={item.slug}>
                            <span>
                              <b>{item.codigo}</b> {item.nombre}
                            </span>
                            <strong>{sinStock(item.slug) ? 'Sin stock' : `Quedan ${formatoStock(stockDe(item.slug), item.tipo)} · mín. ${formatoStock(umbralAlerta(item.tipo, item.slug), item.tipo)}`}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <button type="button" className="dash-btn dash-btn--salir" onClick={onSalir}>Salir</button>
            <button type="button" className="dash-top__avatar" aria-label="Ajustes" onClick={() => ir('ajustes')}>
              {iniciales(displayName, role)}
              {conteo.alerta > 0 || conteo.sin > 0 ? <span className="dash-top__dot">{alertaItems.length}</span> : null}
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
            {vista === 'reposicion' && <ReposicionView productos={productos} alerta={alertaItems} onCambio={refresh} />}
            {vista === 'importes' && <PeriodosView titulo="Importes" subtitulo="Solo quienes pagaron, con nombre y apellido al lado del precio." total={totalVentas()} anios={periodosVentas()} color="ok" conClientes />}
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
    </PanelContext.Provider>
  )
}
