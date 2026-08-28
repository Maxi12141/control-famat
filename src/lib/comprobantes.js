import { buscarProductoPorNombre } from './catalog.js'
import { fechaHumana, hoyISO, slugify } from './format.js'
import { cantidadItem, itemsPedido, productoDeItemPedido, unidadItem } from './pedidos.js'
import { precioCobroDe } from './precios.js'
import { guardarJSON, leerJSON } from './storage.js'

const KEY_EMPRESA = 'famat_empresa'
const KEY_NUMEROS = 'famat_comprobantes_nros'
const KEY_DOCS = 'famat_comprobantes'
const CUIT_TIPO = '30-71464172-3'
const ITF = {
  0: 'nnwwn',
  1: 'wnnnw',
  2: 'nwnnw',
  3: 'wwnnn',
  4: 'nnwnw',
  5: 'wnwnn',
  6: 'nwwnn',
  7: 'nnnww',
  8: 'wnnwn',
  9: 'nwnwn',
}

export const EMPRESA_VACIA = {
  razonSocial: 'Famat',
  rubro: '',
  domicilio: '',
  telefono: '',
  email: '',
  web: '',
  cuit: CUIT_TIPO,
  ingresosBrutos: `RG ${CUIT_TIPO}`,
  inicioActividades: '10/2014',
  condicionIva: 'IVA Responsable Inscripto',
  puntoVenta: '0001',
}

export const IVA_CLIENTE = [
  { id: 'cf', label: 'Cons. Final' },
  { id: 'exento', label: 'Exento' },
  { id: 'mono', label: 'Monotributo' },
  { id: 'noresp', label: 'No Resp.' },
]

export function leerEmpresa() {
  const data = leerJSON(KEY_EMPRESA, null)
  if (!data || typeof data !== 'object') return { ...EMPRESA_VACIA }
  return { ...EMPRESA_VACIA, ...data }
}

export function guardarEmpresa(empresa) {
  const actual = leerEmpresa()
  const next = {
    razonSocial: String(empresa.razonSocial ?? actual.razonSocial).trim() || 'Famat',
    rubro: String(empresa.rubro ?? actual.rubro).trim(),
    domicilio: String(empresa.domicilio ?? actual.domicilio).trim(),
    telefono: String(empresa.telefono ?? actual.telefono).trim(),
    email: String(empresa.email ?? actual.email).trim(),
    web: String(empresa.web ?? actual.web).trim(),
    cuit: String(empresa.cuit ?? actual.cuit).trim(),
    ingresosBrutos: String(empresa.ingresosBrutos ?? actual.ingresosBrutos).trim(),
    inicioActividades: String(empresa.inicioActividades ?? actual.inicioActividades).trim(),
    condicionIva: String(empresa.condicionIva ?? actual.condicionIva).trim(),
    puntoVenta: String(empresa.puntoVenta ?? actual.puntoVenta).replace(/\D/g, '').slice(0, 4).padStart(4, '0') || '0001',
  }
  guardarJSON(KEY_EMPRESA, next)
  return next
}

function leerNumeros() {
  const data = leerJSON(KEY_NUMEROS, { factura: 0, remito: 0 })
  return {
    factura: Math.max(0, Number(data?.factura) || 0),
    remito: Math.max(0, Number(data?.remito) || 0),
  }
}

export function peekNumero(tipo) {
  return (leerNumeros()[tipo] || 0) + 1
}

export function formatoNumero(puntoVenta, n) {
  const pv = String(puntoVenta || '0001').replace(/\D/g, '').slice(0, 4).padStart(4, '0')
  const num = String(Math.max(1, Number(n) || 1)).padStart(8, '0')
  return `${pv}-${num}`
}

export function lineasDesdePedido(pedido) {
  if (!pedido) return []
  return itemsPedido(pedido).map((item, index) => {
    const slug = productoDeItemPedido(item)
    const producto = buscarProductoPorNombre(item.nombre)
    const precioItem = Number(item.precio ?? item.precio_unitario ?? item.importe) || 0
    return {
      id: `${pedido.id}-${index}`,
      slug,
      codigo: producto?.codigo || '',
      nombre: item.nombre || producto?.nombre || 'Objeto',
      cantidad: cantidadItem(item) || 1,
      unidad: unidadItem(item),
      tipo: item.tipo || producto?.tipo || '',
      precio: precioItem || precioCobroDe(slug) || 0,
    }
  })
}

export function totalLineas(lineas) {
  return lineas.reduce((acc, item) => acc + Number(item.precio || 0) * Number(item.cantidad || 0), 0)
}

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function etiquetaTipoDoc(tipo) {
  return tipo === 'remito' ? 'Remito' : 'Factura B'
}

function emisorDe(empresa) {
  const e = { ...EMPRESA_VACIA, ...empresa }
  const cuit = e.cuit || CUIT_TIPO
  return {
    ...e,
    razonSocial: e.razonSocial || 'Famat',
    cuit,
    ingresosBrutos: e.ingresosBrutos || `RG ${cuit}`,
    inicioActividades: e.inicioActividades || '10/2014',
    condicionIva: e.condicionIva || 'IVA Responsable Inscripto',
  }
}

export function partesFecha(fecha) {
  const raw = String(fecha || '')
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { dia: iso[3], mes: iso[2], anio: iso[1] }
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return { dia: dmy[1].padStart(2, '0'), mes: dmy[2].padStart(2, '0'), anio }
  }
  return { dia: '', mes: '', anio: '' }
}

