export async function versionRemotaNueva() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.build && String(data.build) !== String(__FAMAT_BUILD__))
  } catch {
    return false
  }
}
