// Almacenamiento en localStorage, con la misma interfaz asíncrona que usan las páginas.

export function getStorageItem<T>(key: string, fallback: T): Promise<T> {
  const raw = localStorage.getItem(key);
  if (!raw) return Promise.resolve(fallback);
  try {
    return Promise.resolve(JSON.parse(raw) as T);
  } catch {
    return Promise.resolve(fallback);
  }
}

export function setStorageItem<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
  return Promise.resolve();
}
