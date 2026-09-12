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
