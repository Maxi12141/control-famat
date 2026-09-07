export const SUPABASE_URL = 'https://tgwchfqajlqailjarvjz.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_c7ppDyLAr8AnR4W2rRQIdA_9ebAUNBK'
export const CLIENTE_CATALOGO = 'FAMAT_CATALOGO'
export const CLIENTE_CONTROL = 'FAMAT_CONTROL'
export const ESTADO_CATALOGO = 'catalogo'
export const NOTAS_CONTROL = 'control-famat-respaldo'
export const CLAVES_CONTROL = ['famat_codigos', 'famat_ventas', 'famat_perdidas', 'famat_cuentas']

export function headersSupabase(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export async function fetchPedidos(path, options = {}) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/pedidos${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headersSupabase(),
        ...options.headers,
      },
    })
  } finally {
    window.clearTimeout(timer)
  }
}

export async function leerRespaldoControl() {
  const res = await fetchPedidos(
    `?cliente=eq.${CLIENTE_CONTROL}&select=id,productos,notas&order=id.desc&limit=1`,
  )
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) ? data[0] || null : null
}

export async function guardarRespaldoControl(remotoId, productos) {
  const payload = {
    cliente: CLIENTE_CONTROL,
    telefono: '',
    productos,
    liquidos: [],
    granel: [],
    fecha_entrega: '',
    metodo_pago: '',
    notas: NOTAS_CONTROL,
    estado: 'entregado',
    fecha_creacion: new Date().toISOString(),
  }
  if (remotoId) {
    const patch = await fetchPedidos(`?id=eq.${encodeURIComponent(remotoId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    })
    if (patch.ok) return String(remotoId)
  }
  const res = await fetchPedidos('', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return null
  const data = await res.json()
  const row = Array.isArray(data) ? data[0] : data
  return row?.id != null ? String(row.id) : null
}
