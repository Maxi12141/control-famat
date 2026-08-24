import { buscarProductoPorNombre } from './catalog.js'
import { fechaHumana, hoyISO } from './format.js'
import { cantidadItem, itemsPedido, productoDeItemPedido, unidadItem } from './pedidos.js'
import { precioDe } from './precios.js'
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
      nombre: item.nombre || producto?.nombre || 'Ítem',
      cantidad: cantidadItem(item) || 1,
      unidad: unidadItem(item),
      precio: precioItem || precioDe(slug).venta || 0,
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
  return `<span class="chk${on ? ' on' : ''}"></span>`
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
}) {
  const datos = emisorDe(empresa)
  const nro = peekNumero(tipo)
  const numero = formatoNumero(datos.puntoVenta, nro)
  const items = (lineas || []).filter((item) => item.nombre && Number(item.cantidad) > 0)
  return {
    tipo,
    numero,
    nro,
    fecha: fechaHumana(fecha || hoyISO()),
    cliente: cliente || pedido?.cliente || '',
    telefono: telefono || pedido?.telefono || '',
    domicilio: domicilio || '',
    localidad: localidad || '',
    pago: pago || pedido?.metodoPago || '',
    notas: notas || pedido?.notas || '',
    ivaCliente: ivaCliente || 'cf',
    cuitCliente: cuitCliente || '',
    pedidoId: pedido?.id ? String(pedido.id) : '',
    lineas: items,
    total: totalLineas(items),
    empresa: datos,
  }
}

function filasRemito(doc) {
  if (!doc.lineas.length) {
    return '<tr><td colspan="3" style="padding:12px;color:#64748b;text-align:center">Sin ítems</td></tr>'
  }
  return doc.lineas
    .map((item) => {
      const cant = `${item.cantidad} ${item.unidad || ''}`.trim()
      const detalle = `${item.codigo ? `${item.codigo} · ` : ''}${item.nombre}`
      return `<tr>
        <td>${esc(cant)}</td>
        <td>${esc(detalle)}</td>
        <td>${esc(item.unidad || '')}</td>
      </tr>`
    })
    .join('')
}

function filasFacturaB(doc) {
  const items = (doc.lineas || []).filter(Boolean)
  if (!items.length) {
    return '<tr><td colspan="4" class="vacio">Sin ítems</td></tr>'
  }
  return items
    .map((item) => {
      const detalle = `${item.codigo ? `${item.codigo} · ` : ''}${item.nombre}${item.unidad ? ` (${item.unidad})` : ''}`
      const importe = Number(item.precio || 0) * Number(item.cantidad || 0)
      return `<tr>
        <td class="cant">${esc(item.cantidad)}</td>
        <td>${esc(detalle)}</td>
        <td class="num">${esc(montoAR(item.precio))}</td>
        <td class="num">${esc(montoAR(importe))}</td>
      </tr>`
    })
    .join('')
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
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#0b3a56;color:#fff;text-align:left;padding:8px 10px;font-weight:700}
    td{border-bottom:1px solid #e2e8f0;padding:8px 10px;vertical-align:top}
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
      <thead>
        <tr><th>Cant.</th><th>Detalle</th><th>Unidad</th></tr>
      </thead>
      <tbody>${filasRemito(doc)}</tbody>
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
    html,body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff!important;color-scheme:only light}
    .fb{width:190mm;max-width:100%;margin:0 auto;border:1.6px solid #000;background:#fff;color:#000;display:flex;flex-direction:column;min-height:277mm}
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
    .fila{display:flex;align-items:flex-end;gap:8px;margin:5px 0}
    .fila label{font-weight:700;white-space:nowrap}
    .dots{border-bottom:1px dotted #111;flex:1;min-height:16px;padding:0 4px 1px;font-weight:600}
    .dots.short{flex:0 0 38%}
    .checks{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:11px}
    .chk{display:inline-block;width:11px;height:11px;border:1.2px solid #111;margin-right:4px;vertical-align:-1px;position:relative}
    .chk.on:after{content:"×";position:absolute;inset:-4px 0 0;text-align:center;font-size:14px;font-weight:800;line-height:14px}
    .cuerpo{flex:1;display:flex;min-height:0}
    .lado{writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;font-weight:700;letter-spacing:.12em;padding:10px 3px;border-right:1.4px solid #111;display:grid;place-items:center;white-space:nowrap}
    table{width:100%;border-collapse:collapse;font-size:11.5px;flex:1;background:#fff}
    th{background:#eee8e0;color:#000;border:0;border-bottom:1.5px solid #000;padding:8px 7px;font-size:11px;font-weight:800;letter-spacing:.04em;text-align:center}
    td{border:0;background:#fff;color:#000;padding:7px 8px;vertical-align:top}
    td.vacio{text-align:center;color:#666;padding:16px}
    td.cant{text-align:center;width:14%}
    td.num,th.num{text-align:right;white-space:nowrap}
    col.cant{width:14%}
    col.desc{width:50%}
    col.pu,col.imp{width:18%}
    .pie{border-top:1.6px solid #111;padding:8px 12px 10px}
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
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .fb{width:auto;min-height:0}
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
        <label>Remito Nº</label><span class="dots short">${esc(doc.pedidoId)}</span>
      </div>
    </div>
    <div class="cuerpo">
      <div class="lado">ORIGINAL BLANCO · DUPLICADO COLOR</div>
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
        <tbody>${filasFacturaB(doc)}</tbody>
      </table>
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

export function descargarHtml(doc) {
  const html = htmlComprobante(doc)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const slug = etiquetaTipoDoc(doc.tipo).toLowerCase().replace(/\s+/g, '-')
  a.href = url
  a.download = `Famat-${slug}-${doc.numero}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
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
