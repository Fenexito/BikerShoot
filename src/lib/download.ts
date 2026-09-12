/** Fuerza una descarga real de archivo en vez de abrir una pestaña nueva —
 * `<a download>` sola no alcanza con URLs de OTRO origen (R2 vía Edge
 * Function firmada): el navegador la trata como una navegación normal y
 * termina abriendo la imagen en una pestaña en vez de descargarla. Bajar el
 * archivo como blob primero y crear un object URL local sí respeta
 * `download` sin importar el origen. */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

/** Nombre de archivo real para una entrega final — antes se guardaba/
 * descargaba con un nombre genérico (`motoshots-<uuid>.jpg`), que no dice
 * nada al biker ni al fotógrafo. Con esto: `Fenexito-000007-001.jpg`
 * (fotógrafo-pedido-posición), fácil de ordenar y de identificar. */
export function buildDeliveredFilename(photographerLabel: string, orderNumber: number | null | undefined, positionInOrder: number, originalFilename?: string | null) {
  const safeName = photographerLabel
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 20) || 'MotoShots'
  const orderPart = String(orderNumber ?? 0).padStart(6, '0')
  const photoPart = String(positionInOrder + 1).padStart(3, '0')
  const ext = originalFilename?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  return `${safeName}-${orderPart}-${photoPart}.${ext}`
}
