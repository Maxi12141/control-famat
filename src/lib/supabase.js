export const SUPABASE_URL = 'https://tgwchfqajlqailjarvjz.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_c7ppDyLAr8AnR4W2rRQIdA_9ebAUNBK'
export const CLIENTE_CATALOGO = 'FAMAT_CATALOGO'
export const ESTADO_CATALOGO = 'catalogo'

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
