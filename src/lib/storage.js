export function leerJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return (raw ? JSON.parse(raw) : fallback) ?? fallback
  } catch {
    return fallback
  }
}

export function guardarJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