export function esCuentaCorriente(pago) {
  return /cta\.?\s*cte|cuenta|cr[eé]dito|credito|fiado|debe/i.test(String(pago || ''))
}

function soloDigitos(valor, largo) {
  const d = String(valor || '').replace(/\D/g, '')
  return largo ? d.slice(-largo).padStart(largo, '0') : d
}

function montoAR(valor) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0)
}

function barcodeITF(digits) {
  let data = String(digits).replace(/\D/g, '')
  if (!data) return ''
  if (data.length % 2) data = `0${data}`
  const n = 1
  const w = 2.7
  const h = 44
  let x = 8
  const rects = []
  const bar = (width) => {
    rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${width}" height="${h}" fill="#000"/>`)
    x += width
  }
  const gap = (width) => {
    x += width
  }
  bar(n)
  gap(n)
  bar(n)
  gap(n)
  for (let i = 0; i < data.length; i += 2) {
    const bars = ITF[data[i]] || ITF[0]
    const spaces = ITF[data[i + 1]] || ITF[0]
    for (let j = 0; j < 5; j += 1) {
      bar(bars[j] === 'w' ? w : n)
      gap(spaces[j] === 'w' ? w : n)
    }
  }
  bar(w)
  gap(n)
  bar(n)
  x += 8
  return `<svg class="barcode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x.toFixed(2)} ${h}" preserveAspectRatio="none" style="background:#fff">${rects.join('')}</svg>`
}

function codigoBarras(doc, emp) {
  const { dia, mes, anio } = partesFecha(doc.fecha)
  const [pv, nro] = String(doc.numero || '').split('-')
  return (
    soloDigitos(emp.cuit, 11) +
    '06' +
    soloDigitos(pv || emp.puntoVenta, 4) +
    soloDigitos(nro || doc.nro, 8) +
    `${anio}${mes}${dia}`
  )
}

function chk(on) {
  return `<span class="chk${on ? ' on' : ''}">${on ? '×' : ''}</span>`
}

export function armarComprobante({
  tipo,
  pedido,
  cliente,
  telefono,
  domicilio,
  localidad,
  fecha,
  pago,
  notas,
  lineas,
  empresa,
  ivaCliente,
  cuitCliente,
  remitoNro,
}) {
  const datos = emisorDe(empresa)
  const nro = peekNumero(tipo)
  const numero = formatoNumero(datos.puntoVenta, nro)
  const items = (lineas || []).filter((item) => String(item.nombre || '').trim() && Number(item.cantidad) > 0)
  const dePedido = tipo === 'remito' ? pedido : null
  return {
    tipo,
    numero,
    nro,
    fecha: fechaHumana(fecha || hoyISO()),
    cliente: cliente || dePedido?.cliente || '',
    telefono: telefono || dePedido?.telefono || '',
    domicilio: domicilio || '',
    localidad: localidad || '',
    pago: pago || (tipo === 'remito' ? dePedido?.metodoPago || '' : ''),
    notas: notas || (tipo === 'remito' ? dePedido?.notas || '' : ''),
    ivaCliente: ivaCliente || 'cf',
    cuitCliente: cuitCliente || '',
    remitoNro: String(remitoNro || '').trim(),
    pedidoId: tipo === 'remito' && dePedido?.id ? String(dePedido.id) : '',
    lineas: items,
    total: totalLineas(items),
    empresa: datos,
  }
}

function filasLineas(doc, { unidad = false, minFilas = 18 } = {}) {
  const items = (doc.lineas || []).filter(Boolean)
  const celda = (texto, extra = '') => `<td class="${extra}"><span>${esc(texto)}</span></td>`
  const filas = items.map((item) => {
    const detalle = `${item.codigo ? `${item.codigo} · ` : ''}${item.nombre}${unidad && item.unidad ? ` (${item.unidad})` : ''}`
    const importe = Number(item.precio || 0) * Number(item.cantidad || 0)
    return `<tr class="item">${celda(item.cantidad, 'cant')}${celda(detalle, 'desc')}${celda(montoAR(item.precio), 'num')}${celda(montoAR(importe), 'num')}</tr>`
  })
  if (!filas.length) filas.push('<tr><td colspan="4" class="vacio"><span>Sin ítems</span></td></tr>')
  while (filas.length < minFilas) {
    filas.push(`<tr class="blank">${celda(' ', 'cant')}${celda(' ', 'desc')}${celda(' ', 'num')}${celda(' ', 'num')}</tr>`)
  }
  return filas.join('')
}

function htmlShell(titulo, css, cuerpo) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only" />
  <title>${esc(titulo)}</title>
  <style>
    :root{color-scheme:only light}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#fff!important;color:#000!important;color-scheme:only light}
    ${css}
  </style>
</head>
<body>
  ${cuerpo}
