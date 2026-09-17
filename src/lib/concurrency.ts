/** Corre `fn` sobre `items` con un límite de tareas simultáneas — evita que
 * procesar miles de archivos a la vez (hash, EXIF, miniaturas) satures la
 * memoria o cuelgues el hilo principal del navegador. A diferencia de
 * `Promise.all(items.map(fn))`, nunca hay más de `limit` promesas de `fn`
 * corriendo al mismo tiempo. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