</body>
</html>`
}

function htmlRemito(doc) {
  const emp = emisorDe(doc.empresa)
  const css = `
    body{font-family:Segoe UI,Arial,sans-serif;color:#132033;background:#fff;padding:18px}
    .hoja{max-width:800px;margin:0 auto;border:1.5px solid #0b3a56;padding:22px 24px 18px}
    .top{display:grid;grid-template-columns:1.4fr .9fr;gap:16px;border-bottom:2px solid #0b3a56;padding-bottom:14px;margin-bottom:16px}
    .marca{font-size:28px;font-weight:800;letter-spacing:-.04em;color:#0b3a56;line-height:1}
    .emp p{margin-top:4px;font-size:13px;color:#334155}
    .caja{border:1.5px solid #0b3a56;text-align:center;padding:10px 12px}
    .caja span{display:block;letter-spacing:.12em;font-size:11px;font-weight:700;color:#0f766e}
    .caja strong{display:block;font-size:22px;margin:4px 0 2px}
    .caja small{color:#475569;font-size:12px}
    .cli{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin-bottom:16px;font-size:13px}
    .cli b{color:#0b3a56}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12.5px}
    col.cant{width:12mm}
    col.desc{width:auto}
    col.pu,col.imp{width:28mm}
    th{background:#0b3a56;color:#fff;text-align:left;padding:5px 8px;font-weight:700}
    th.cant,td.cant{text-align:center;width:12mm}
    th.num,td.num{text-align:right;white-space:nowrap}
    td{border-bottom:1px solid #e2e8f0;padding:6px 8px;vertical-align:middle;line-height:1.35;height:auto}
    tr.blank td{height:22px;padding:6px 8px}
    tfoot td{background:#0b3a56;color:#fff;font-weight:800;border-bottom:0}
    .notas{margin-top:14px;font-size:12px;color:#334155}
    .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
    .firmas p{border-top:1px solid #334155;padding-top:8px;text-align:center;font-size:12px}
    .pie{margin-top:22px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}
    @media print{body{padding:0}.hoja{max-width:none}}
  `
  const cuerpo = `
  <div class="hoja">
    <div class="top">
      <div class="emp">
        <div class="marca">${esc(emp.razonSocial)}</div>
        ${emp.domicilio ? `<p>${esc(emp.domicilio)}</p>` : ''}
        ${emp.cuit ? `<p>CUIT ${esc(emp.cuit)}</p>` : ''}
        ${emp.condicionIva ? `<p>${esc(emp.condicionIva)}</p>` : ''}
        ${emp.telefono ? `<p>Tel. ${esc(emp.telefono)}</p>` : ''}
      </div>
      <div class="caja">
        <span>REMITO</span>
        <strong>N° ${esc(doc.numero)}</strong>
        <small>Fecha ${esc(doc.fecha)}</small>
      </div>
    </div>
    <div class="cli">
      <p><b>Cliente:</b> ${esc(doc.cliente || '—')}</p>
      <p><b>Teléfono:</b> ${esc(doc.telefono || '—')}</p>
      <p><b>Domicilio:</b> ${esc(doc.domicilio || '—')}</p>
      <p><b>Entrega:</b> ${esc(doc.pago || '—')}</p>
    </div>
    <table>
      <colgroup><col class="cant"><col class="desc"><col class="pu"><col class="imp"></colgroup>
      <thead>
        <tr>
          <th class="cant">Cant.</th>
          <th>Detalle</th>
          <th class="num">P. unitario</th>
          <th class="num">Importe</th>
        </tr>
      </thead>
      <tbody>${filasLineas(doc, { minFilas: 16 })}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">TOTAL</td>
          <td class="num">${esc(montoAR(doc.total))}</td>
        </tr>
      </tfoot>
    </table>
    ${doc.notas ? `<p class="notas"><b>Observaciones:</b> ${esc(doc.notas)}</p>` : ''}
    <div class="firmas"><p>Entregó</p><p>Recibí conforme</p></div>
    <p class="pie">Documento generado por Controlador Famat${doc.pedidoId ? ` · Pedido ${esc(doc.pedidoId)}` : ''}.</p>
  </div>`
  return htmlShell(`Remito ${doc.numero} · ${emp.razonSocial}`, css, cuerpo)
}

function htmlFacturaB(doc) {
  const emp = emisorDe(doc.empresa)
  const { dia, mes, anio } = partesFecha(doc.fecha)
  const [pv, nro] = String(doc.numero || '').split('-')
  const iva = doc.ivaCliente || 'cf'
  const ctaCte = esCuentaCorriente(doc.pago)
  const barras = codigoBarras(doc, emp)
  const css = `
    @page{size:A4;margin:8mm}
    html,body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff!important;color-scheme:only light;width:210mm;height:297mm;overflow:hidden}
    .fb{width:190mm;height:277mm;min-height:277mm;max-height:277mm;margin:10mm auto;border:1.6px solid #000;background:#fff;color:#000;display:flex;flex-direction:column;overflow:hidden;page-break-inside:avoid}
    .head{display:grid;grid-template-columns:1fr 78px 1fr;min-height:42mm;border-bottom:1.6px solid #111}
    .emi{padding:8px 10px 8px 12px;font-size:11px;line-height:1.35}
    .emi .nom{font-size:18px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px}
    .emi p{margin:1px 0}
    .emi .iva{margin-top:8px;font-size:11px;font-weight:700}
    .letra{border-left:1.6px solid #111;border-right:1.6px solid #111;display:flex;flex-direction:column;align-items:center;padding:8px 4px 0}
    .b{width:52px;height:48px;border:2.2px solid #111;font-size:38px;font-weight:800;display:grid;place-items:center;line-height:1;margin-top:2px}
    .cod{border:1.4px solid #111;margin-top:5px;padding:2px 5px;font-size:9px;font-weight:700;white-space:nowrap}
    .doc{padding:8px 12px 8px 10px}
    .doc .tit{font-size:22px;font-weight:800;letter-spacing:.06em;line-height:1;text-align:right}
    .doc .nro{font-size:13px;font-weight:700;margin:6px 0 8px;text-align:right}
    .fecha{display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-bottom:8px;font-size:10px;font-weight:700}
    .fecha b{border:1.3px solid #111;min-width:28px;height:22px;padding:0 5px;display:grid;place-items:center;font-size:12px;font-weight:700}
    .fecha b.anio{min-width:42px}
    .fisc{font-size:11px;line-height:1.45}
    .cli{padding:8px 12px 10px;border-bottom:1.6px solid #111;font-size:12px}
    .fila{display:flex;align-items:center;gap:8px;margin:6px 0}
    .fila label{font-weight:700;white-space:nowrap}
    .dots{border-bottom:1px dotted #111;flex:1;min-height:18px;padding:2px 4px 3px;font-weight:600;line-height:1.35}
    .dots.short{flex:0 0 38%}
    .checks{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:11px}
    .chk{display:inline-flex;width:15px;height:15px;border:1.2px solid #111;margin-right:4px;align-items:center;justify-content:center;font-size:12px;font-weight:800;line-height:15px;vertical-align:middle;box-sizing:border-box}
    .cuerpo{flex:1;display:flex;min-height:0;overflow:hidden}
    .lado{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;font-weight:700;letter-spacing:.12em;padding:10px 3px;border-right:1.4px solid #111;display:grid;place-items:center;white-space:nowrap}
    .tabla-box{flex:1;min-width:0;display:flex;flex-direction:column;overflow:visible}
    table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px;background:#fff;height:auto}
    th{background:#eee8e0;color:#000;border:0;border-bottom:1.5px solid #000;border-right:1px solid #111;padding:7px 6px;font-size:10px;font-weight:800;letter-spacing:.04em;text-align:center;line-height:14px}
    td{border:0;border-right:1px solid #c9c3ba;border-bottom:1px dotted #c9c3ba;background:#fff;color:#000;padding:0 6px;vertical-align:middle;overflow:visible}
    td span{display:block;padding:5px 0 6px;line-height:18px;overflow:visible}
    tr.blank td span{min-height:22px;padding:0;line-height:22px}
    th:last-child,td:last-child{border-right:0}
    td.vacio{text-align:center;color:#666;border-bottom:0}
    td.cant,th.cant{text-align:center;width:12mm}
    td.desc{text-align:left}
    td.num,th.num{text-align:right;white-space:nowrap}
    col.cant{width:12mm}
    col.desc{width:auto}
    col.pu,col.imp{width:28mm}
    .resto{flex:1 1 auto;min-height:8px;border-top:0;position:relative;background:repeating-linear-gradient(to bottom,#fff 0 21px,#d8d3cb 21px 22px)}
    .resto:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(#c9c3ba,#c9c3ba) 12mm 0/1px 100% no-repeat,linear-gradient(#c9c3ba,#c9c3ba) calc(100% - 56mm) 0/1px 100% no-repeat,linear-gradient(#c9c3ba,#c9c3ba) calc(100% - 28mm) 0/1px 100% no-repeat}
    .pie{border-top:1.6px solid #111;padding:8px 12px 10px;flex:none;page-break-inside:avoid;break-inside:avoid}
    .ley{font-size:9.5px;font-style:italic;margin-bottom:8px}
    .pie-row{display:grid;grid-template-columns:1fr 58mm;gap:12px;align-items:end}
    .barcode{width:100%;height:42px;display:block}
    .codnro{letter-spacing:.04em;text-align:center;font-size:10px;margin-top:3px}
    .total{border:1.6px solid #111;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-weight:800;min-height:42px}
    .total span{font-size:13px}
    .total b{font-size:16px}
    .obs{font-size:10px;color:#333;margin-top:6px}
    @media print{
      html,body,.fb{background:#fff!important;color:#000!important}
      body,.resto{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{width:auto;height:auto;overflow:visible}
      .fb{width:auto;height:277mm;min-height:277mm;max-height:277mm;overflow:hidden;margin:0}
    }
  `
  const cuerpo = `
  <div class="fb">
    <div class="head">
      <div class="emi">
        <div class="nom">${esc(emp.razonSocial)}</div>
        ${emp.rubro ? `<p>${esc(emp.rubro)}</p>` : ''}
        ${emp.domicilio ? `<p>${esc(emp.domicilio)}</p>` : ''}
        ${emp.telefono ? `<p>Tel. ${esc(emp.telefono)}</p>` : ''}
        ${emp.email ? `<p>e-mail ${esc(emp.email)}</p>` : ''}
        ${emp.web ? `<p>Web ${esc(emp.web)}</p>` : ''}
        <p class="iva">${esc(emp.condicionIva)}</p>
      </div>
      <div class="letra">
        <div class="b">B</div>
        <div class="cod">Código Nº 06</div>
      </div>
      <div class="doc">
        <div class="tit">FACTURA</div>
        <div class="nro">Nº ${esc(pv || '0001')} - ${esc(nro || '00000000')}</div>
        <div class="fecha">
          <span>FECHA</span>
          <b>${esc(dia)}</b>
          <b>${esc(mes)}</b>
          <b class="anio">${esc(anio)}</b>
        </div>
        <div class="fisc">
          <p>C.U.I.T.: ${esc(emp.cuit)}</p>
          <p>INGR. BRUTOS: ${esc(emp.ingresosBrutos)}</p>
          <p>INICIO DE ACT.: ${esc(emp.inicioActividades)}</p>
        </div>
      </div>
    </div>
    <div class="cli">
      <div class="fila"><label>Señor/es:</label><span class="dots">${esc(doc.cliente)}</span></div>
      <div class="fila">
        <label>Dirección:</label><span class="dots">${esc(doc.domicilio)}</span>
        <label>Localidad:</label><span class="dots short">${esc(doc.localidad)}</span>
      </div>
      <div class="fila">
        <label>I.V.A.</label>
        <div class="checks">
          <span>${chk(iva === 'cf')}Cons. Final</span>
          <span>${chk(iva === 'exento')}Exento.</span>
          <span>${chk(iva === 'mono')}Monotributo</span>
          <span>${chk(iva === 'noresp')}No Resp.</span>
        </div>
        <label>C.U.I.T.:</label><span class="dots short">${esc(doc.cuitCliente)}</span>
      </div>
      <div class="fila">
        <label>Condiciones de Venta</label>
        <div class="checks">
          <span>${chk(!ctaCte)}Contado</span>
          <span>${chk(ctaCte)}Cta. Cte.</span>
        </div>
        <label>Remito Nº</label><span class="dots short">${esc(doc.remitoNro)}</span>
      </div>
    </div>
    <div class="cuerpo">
      <div class="lado">ORIGINAL BLANCO · DUPLICADO COLOR</div>
      <div class="tabla-box">
        <table>
          <colgroup><col class="cant"><col class="desc"><col class="pu"><col class="imp"></colgroup>
          <thead>
            <tr>
              <th>CANT.</th>
              <th>DESCRIPCIÓN</th>
              <th class="num">P. UNITARIO</th>
              <th class="num">IMPORTE</th>
            </tr>
          </thead>
          <tbody>${filasLineas(doc, { unidad: true, minFilas: 12 })}</tbody>
        </table>
        <div class="resto" aria-hidden="true"></div>
      </div>
    </div>
    <div class="pie">
      <p class="ley">147 “Teléfono Gratuito CABA, Área de Defensa y Protección al Consumidor”.</p>
      <div class="pie-row">
        <div>
          ${barcodeITF(barras)}
          <div class="codnro">${esc(barras)}</div>
        </div>
        <div class="total">
          <span>TOTAL $</span>
          <b>${esc(montoAR(doc.total))}</b>
        </div>
      </div>
      ${doc.notas ? `<p class="obs">${esc(doc.notas)}</p>` : ''}
    </div>
  </div>`
  return htmlShell(`Factura B ${doc.numero} · ${emp.razonSocial}`, css, cuerpo)
}

export function htmlComprobante(doc) {
  return doc.tipo === 'remito' ? htmlRemito(doc) : htmlFacturaB(doc)
}

export function registrarEmision(doc) {
  const nums = leerNumeros()
  nums[doc.tipo] = Math.max(nums[doc.tipo] || 0, Number(doc.nro) || 0)
  guardarJSON(KEY_NUMEROS, nums)
  const lista = leerJSON(KEY_DOCS, [])
  const row = {
    id: `${doc.tipo}_${doc.numero}_${Date.now()}`,
    tipo: doc.tipo,
    numero: doc.numero,
    fecha: doc.fecha,
    cliente: doc.cliente,
    total: doc.total,
    pedidoId: doc.pedidoId,
  }
  guardarJSON(KEY_DOCS, [row, ...(Array.isArray(lista) ? lista : [])].slice(0, 80))
  return row
}

function nombreArchivoPdf(doc) {
  const tipo = doc.tipo === 'remito' ? 'Remito' : 'Factura'
  const nombre = (slugify(doc.cliente) || 'sin-nombre')
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('-') || 'Sin-nombre'
  const { dia, mes, anio } = partesFecha(doc.fecha)
  const fecha = dia && mes && anio ? `${dia}-${mes}-${anio}` : String(doc.fecha || '').replace(/\//g, '-') || hoyISO()
  return `${tipo}-${nombre}-${fecha}.pdf`
}

function segmentosITF(digits) {
  let data = String(digits || '').replace(/\D/g, '')
  if (!data) return []
  if (data.length % 2) data = `0${data}`
  const n = 1
  const w = 2.7
  const segs = []
  const bar = (ancho) => segs.push({ bar: true, w: ancho })
  const gap = (ancho) => segs.push({ bar: false, w: ancho })
  bar(n)
  gap(n)
  bar(n)
  gap(n)
  for (let i = 0; i < data.length; i += 2) {
    const bars = ITF[data[i]] || ITF[0]
    const spaces = ITF[data[i + 1]] || ITF[0]
    for (let j = 0; j < 5; j += 1) {
      bar(bars[j] === 'w' ? w : n)
      gap(spaces[j] === 'w' ? w : n)
    }
  }
  bar(w)
  gap(n)
  bar(n)
  return segs
}

function dibujarITF(pdf, digits, x, y, maxW, alto) {
  const segs = segmentosITF(digits)
  if (!segs.length) return
  const total = segs.reduce((acc, s) => acc + s.w, 0)
  const k = maxW / total
  let cx = x
  pdf.setFillColor(0, 0, 0)
  for (const s of segs) {
    const ww = s.w * k
    if (s.bar) pdf.rect(cx, y, Math.max(0.12, ww), alto, 'F')
    cx += ww
  }
}

function campoPunteado(pdf, label, valor, x, y, maxX) {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(label, x, y)
  const lx = x + pdf.getTextWidth(label) + 1.6
  pdf.setDrawColor(30)
  pdf.setLineWidth(0.2)
  pdf.setLineDashPattern([0.45, 0.65], 0)
  pdf.line(lx, y + 0.7, maxX, y + 0.7)
  pdf.setLineDashPattern([], 0)
  pdf.setDrawColor(0)
  if (valor) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    const maxW = Math.max(6, maxX - lx - 1)
    const lineas = pdf.splitTextToSize(String(valor), maxW)
    pdf.text(lineas[0] || '', lx + 0.8, y)
  }
}

function casilla(pdf, on, label, x, y) {
  const s = 3.6
  pdf.setLineWidth(0.32)
  pdf.setDrawColor(0)
  pdf.rect(x, y - s + 0.5, s, s)
  if (on) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.2)
    pdf.text('X', x + s / 2, y - 0.55, { align: 'center' })
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(label, x + s + 1.2, y)
  return x + s + 1.2 + pdf.getTextWidth(label) + 4.5
}

function dibujarFacturaBPdf(pdf, doc) {
  const emp = emisorDe(doc.empresa)
  const { dia, mes, anio } = partesFecha(doc.fecha)
  const [pv, nro] = String(doc.numero || '').split('-')
  const iva = doc.ivaCliente || 'cf'
  const ctaCte = esCuentaCorriente(doc.pago)
  const x0 = 10
  const y0 = 10
  const w = 190
  const h = 277
  const xFin = x0 + w

  pdf.setDrawColor(0)
  pdf.setLineWidth(0.45)
  pdf.rect(x0, y0, w, h)

  const headH = 46
  const xLetra = x0 + 74
  const wLetra = 24
  const xDer = xLetra + wLetra
  pdf.line(xLetra, y0, xLetra, y0 + headH)
  pdf.line(xDer, y0, xDer, y0 + headH)
  pdf.line(x0, y0 + headH, xFin, y0 + headH)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(emp.razonSocial || 'Famat', x0 + 4, y0 + 9)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  let ey = y0 + 14.5
  const emi = [
    emp.rubro,
    emp.domicilio,
    emp.telefono ? `Tel. ${emp.telefono}` : '',
    emp.email ? `e-mail ${emp.email}` : '',
    emp.web ? `Web ${emp.web}` : '',
  ].filter(Boolean)
  for (const linea of emi) {
    const parts = pdf.splitTextToSize(linea, xLetra - x0 - 8)
    pdf.text(parts[0] || '', x0 + 4, ey)
    ey += 4
  }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text(emp.condicionIva || '', x0 + 4, y0 + headH - 5)

  const bx = xLetra + (wLetra - 16) / 2
  const by = y0 + 6
  pdf.setLineWidth(0.7)
  pdf.rect(bx, by, 16, 15.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text('B', bx + 8, by + 12, { align: 'center' })
  pdf.setLineWidth(0.4)
  pdf.setFontSize(6.2)
  const codW = 21
  const codX = xLetra + (wLetra - codW) / 2
  pdf.rect(codX, by + 17.5, codW, 5.8)
  pdf.text('Código Nº 06', xLetra + wLetra / 2, by + 21.5, { align: 'center' })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('FACTURA', xFin - 4, y0 + 10, { align: 'right' })
  pdf.setFontSize(11)
  pdf.text(`Nº ${pv || '0001'} - ${nro || '00000000'}`, xFin - 4, y0 + 17.5, { align: 'right' })

  const fechaY = y0 + 21.5
  const boxW = 10
  const anioW = 14
  pdf.setFontSize(7.5)
  const cajas = [
    [dia, boxW],
    [mes, boxW],
    [anio, anioW],
  ]
  const fechaAncho = boxW + 1.4 + boxW + 1.4 + anioW
  let fx = xFin - 4 - fechaAncho
  pdf.text('FECHA', fx - 13, fechaY + 4.8)
  for (const [txt, bw] of cajas) {
    pdf.rect(fx, fechaY, bw, 6.6)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(String(txt || ''), fx + bw / 2, fechaY + 4.7, { align: 'center' })
    fx += bw + 1.4
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  let fy = y0 + 33.5
  pdf.text(`C.U.I.T.: ${emp.cuit || ''}`, xDer + 4, fy)
  fy += 4.3
  pdf.text(`INGR. BRUTOS: ${emp.ingresosBrutos || ''}`, xDer + 4, fy)
  fy += 4.3
  pdf.text(`INICIO DE ACT.: ${emp.inicioActividades || ''}`, xDer + 4, fy)

  const cy = y0 + headH
  campoPunteado(pdf, 'Señor/es:', doc.cliente, x0 + 4, cy + 8, xFin - 4)
  campoPunteado(pdf, 'Dirección:', doc.domicilio, x0 + 4, cy + 16.5, x0 + 118)
  campoPunteado(pdf, 'Localidad:', doc.localidad, x0 + 121, cy + 16.5, xFin - 4)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('I.V.A.', x0 + 4, cy + 25)
  let ix = x0 + 16
  ix = casilla(pdf, iva === 'cf', 'Cons. Final', ix, cy + 25)
  ix = casilla(pdf, iva === 'exento', 'Exento.', ix, cy + 25)
  ix = casilla(pdf, iva === 'mono', 'Monotributo', ix, cy + 25)
  casilla(pdf, iva === 'noresp', 'No Resp.', ix, cy + 25)
  campoPunteado(pdf, 'C.U.I.T.:', doc.cuitCliente, x0 + 128, cy + 25, xFin - 4)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('Condiciones de Venta', x0 + 4, cy + 33.5)
  let vx = x0 + 4 + pdf.getTextWidth('Condiciones de Venta') + 4
  vx = casilla(pdf, !ctaCte, 'Contado', vx, cy + 33.5)
  casilla(pdf, ctaCte, 'Cta. Cte.', vx, cy + 33.5)
  campoPunteado(pdf, 'Remito Nº', doc.remitoNro, x0 + 128, cy + 33.5, xFin - 4)

  const clientBottom = cy + 40
  pdf.setLineWidth(0.45)
  pdf.line(x0, clientBottom, xFin, clientBottom)

  const pieH = 50
  const pieY = y0 + h - pieH
  pdf.line(x0, pieY, xFin, pieY)

  const ladoW = 7
  pdf.line(x0 + ladoW, clientBottom, x0 + ladoW, pieY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6)
  const ladoTxt = 'ORIGINAL BLANCO / DUPLICADO COLOR'
  const ladoLen = pdf.getTextWidth(ladoTxt)
  pdf.text(ladoTxt, x0 + 2.7, (clientBottom + pieY) / 2 + ladoLen / 2, { angle: 90 })

  const tx = x0 + ladoW
  const tw = w - ladoW
  const cols = [
    { key: 'cant', w: 16, title: 'CANT.', align: 'center' },
    { key: 'desc', w: tw - 80, title: 'DESCRIPCIÓN', align: 'left' },
    { key: 'pu', w: 32, title: 'P. UNITARIO', align: 'right' },
    { key: 'imp', w: 32, title: 'IMPORTE', align: 'right' },
  ]
  const th = 7.4
  pdf.setFillColor(238, 232, 224)
  pdf.rect(tx, clientBottom, tw, th, 'F')
  pdf.setDrawColor(0)
  pdf.setLineWidth(0.35)
  pdf.rect(tx, clientBottom, tw, th)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  let colX = tx
  for (const col of cols) {
    const px = col.align === 'center' ? colX + col.w / 2 : col.align === 'right' ? colX + col.w - 2 : colX + 2
    pdf.text(col.title, px, clientBottom + 4.9, { align: col.align })
    colX += col.w
    if (colX < tx + tw - 0.2) pdf.line(colX, clientBottom, colX, pieY)
  }

  const items = (doc.lineas || []).filter((item) => String(item?.nombre || '').trim())
  const espacio = pieY - (clientBottom + th)
  const minFilas = 12
  const filas = Math.max(items.length, minFilas)
  const rowH = Math.min(8.4, espacio / filas)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  for (let i = 0; i < filas; i += 1) {
    const ry = clientBottom + th + i * rowH
    pdf.setDrawColor(170)
    pdf.setLineWidth(0.18)
    pdf.setLineDashPattern([0.55, 0.7], 0)
    pdf.line(tx, ry + rowH, tx + tw, ry + rowH)
    pdf.setLineDashPattern([], 0)
    pdf.setDrawColor(0)
    const item = items[i]
    if (!item) continue
    const detalle = `${item.codigo ? `${item.codigo} - ` : ''}${item.nombre}${item.unidad ? ` (${item.unidad})` : ''}`
    const importe = Number(item.precio || 0) * Number(item.cantidad || 0)
    const vals = [String(item.cantidad ?? ''), detalle, montoAR(item.precio), montoAR(importe)]
    let vx2 = tx
    const base = ry + rowH * 0.62
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(0)
    for (let c = 0; c < cols.length; c += 1) {
      const col = cols[c]
      let txt = vals[c]
      if (col.key === 'desc') {
        const parts = pdf.splitTextToSize(txt, col.w - 3.5)
        txt = parts[0] || ''
      }
      const px = col.align === 'center' ? vx2 + col.w / 2 : col.align === 'right' ? vx2 + col.w - 2 : vx2 + 2
      pdf.text(txt, px, base, { align: col.align })
      vx2 += col.w
    }
  }

  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(7.4)
  pdf.setTextColor(0)
  pdf.text('147 "Teléfono Gratuito CABA, Área de Defensa y Protección al Consumidor".', x0 + 4, pieY + 6.5)

  const barras = codigoBarras(doc, emp)
  dibujarITF(pdf, barras, x0 + 4, pieY + 10, 112, 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.4)
  pdf.text(barras, x0 + 60, pieY + 30.5, { align: 'center' })

  const totX = xFin - 58
  const totY = pieY + 10
  pdf.setLineWidth(0.5)
  pdf.rect(totX, totY, 54, 18)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('TOTAL $', totX + 3.5, totY + 11.5)
  pdf.setFontSize(13)
  pdf.text(montoAR(doc.total), totX + 50.5, totY + 11.5, { align: 'right' })

  if (doc.notas) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    const notas = pdf.splitTextToSize(String(doc.notas), w - 10)
    pdf.text(notas[0] || '', x0 + 4, pieY + 38)
  }
}

function dibujarRemitoPdf(pdf, doc) {
  const emp = emisorDe(doc.empresa)
  const x0 = 14
  const y0 = 14
  const w = 182
  pdf.setDrawColor(11, 58, 86)
  pdf.setLineWidth(0.5)
  pdf.rect(x0, y0, w, 269)

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(11, 58, 86)
  pdf.setFontSize(22)
  pdf.text(emp.razonSocial || 'Famat', x0 + 8, y0 + 14)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(40)
  let ey = y0 + 20
  for (const linea of [emp.domicilio, emp.cuit ? `CUIT ${emp.cuit}` : '', emp.condicionIva, emp.telefono ? `Tel. ${emp.telefono}` : ''].filter(Boolean)) {
    pdf.text(linea, x0 + 8, ey)
    ey += 4.5
  }

  const cajaX = x0 + w - 68
  pdf.setDrawColor(11, 58, 86)
  pdf.rect(cajaX, y0 + 6, 58, 28)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(15, 118, 110)
  pdf.text('REMITO', cajaX + 29, y0 + 13, { align: 'center' })
  pdf.setTextColor(11, 58, 86)
  pdf.setFontSize(14)
  pdf.text(`Nº ${doc.numero || ''}`, cajaX + 29, y0 + 21, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(60)
  pdf.text(`Fecha ${doc.fecha || ''}`, cajaX + 29, y0 + 28, { align: 'center' })

  pdf.setDrawColor(11, 58, 86)
  pdf.setLineWidth(0.6)
  pdf.line(x0 + 8, y0 + 40, x0 + w - 8, y0 + 40)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(11, 58, 86)
  pdf.text('Cliente:', x0 + 8, y0 + 48)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(20)
  pdf.text(String(doc.cliente || '—'), x0 + 26, y0 + 48)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(11, 58, 86)
  pdf.text('Teléfono:', x0 + 100, y0 + 48)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(20)
  pdf.text(String(doc.telefono || '—'), x0 + 122, y0 + 48)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(11, 58, 86)
  pdf.text('Domicilio:', x0 + 8, y0 + 55)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(20)
  pdf.text(String(doc.domicilio || '—'), x0 + 30, y0 + 55)

  const tx = x0 + 8
  const tw = w - 16
  const ty = y0 + 62
  const cols = [
    { w: 18, title: 'Cant.', align: 'center' },
    { w: tw - 82, title: 'Detalle', align: 'left' },
    { w: 32, title: 'P. unitario', align: 'right' },
    { w: 32, title: 'Importe', align: 'right' },
  ]
  pdf.setFillColor(11, 58, 86)
  pdf.rect(tx, ty, tw, 8, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(255)
  let cx = tx
  for (const col of cols) {
    const px = col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 2 : cx + 2
    pdf.text(col.title, px, ty + 5.4, { align: col.align })
    cx += col.w
  }

  const items = (doc.lineas || []).filter(Boolean)
  const rowH = 8
  pdf.setTextColor(0)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const filas = Math.max(items.length, 12)
  for (let i = 0; i < filas; i += 1) {
    const ry = ty + 8 + i * rowH
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.2)
    pdf.line(tx, ry + rowH, tx + tw, ry + rowH)
    const item = items[i]
    if (!item) continue
    const detalle = `${item.codigo ? `${item.codigo} · ` : ''}${item.nombre || ''}`
    const importe = Number(item.precio || 0) * Number(item.cantidad || 0)
    const vals = [String(item.cantidad ?? ''), detalle, montoAR(item.precio), montoAR(importe)]
    let vx = tx
    pdf.setTextColor(20)
    for (let c = 0; c < cols.length; c += 1) {
      const col = cols[c]
      let txt = vals[c]
      if (c === 1) txt = (pdf.splitTextToSize(txt, col.w - 3)[0] || '')
      const px = col.align === 'center' ? vx + col.w / 2 : col.align === 'right' ? vx + col.w - 2 : vx + 2
      pdf.text(txt, px, ry + 5.5, { align: col.align })
      vx += col.w
    }
  }

  const footY = ty + 8 + filas * rowH
  pdf.setFillColor(11, 58, 86)
  pdf.rect(tx, footY, tw, 9, 'F')
  pdf.setTextColor(255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('TOTAL', tx + 3, footY + 6)
  pdf.text(montoAR(doc.total), tx + tw - 3, footY + 6, { align: 'right' })

  pdf.setTextColor(40)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (doc.notas) pdf.text(`Observaciones: ${doc.notas}`, tx, footY + 16)
  pdf.setDrawColor(51, 65, 85)
  pdf.line(tx + 8, footY + 42, tx + 70, footY + 42)
  pdf.line(tx + tw - 70, footY + 42, tx + tw - 8, footY + 42)
  pdf.setFontSize(8)
  pdf.text('Entregó', tx + 39, footY + 47, { align: 'center' })
  pdf.text('Recibí conforme', tx + tw - 39, footY + 47, { align: 'center' })
}

export async function armarPdfBlob(doc) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  pdf.setProperties({
    title: `${etiquetaTipoDoc(doc.tipo)} ${doc.numero}`,
    subject: doc.cliente || '',
    creator: 'Control Famat',
  })
  if (doc.tipo === 'remito') dibujarRemitoPdf(pdf, doc)
  else dibujarFacturaBPdf(pdf, doc)
  return pdf.output('blob')
}

export async function descargarPdf(doc) {
  const blob = await armarPdfBlob(doc)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivoPdf(doc)
  enlace.rel = 'noopener'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function imprimirHtml(doc) {
  const html = htmlComprobante(doc)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  const target = iframe.contentDocument
  if (!win || !target) {
    iframe.remove()
    throw new Error('No se pudo abrir la impresión.')
  }
  target.open()
  target.write(html)
  target.close()
  const lanzar = () => {
    try {
      win.focus()
      win.print()
    } finally {
      setTimeout(() => iframe.remove(), 1200)
    }
  }
  if (target.readyState === 'complete') setTimeout(lanzar, 80)
  else iframe.onload = () => setTimeout(lanzar, 80)
}
